import "server-only";
import { createHmac } from "node:crypto";
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

/**
 * A purpose-bound secret derived from the service-role key, for server code
 * that needs a MAC key (for example the report upload ticket). This module is
 * the ONLY place the raw key is read (tests/secretBoundary.test.ts), so
 * callers get an HMAC-derived key for their own label instead — the raw key
 * never leaves this file, and rotating it invalidates everything derived.
 */
export function deriveServiceSecret(label: string): Buffer | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isLikelySupabaseServiceKey(key)) return null;
  return createHmac("sha256", key).update(label).digest();
}
