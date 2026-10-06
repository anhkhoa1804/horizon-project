import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AppSupabase } from "@/lib/repositories/base";
import { isLikelySupabaseServiceKey, isValidHttpUrl, supabaseUrl } from "@/lib/supabase/env";

export function createServiceClient(): AppSupabase | null {
  // Accepts SUPABASE_URL as well as NEXT_PUBLIC_SUPABASE_URL — see the note on
  // supabaseUrl(). The service key has only ever had one name.
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidHttpUrl(url) || !isLikelySupabaseServiceKey(key)) {
    console.warn(
      "[Horizon] Service-role credentials missing — reports and admin will run " +
        "unavailable. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL " +
        "(or SUPABASE_URL). Check /api/health after deploying.",
    );

    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
