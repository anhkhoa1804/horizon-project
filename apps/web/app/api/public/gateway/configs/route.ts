import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const defaultConfigs = [
  { station_id: "STATION_01", sample_interval_seconds: 300, sleep_interval_seconds: 300, mode: "normal" },
  { station_id: "STATION_02", sample_interval_seconds: 300, sleep_interval_seconds: 300, mode: "normal" },
  { station_id: "STATION_03", sample_interval_seconds: 300, sleep_interval_seconds: 300, mode: "normal" },
];

export async function GET() {
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "configuration_unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("device_runtime_configs")
    .select("station_id, sample_interval_seconds, sleep_interval_seconds, mode, updated_at")
    .in("station_id", ["STATION_01", "STATION_02", "STATION_03"])
    .order("station_id");

  if (error) {
    return NextResponse.json({ ok: false, error: "configuration_unavailable" }, { status: 503 });
  }

  const merged = defaultConfigs.map((fallback) => {
    const found = data?.find((config) => config.station_id === fallback.station_id);
    return found ?? fallback;
  });

  return NextResponse.json({ ok: true, configs: merged });
}
