import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionContext } from "@/lib/auth/session";
import { asManagedStationId, recordAuditEvent } from "@/lib/admin/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV export of real observations.
 *
 * REAL ROWS ONLY. This selects from the same tables the observatory reads and
 * streams exactly what is there — no synthesised gaps, no interpolation, no
 * placeholder rows to make a range look continuous. An empty range exports a
 * header and nothing else, which is the honest answer to "there was no data".
 *
 * BEHIND THE ADMIN SESSION. Environmental readings are public in aggregate,
 * but a bulk export keyed by station and time is an operator tool, and the
 * route holds a service-role client. It refuses without a valid admin session
 * rather than relying on obscurity.
 */

const MAX_ROWS = 5000;

/**
 * Column lists are the REAL schema (migrations 006 / 019 / 024 / 031). The
 * previous lists named `soil_ec` (the column is `soil_ec_ms_cm`) and put air
 * temperature / humidity on environmental_readings (they live on
 * soil_readings), so PostgREST rejected the select and both exports failed.
 */
const WATER_COLUMNS =
  "station_id, timestamp, water_level, water_ec_ms_cm, water_temp_c, salinity, fault_flags, ec_probe_status, ultrasonic_status";
const SOIL_COLUMNS =
  "station_id, timestamp, soil_moisture_pct, soil_ec_ms_cm, soil_ph, soil_temp_c, air_temp_c, air_humidity_pct, fault_flags";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` or a full ISO timestamp that Date can parse. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/**
 * The export form is a plain GET navigation, so a JSON error body would
 * replace the console with raw JSON. A browser navigation goes back to the
 * console with a readable message; scripted callers still get JSON.
 */
function failure(request: Request, code: "invalid_range" | "export_failed", status: number) {
  if ((request.headers.get("accept") ?? "").includes("text/html")) {
    const url = new URL("/admin", request.url);
    url.searchParams.set("error", code === "invalid_range" ? "export-invalid-range" : "export-failed");
    url.hash = "export";
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ error: code }, { status });
}

/** RFC 4180 quoting: wrap in quotes and double any embedded quote. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  // Same gate the console itself uses. A 401 here rather than a redirect:
  // this is a data endpoint, and a browser following a redirect to the login
  // page would silently download an HTML file named .csv.
  const { user, profile, scope } = await getSessionContext();
  if (!user || !profile || profile.role !== "admin" || !scope) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const stationId = asManagedStationId(url.searchParams.get("station"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dataset = url.searchParams.get("dataset") === "soil" ? "soil" : "environmental";

  // Reject a malformed range instead of forwarding it to PostgREST.
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
    return failure(request, "invalid_range", 400);
  }

  const table = dataset === "soil" ? "soil_readings" : "environmental_readings";
  const columns = dataset === "soil" ? SOIL_COLUMNS : WATER_COLUMNS;

  let query = supabase
    .from(table)
    .select(columns)
    .order("timestamp", { ascending: false })
    .limit(MAX_ROWS);

  if (stationId) query = query.eq("station_id", stationId);
  // The form sends calendar dates (Vietnam days) and "to" is inclusive:
  // a bare `lte 2026-10-19` meant midnight UTC and silently dropped that
  // day's readings.
  if (from) query = query.gte("timestamp", DATE_ONLY.test(from) ? `${from}T00:00:00+07:00` : from);
  if (to) query = DATE_ONLY.test(to) ? query.lt("timestamp", `${nextDay(to)}T00:00:00+07:00`) : query.lte("timestamp", to);

  const { data, error } = await query;
  if (error) {
    return failure(request, "export_failed", 502);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const header = columns.split(",").map((c) => c.trim());
  const body = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key])).join(",")),
  ].join("\r\n");

  // The trail records that an export happened and its shape — never its
  // contents, and never a credential.
  await recordAuditEvent({
    actor: user.email,
    action: "data.export",
    entity: table,
    entityId: stationId ?? "all",
    metadata: { dataset, station: stationId ?? "all", from, to, rows: rows.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `horizon-${dataset}-${stationId ?? "all"}-${stamp}.csv`;

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
