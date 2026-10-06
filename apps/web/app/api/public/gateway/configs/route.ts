import { createServiceClient } from "@/lib/supabase/service";
import { configGet } from "@/lib/gateway/remoteConfigService";
import { remoteConfigStore } from "@/lib/gateway/remoteConfigStore";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return configGet(
    request,
    remoteConfigStore(createServiceClient()),
    process.env.GATEWAY_INGEST_TOKEN,
  );
}
