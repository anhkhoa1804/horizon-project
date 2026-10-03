"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PublicRealtimeConfig } from "@/lib/monitoring/publicRealtime";
import { applyLiveReading, parseLiveReading } from "@/lib/monitoring/liveReadings";
import type { ObservatoryViewModel } from "@/lib/monitoring/types";
import { freshnessStatus } from "@/components/ui/status-indicator";

export function useLiveObservatory(initial: ObservatoryViewModel, config: PublicRealtimeConfig | null) {
  const [model, setModel] = useState(initial);
  const [connected, setConnected] = useState(false);
  useEffect(() => { setModel(initial); }, [initial]);
  useEffect(() => {
    if (!config || initial.mode !== "real") return;
    let active = true;
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const receive = (value: unknown) => {
      const row = parseLiveReading(value);
      if (active && row) setModel((current) => applyLiveReading(current, row));
    };
    const channel = client.channel("public-field-observatory")
      .on("postgres_changes", { event: "*", schema: "public", table: "observatory_live_readings" }, (payload) => receive(payload.new))
      .subscribe(async (status) => {
        if (!active) return;
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          // Close the SSR/subscription gap, also after a reconnect; no polling.
          const { data } = await client.from("observatory_live_readings").select("station_id,kind,observation_id,timestamp,measurements");
          data?.forEach(receive);
        }
      });
    return () => { active = false; void client.removeChannel(channel); };
  }, [config, initial.mode]);
  useEffect(() => {
    if (initial.mode !== "real") return;
    // Derive observation age locally. This never requests telemetry or refreshes a page.
    const timer = window.setInterval(() => setModel((current) => ({ ...current, stations: current.stations.map((s) => ({ ...s, freshness: freshnessStatus(s.timestamp) })) })), 60000);
    return () => window.clearInterval(timer);
  }, [initial.mode]);
  return { model, connected };
}
