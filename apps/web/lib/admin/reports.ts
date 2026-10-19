import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export interface AdminCommunityReportRow {
  id: string;
  description: string | null;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
  viewed_at: string | null;
}

/** The same base report read used by the Admin page, without signed media URLs. */
export async function loadAdminCommunityReportRows(): Promise<AdminCommunityReportRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("damage_logs")
    .select("id, description, status, lat, lng, timestamp, viewed_at")
    .order("timestamp", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: row.timestamp as string,
    viewed_at: (row.viewed_at as string | null) ?? null,
  }));
}
