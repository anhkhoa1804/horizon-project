import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ReadingRepository } from "@/lib/repositories/readingRepository";
import type { RepositoryScope } from "@/types";
import { handleIngestFromEnv } from "../../../services/edge-ingestion/src/httpHandler.js";
import { SupabaseDb } from "../../../services/edge-ingestion/src/supabaseDb.js";
import type { TelemetryPayloadV1 } from "../../../services/edge-ingestion/src/types.js";

const database = new PGlite();
const previousFetch = globalThis.fetch;
const now = 1_791_381_600;
const edgeEnv = {
  SUPABASE_URL: "http://isolated.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key",
  GATEWAY_INGEST_TOKEN: "test-only-gateway-token",
  DEFAULT_CONTRACT_VERSION: "v1",
  MAX_TIMESTAMP_DRIFT_SECONDS: "300",
};
const adminScope: RepositoryScope = { userId: "isolated-admin", role: "admin", stationIds: [] };

before(async () => {
await database.exec(`
  create table devices(device_id text primary key, status text, firmware_version text, last_seen_at timestamptz);
  insert into devices(device_id,status) values ('STATION_01','active'),('STATION_02','active');
  create table environmental_readings(
    id bigserial primary key, message_id text unique not null, station_id text not null,
    salinity double precision, salinity_ppm double precision, water_level double precision,
    sensor_height_cm double precision, distance_cm double precision, ec_ms_cm double precision,
    ec_us_cm double precision, temperature_c double precision, tds_ppm double precision,
    water_ec_ms_cm double precision, water_temp_c double precision,
    sequence bigint, summary_minutes double precision, fault_flags integer not null,
    ec_probe_status text, ultrasonic_status text, timestamp timestamptz not null,
    created_at timestamptz not null default now(), raw_station_payload jsonb
  );
  create table soil_readings(
    id bigserial primary key, message_id text unique not null, station_id text not null,
    air_temp_c double precision, air_humidity_pct double precision, soil_temp_c double precision,
    soil_moisture_pct double precision, soil_ec_ms_cm double precision, soil_ec_us_cm double precision,
    soil_salinity double precision, soil_tds double precision, soil_ph double precision,
    sequence bigint, summary_minutes double precision, crop text, fault_flags integer not null,
    timestamp timestamptz not null, created_at timestamptz not null default now(), raw_station_payload jsonb
  );
  create table environmental_events(id bigserial primary key, station_id text, event_type text, severity text, message_id text, details jsonb, timestamp timestamptz);
  create table ingestion_audit_logs(id bigserial primary key, message_id text, device_id text, status text, reason text, timestamp timestamptz);
  create table station_health_logs(id bigserial primary key, station_id text, battery_voltage double precision, battery_percent double precision, signal_strength_dbm double precision, firmware_version text, timestamp timestamptz);
  create table firmware_updates(device_id text, active boolean, target_version text, binary_url text, sha256 text, size_bytes integer);
`);
});

let failNextReadingInsert = false;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/rest/v1/")) return new Response("not found", { status: 404 });
  const table = url.pathname.slice("/rest/v1/".length);
  const method = request.method.toUpperCase();
  try {
    if (method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      if (failNextReadingInsert && ["environmental_readings", "soil_readings"].includes(table)) {
        failNextReadingInsert = false;
        return new Response("isolated database unavailable", { status: 503 });
      }
      const columns = Object.keys(body);
      const values = columns.map((column) => body[column]);
      await database.query(
        `insert into ${table} (${columns.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})`,
        values,
      );
      return new Response("", { status: 201 });
    }
    if (method === "PATCH" && table === "devices") {
      const body = await request.json() as Record<string, unknown>;
      const deviceId = url.searchParams.get("device_id")?.replace(/^eq\./, "");
      await database.query("update devices set last_seen_at=$1,firmware_version=$2 where device_id=$3", [body.last_seen_at, body.firmware_version, deviceId]);
      return new Response("", { status: 204 });
    }
    if (method === "GET") {
      const columns = url.searchParams.get("select")?.split(",").filter(Boolean) ?? ["*"];
      const filter = [...url.searchParams.entries()].find(([key, value]) => key !== "select" && value.startsWith("eq."));
      const order = url.searchParams.get("order")?.split(".") ?? [];
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const sql = `select ${columns.join(",")} from ${table}${filter ? ` where ${filter[0]}=$1` : ""}${order.length ? ` order by ${order[0]} ${order[1] === "desc" ? "desc" : "asc"}` : ""} limit ${Math.max(0, Math.min(limit, 1000))}`;
      const result = await database.query(sql, filter ? [filter[1].slice(3)] : []);
      return Response.json(result.rows);
    }
    return new Response("method not supported", { status: 405 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return new Response(JSON.stringify({ code, message: "isolated database error" }), {
      status: code === "23505" ? 409 : 400,
      headers: { "content-type": "application/json" },
    });
  }
}) as typeof fetch;

