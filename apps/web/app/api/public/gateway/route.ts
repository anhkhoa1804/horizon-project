import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorizeGatewayRequest } from "@/lib/gateway/ingestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveLocalStoragePath() {
  const repoRootPath = path.join(process.cwd(), "apps", "web", ".local-gateway-data.json");
  const appRootPath = path.join(process.cwd(), ".local-gateway-data.json");

  return path.basename(process.cwd()) === "web" ? appRootPath : repoRootPath;
}

const localStoragePath = resolveLocalStoragePath();
const isProduction = process.env.NODE_ENV === "production";

async function ensureLocalStore() {
  try {
    await fs.access(localStoragePath);
  } catch {
    await fs.writeFile(localStoragePath, JSON.stringify({ latest: null }, null, 2), "utf8");
  }
}

async function readLocalStore() {
  await ensureLocalStore();
  const raw = await fs.readFile(localStoragePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { latest: null };
  }
}

async function writeLocalStore(payload: unknown) {
  await ensureLocalStore();
  await fs.writeFile(localStoragePath, JSON.stringify({ latest: payload }, null, 2), "utf8");
}

function summarizeGatewayPayload(payload: Record<string, unknown>) {
  return {
    station_id: typeof payload.station_id === "string" ? payload.station_id : null,
    gateway_id: typeof payload.gateway_id === "string" ? payload.gateway_id : null,
    message_id: typeof payload.message_id === "string" ? payload.message_id : null,
    air_temp_c: typeof payload.air_temp_c === "number" ? payload.air_temp_c : null,
    soil_temp_c: typeof payload.soil_temp_c === "number" ? payload.soil_temp_c : null,
    air_humidity_pct:
      typeof payload.air_humidity_pct === "number" ? payload.air_humidity_pct : null,
    timestamp:
      typeof payload.timestamp === "number" ? payload.timestamp : null,
  };
}

function finiteNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function stationPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.raw_station_payload;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : payload;
}

