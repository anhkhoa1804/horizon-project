import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
export interface IngestionAuditRow { id: string; device_id: string; status: string; timestamp: string; }
export interface IngestionHealth { rows: IngestionAuditRow[]; unavailable: boolean; }
/** Only authoritative metadata; never relay payloads or secrets. */
export async function loadIngestionHealth(): Promise<IngestionHealth> {
  const client = createServiceClient();
  if (!client) return { rows: [], unavailable: true };
  const audit = await client.from("ingestion_audit_logs").select("id,device_id,status,timestamp").order("timestamp", { ascending: false }).limit(12);
  return { rows: audit.data ?? [], unavailable: !!audit.error };
}