after(async () => {
  globalThis.fetch = previousFetch;
  await database.close();
});

const edgeDb = SupabaseDb.fromEnv(edgeEnv);
const ingestHeaders = { "x-gateway-token": edgeEnv.GATEWAY_INGEST_TOKEN, "x-contract-version": "v1" };
const gatewayRaw = { gateway_id: "GATEWAY_01", wire_protocol: "S1/S2|...|CRC16", timestamp_semantics: "gateway_network_receipt_time" };
const telemetryHost = resolve(process.cwd(), "../../firmware/esp32-node/build/simple_telemetry_host" + (process.platform === "win32" ? ".exe" : ""));
function makeFrame(...fields: string[]): string {
  const result = spawnSync(telemetryHost, ["make", ...fields], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function mapFrame(line: string): TelemetryPayloadV1 {
  const result = spawnSync(telemetryHost, ["map", line, "GATEWAY_01"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as TelemetryPayloadV1;
  // Production Gateway attaches its validated network receipt epoch after mapping.
  payload.timestamp = now;
  return payload;
}
const s1Frame = makeFrame("S1", "41", "5", "298", "52", "1.2", "29.1", "740", "1.2", "3.91", "86");
const s2Frame = makeFrame("S2", "81", "5", "30", "72", "28", "39", "0.8", "0.4", "512", "x", "3.88", "84");
const s1FaultFrame = makeFrame("S1", "42", "5", "297", "53", "x", "29.2", "742", "1.1", "3.90", "85");
const s1Payload = mapFrame(s1Frame);
const s2Payload = mapFrame(s2Frame);

test("production CRC parser and Gateway S1/S2 mapping pass Edge, isolated Postgres, and Admin readback", async () => {
  const gatewaySource = readFileSync(resolve(process.cwd(), "../../firmware/esp32-node/src/gateway/gateway.ino"), "utf8");
  assert.match(gatewaySource, /#include "simple_telemetry\.h"/);
  assert.match(gatewaySource, /horizon::parseSimpleTelemetryFrame\(input, parsed\)/);
  assert.match(gatewaySource, /horizon::simplePacketToTelemetryJson\(parsed, input, GATEWAY_ID\)/);
  assert.doesNotMatch(gatewaySource, /uint16_t simpleCrc16\(const String/);
  assert.equal(s1Payload.reading_kind, "water");
  assert.equal(s1Payload.device_id, "STATION_01");
  assert.match(s1Payload.message_id, /^STATION_01-41-/);
  assert.equal(s1Payload.ec_ms_cm, 1.2);
  assert.equal(s1Payload.temperature_c, 29.1);
  assert.equal(s2Payload.reading_kind, "soil");
  assert.equal(s2Payload.device_id, "STATION_02");
  assert.match(s2Payload.message_id, /^STATION_02-81-/);
  assert.equal(s2Payload.soil?.soil_ec_ms_cm, 0.8);
  assert.equal(s2Payload.soil?.soil_salinity, 0.4);
  assert.equal(s2Payload.soil?.soil_ec_us_cm, 800);
  assert.equal("soil_ec_saturated_extract" in (s2Payload.soil ?? {}), false, "bulk EC is not an ECe result");
  assert.equal(s2Payload.soil?.soil_ph, null);
  assert.equal(s2Payload.fault_flags, 128);
  const s1Fault = mapFrame(s1FaultFrame);
  assert.equal(s1Fault.ec_ms_cm, null);
  assert.equal(s1Fault.ec_us_cm, null);
  assert.equal(s1Fault.fault_flags, 1);
  assert.equal("config_ack" in s1Fault, false, "telemetry does not claim configuration acknowledgement");
  assert.equal(s1Payload.raw_station_payload?.gateway_id, "GATEWAY_01");
  assert.equal(mapFrame(s1Frame).message_id, s1Payload.message_id);
  assert.notEqual(mapFrame(makeFrame("S1", "41", "5", "298", "53", "1.2", "29.1", "740", "1.2", "3.91", "86")).message_id, s1Payload.message_id);
  const s1 = await handleIngestFromEnv(s1Payload, ingestHeaders, edgeDb, edgeEnv, now);
  const s2 = await handleIngestFromEnv(s2Payload, ingestHeaders, edgeDb, edgeEnv, now + 1);
  const faultInsert = await handleIngestFromEnv({ ...s1Fault, timestamp: now - 1 }, ingestHeaders, edgeDb, edgeEnv, now);
  assert.equal(s1.status, 200);
  assert.equal(s1.body.status, "inserted");
  assert.equal(s2.status, 200);
  assert.equal(s2.body.status, "inserted");
  assert.equal(faultInsert.status, 200);

  const counts = await database.query<{ water: number; soil: number; water_wrong_station: number; soil_wrong_station: number }>(
    `select
      (select count(*)::int from environmental_readings where station_id='STATION_01') water,
      (select count(*)::int from soil_readings where station_id='STATION_02') soil,
      (select count(*)::int from environmental_readings where station_id='STATION_02') water_wrong_station,
      (select count(*)::int from soil_readings where station_id='STATION_01') soil_wrong_station`,
  );
  assert.deepEqual(counts.rows[0], { water: 2, soil: 1, water_wrong_station: 0, soil_wrong_station: 0 });
  const faultStored = await database.query<{ec_ms_cm: number|null; ec_us_cm: number|null}>("select ec_ms_cm,ec_us_cm from environmental_readings where message_id=$1", [s1Fault.message_id]);
  assert.deepEqual(faultStored.rows[0], { ec_ms_cm: null, ec_us_cm: null });

  const client = createClient(edgeEnv.SUPABASE_URL, "test-only-anon-key", {
    auth: { persistSession: false },
    global: { fetch: globalThis.fetch },
  });
  const adminReadings = new ReadingRepository(client);
  const water = await adminReadings.getLatestByStation("STATION_01", adminScope);
  const soil = await adminReadings.getLatestSoilReadingByStation("STATION_02", adminScope);
  assert.equal(water?.message_id, s1Payload.message_id);
  assert.equal(water?.station_id, "STATION_01");
  assert.equal(water?.water_level, 52);
  assert.equal(water?.water_ec_ms_cm, 1.2);
  assert.equal(water?.water_temp_c, 29.1);
  assert.equal(soil?.message_id, s2Payload.message_id);
  assert.equal(soil?.station_id, "STATION_02");
  assert.equal(soil?.soil_moisture_pct, 39);
  assert.equal(soil?.soil_ph, null);
  assert.ok(!("externalWeather" in (water ?? {})));
  const provenance = await database.query<{ gateway_id: string; timestamp_semantics: string; timestamp_epoch: number }>(
    "select raw_station_payload->>'gateway_id' gateway_id, raw_station_payload->>'timestamp_semantics' timestamp_semantics, extract(epoch from timestamp)::bigint timestamp_epoch from environmental_readings where message_id=$1",
    [s1Payload.message_id],
  );
  assert.equal(provenance.rows[0].gateway_id, "GATEWAY_01");
  assert.equal(provenance.rows[0].timestamp_semantics, "gateway_network_receipt_time");
  assert.equal(Number(provenance.rows[0].timestamp_epoch), now);

  const duplicate = await handleIngestFromEnv(s1Payload, ingestHeaders, edgeDb, edgeEnv, now + 2);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.status, "duplicate_ignored");
  assert.equal((await database.query("select message_id from environmental_readings where message_id=$1", [s1Payload.message_id])).rows.length, 1);
  const s1Evidence = await database.query<{ status: string; timestamp_epoch: number }>(
    "select status,extract(epoch from timestamp)::bigint timestamp_epoch from ingestion_audit_logs where message_id=$1 order by id",
    [s1Payload.message_id],
  );
  assert.deepEqual(s1Evidence.rows.map((row) => row.status), ["accepted", "duplicate"]);
  assert.equal(Number(s1Evidence.rows[0].timestamp_epoch), now);
});

test("invalid auth, range, missing field, and retryable DB failure write no false accepted reading", async () => {
  const unauthorized = await handleIngestFromEnv({ ...s1Payload, message_id: "S1-BAD-AUTH" }, { ...ingestHeaders, "x-gateway-token": "wrong-token" }, edgeDb, edgeEnv, now);
  assert.equal(unauthorized.status, 401);
  assert.equal((await database.query("select id from environmental_readings where message_id='S1-BAD-AUTH'")).rows.length, 0);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id='S1-BAD-AUTH' and status='accepted'")).rows.length, 0);

  const outOfRange = await handleIngestFromEnv({ ...s2Payload, message_id: "S2-BAD-RANGE", soil: { ...s2Payload.soil!, soil_moisture_pct: 104 } }, ingestHeaders, edgeDb, edgeEnv, now);
  assert.equal(outOfRange.status, 400);
  assert.equal((await database.query("select id from soil_readings where message_id='S2-BAD-RANGE'")).rows.length, 0);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id='S2-BAD-RANGE' and status='accepted'")).rows.length, 0);

  const badContract = await handleIngestFromEnv({ ...s1Payload, message_id: "S1-BAD-CONTRACT", contract_version: "v2" as "v1" }, ingestHeaders, edgeDb, edgeEnv, now);
  assert.equal(badContract.status, 400);
  assert.equal((await database.query("select id from environmental_readings where message_id='S1-BAD-CONTRACT'")).rows.length, 0);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id='S1-BAD-CONTRACT' and status='accepted'")).rows.length, 0);

  const missing = { ...s1Payload, message_id: "S1-MISSING-FIELD", sensor_status: undefined } as unknown as TelemetryPayloadV1;
  const missingResult = await handleIngestFromEnv(missing, ingestHeaders, edgeDb, edgeEnv, now);
  assert.equal(missingResult.status, 400);
  assert.equal((await database.query("select id from environmental_readings where message_id='S1-MISSING-FIELD'")).rows.length, 0);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id='S1-MISSING-FIELD' and status='accepted'")).rows.length, 0);

  const invalidFrames = [
    s1Frame.slice(0, -1) + (s1Frame.endsWith("0") ? "1" : "0"),
    makeFrame("S1", "41", "5", "298", "52", "not-a-number", "29.1", "740", "1.2", "3.91", "86"),
    makeFrame("S1", "41", "5", "298", "52", "1.2", "29.1", "740", "1.2", "3.91"),
    makeFrame("S3", "41", "5", "298", "52", "1.2", "29.1", "740", "1.2", "3.91", "86"),
    makeFrame("S1", "", "5", "298", "52", "1.2", "29.1", "740", "1.2", "3.91", "86"),
  ];
  for (const frame of invalidFrames) {
    const parsed = spawnSync(telemetryHost, ["map", frame, "GATEWAY_01"], { encoding: "utf8" });
    assert.equal(parsed.status, 2, "production parser must reject invalid CRC, field count, numeric, or identity");
  }

  failNextReadingInsert = true;
  const retryPayload = { ...s1Payload, message_id: "S1-RETRY-DB-FAILURE" };
  const failure = await handleIngestFromEnv(retryPayload, ingestHeaders, edgeDb, edgeEnv, now);
  assert.equal(failure.status, 500);
  assert.equal((await database.query("select id from environmental_readings where message_id=$1", [retryPayload.message_id])).rows.length, 0);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id=$1 and status='accepted'", [retryPayload.message_id])).rows.length, 0);
  const retry = await handleIngestFromEnv(retryPayload, ingestHeaders, edgeDb, edgeEnv, now + 1);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.status, "inserted");
  assert.equal((await database.query("select id from environmental_readings where message_id=$1", [retryPayload.message_id])).rows.length, 1);
  assert.equal((await database.query("select id from ingestion_audit_logs where message_id=$1 and status='accepted'", [retryPayload.message_id])).rows.length, 1);
});