function observationTimestamp(payload: Record<string, unknown>, fallback: string): string {
  const raw = finiteNumber(payload, "timestamp");
  if (raw === null) return fallback;
  const millis = raw > 10_000_000_000 ? raw : raw * 1000;
  const parsed = new Date(millis);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

/**
 * Promote the gateway's authenticated field payload into the typed telemetry
 * tables used by the observatory. The raw row remains the audit source. A
 * partial payload is never padded with plausible values: if the required
 * station fields are absent, only the raw observation is retained.
 */
async function writeTypedObservation(payload: Record<string, unknown>, receivedAt: string) {
  const supabase = createServiceClient();
  if (!supabase) return;
  const stationId = typeof payload.station_id === "string" ? payload.station_id : "";
  const messageId = typeof payload.message_id === "string" ? payload.message_id : "";
  if (!messageId) return;

  if (stationId === "STATION_01") {
    const salinity = finiteNumber(payload, "salinity_ppt", "salinity");
    const waterLevel = finiteNumber(payload, "water_level_cm", "water_level");
    const rawEcStatus = payload.ec_status ?? payload.ec_probe_status;
    const rawUltrasonicStatus = payload.ultrasonic_status;
    const ecStatus = ["ok", "warn", "fault"].includes(String(rawEcStatus))
      ? String(rawEcStatus)
      : "unknown";
    const ultrasonicStatus = ["ok", "warn", "fault"].includes(String(rawUltrasonicStatus))
      ? String(rawUltrasonicStatus)
      : "unknown";
    if (
      salinity === null ||
      waterLevel === null
    ) return;

    const { error } = await supabase.from("environmental_readings").upsert(
      {
        message_id: messageId,
        station_id: stationId,
        salinity,
        water_level: waterLevel,
        water_ec_ms_cm: finiteNumber(payload, "ec_ms_cm"),
        water_temp_c: finiteNumber(payload, "temperature_c"),
        fault_flags: finiteNumber(payload, "fault_flags") ?? 0,
        ec_probe_status: ecStatus,
        ultrasonic_status: ultrasonicStatus,
        timestamp: observationTimestamp(payload, receivedAt),
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    );
    if (error) console.error("[gateway-ingest] typed water write failed:", error);
    return;
  }

  if (stationId === "STATION_02") {
    const row = {
      air_temp_c: finiteNumber(payload, "air_temp_c"),
      air_humidity_pct: finiteNumber(payload, "air_humidity_pct"),
      soil_temp_c: finiteNumber(payload, "soil_temp_c"),
      soil_moisture_pct: finiteNumber(payload, "soil_moisture_pct"),
      soil_ec_ms_cm: finiteNumber(payload, "soil_ec_ms_cm"),
      soil_ph: finiteNumber(payload, "soil_ph"),
    };
    if (Object.values(row).every((value) => value === null)) return;
    const { error } = await supabase.from("soil_readings").upsert(
      {
        message_id: messageId,
        station_id: stationId,
        ...row,
        fault_flags: finiteNumber(payload, "fault_flags") ?? 0,
        timestamp: observationTimestamp(payload, receivedAt),
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    );
    if (error) console.error("[gateway-ingest] typed soil write failed:", error);
  }
}

async function readLatestGatewayObservation() {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("gateway_observations")
    .select("raw_payload, received_at")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.raw_payload !== "object" || data.raw_payload === null) {
    if (error) console.error("[gateway-ingest] failed to read latest observation:", error);
    return null;
  }

  const payload = data.raw_payload as Record<string, unknown>;
  const station = stationPayload(payload);
  return {
    ...payload,
    receivedAt: data.received_at,
    summary: summarizeGatewayPayload(station),
  };
}

async function writeGatewayObservation(payload: Record<string, unknown>, receivedAt: string) {
  const supabase = createServiceClient();
  if (!supabase) return false;

  const station = stationPayload(payload);
  const { error } = await supabase.from("gateway_observations").insert({
    gateway_id: typeof payload.gateway_id === "string" ? payload.gateway_id : "UNKNOWN_GATEWAY",
    station_id: typeof station.station_id === "string" ? station.station_id : "UNKNOWN_STATION",
    sequence: typeof payload.sequence === "number" ? payload.sequence : null,
    transport: typeof payload.transport === "string" ? payload.transport : "4g_http",
    raw_payload: payload,
    received_at: receivedAt,
  });

  if (error) {
    console.error("[gateway-ingest] failed to store observation:", error);
    return false;
  }

  return true;
}

export async function GET() {
  const latestObservation = await readLatestGatewayObservation();
  if (latestObservation) {
    return NextResponse.json({
      ok: true,
      route: "/api/public/gateway",
      methods: ["POST"],
      message: "Gateway ingest endpoint.",
      storage: "supabase",
      latest: latestObservation,
    });
  }

  if (isProduction) {
    return NextResponse.json({
      ok: true,
      route: "/api/public/gateway",
      methods: ["POST"],
      message: "Gateway ingest endpoint.",
      storage: "supabase",
      latest: null,
    });
  }

  const store = await readLocalStore();

  return NextResponse.json({
    ok: true,
    route: "/api/public/gateway",
    methods: ["POST"],
    message: "Gateway ingest endpoint for local testing.",
    storage: "local-file",
    latest: store.latest,
  });
}

export async function POST(request: Request) {
  try {
    const auth = authorizeGatewayRequest(
      request.headers.get("x-gateway-token"),
      process.env.GATEWAY_INGEST_TOKEN,
    );

    if (auth === "not_configured") {
      // Deliberately distinct from 401: this is the SERVER being wrong, and
      // an operator reading logs needs to tell "the gateway sent a bad token"
      // apart from "this deployment has no token". The response body names
      // the variable but never a value.
      console.error(
        "[gateway-ingest] refusing ingest: GATEWAY_INGEST_TOKEN is not set on this deployment",
      );
      return NextResponse.json(
        { ok: false, error: "ingest_not_configured" },
        { status: 503 },
      );
    }

    if (auth === "unauthorized") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : null;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const candidate = body as Record<string, unknown>;
    const station = stationPayload(candidate);
    const receivedAt = new Date().toISOString();
    const summary = summarizeGatewayPayload(station);
    const storedInSupabase = await writeGatewayObservation(candidate, receivedAt);
    if (storedInSupabase) await writeTypedObservation(station, receivedAt);

    if (!storedInSupabase) {
      if (isProduction) {
        return NextResponse.json(
          { ok: false, error: "gateway_observation_store_unavailable" },
          { status: 503 },
        );
      }

      await writeLocalStore({
        ...candidate,
        receivedAt,
        summary,
      });
    }

    console.log("[gateway-local-test] received payload:", rawBody);
    console.log("[gateway-local-test] summary:", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      accepted: true,
      message: "Gateway payload accepted.",
      storage: storedInSupabase ? "supabase" : "local-file",
      receivedAt,
      summary,
      payload: body,
      storedAt: storedInSupabase ? "gateway_observations" : localStoragePath,
    });
  } catch (error) {
    console.error("[gateway-local-test] invalid payload:", error);
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
