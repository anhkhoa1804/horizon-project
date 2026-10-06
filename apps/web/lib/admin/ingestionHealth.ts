import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
export interface IngestionAuditRow { id: string; device_id: string; status: string; timestamp: string; }
export interface IngestionHealth { rows: IngestionAuditRow[]; gatewayReceivedAt: string | null; unavailable: boolean; }
/** Only authoritative metadata; never relay payloads or secrets. */
export async function loadIngestionHealth(): Promise<IngestionHealth> {
  const client = createServiceClient();
  if (!client) return { rows: [], gatewayReceivedAt: null, unavailable: true };
  const [audit, gateway] = await Promise.all([
    client.from("ingestion_audit_logs").select("id,device_id,status,timestamp").order("timestamp", { ascending: false }).limit(12),
    client.from("gateway_observations").select("received_at").eq("gateway_id", "GATEWAY_01").order("received_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { rows: audit.data ?? [], gatewayReceivedAt: gateway.data?.received_at ?? null, unavailable: !!audit.error || !!gateway.error };
}
