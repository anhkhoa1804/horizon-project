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

  const table = dataset === "soil" ? "soil_readings" : "environmental_readings";
  const columns =
    dataset === "soil"
      ? "station_id, timestamp, soil_moisture_pct, soil_ec, soil_ph, soil_temp_c"
      : "station_id, timestamp, salinity, water_level, air_temp_c, air_humidity_pct";

  let query = supabase
    .from(table)
    .select(columns)
    .order("timestamp", { ascending: false })
    .limit(MAX_ROWS);

  if (stationId) query = query.eq("station_id", stationId);
  if (from) query = query.gte("timestamp", from);
  if (to) query = query.lte("timestamp", to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "export_failed" }, { status: 502 });
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
