import "server-only";
import { supabaseUrl, supabaseAnonKey, isValidHttpUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";
import { parseLiveReading, type LiveReading } from "./liveReadings";

export type PublicRealtimeConfig = { url: string; key: string };

/** Only an explicitly public key may cross the server/client boundary. */
export function getPublicRealtimeConfig(): PublicRealtimeConfig | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!isValidHttpUrl(url) || !key) return null;
  if (key.startsWith("sb_publishable_")) return { url, key };
  try {
    const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    return claims.role === "anon" ? { url, key } : null;
  } catch { return null; }
}

/** Use the same RLS-bound projection to seed SSR and close subscription gaps. */
export async function getPublicLiveSnapshot(): Promise<LiveReading[]> {
  const config = getPublicRealtimeConfig();
  if (!config) return [];
  try {
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from("observatory_live_readings").select("station_id,kind,observation_id,timestamp,measurements");
    if (error) return [];
    return (data ?? []).flatMap((value) => { const row = parseLiveReading(value); return row ? [row] : []; });
  } catch { return []; }
}
