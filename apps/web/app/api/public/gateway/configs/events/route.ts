import { createServiceClient } from "@/lib/supabase/service";
import { configEventPost } from "@/lib/gateway/remoteConfigService";
import { remoteConfigStore } from "@/lib/gateway/remoteConfigStore";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return configEventPost(
    request,
    remoteConfigStore(createServiceClient()),
    process.env.GATEWAY_INGEST_TOKEN,
  );
}
