export function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLikelySupabasePublicKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.startsWith("sb_publishable_") || value.startsWith("eyJ");
}

export function isLikelySupabaseServiceKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.startsWith("sb_secret_") || value.startsWith("eyJ");
}

/**
 * Where the Supabase URL and anon key come from, in priority order.
 *
 * WHY THERE ARE TWO ACCEPTED NAMES
 * The rest of this monorepo — the ingestion service, every script in
 * `infra/supabase`, `.env.supabase`, and the CI workflows — uses the
 * unprefixed `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Only the web app used the
 * `NEXT_PUBLIC_` spelling. Configuring a deployment therefore meant knowing
 * that one workspace out of three wants different names for the same two
 * values, and getting it wrong fails in the worst possible way: both clients
 * return null, the app quietly falls back to DEMO DATA, and the site looks
 * completely healthy while serving nothing real.
 *
 * Accepting both removes that trap. The prefixed name still wins, so an
 * existing `.env.local` keeps working unchanged.
 *
 * SAFETY: this does not widen client exposure. Both Supabase clients
 * (`anon.ts`, `service.ts`) are `server-only` and no client component imports
 * them, so neither value is inlined into the browser bundle today — the
 * `NEXT_PUBLIC_` prefix here has always been a naming convention rather than
 * a real publication boundary. The anon key is in any case RLS-bound and safe
 * to publish; the service key is read only in `service.ts`, which
 * `tests/secretBoundary.test.ts` pins to a single server-only module.
 */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function supabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
}

export function hasSupabasePublicConfig(): boolean {
  return isValidHttpUrl(supabaseUrl()) && isLikelySupabasePublicKey(supabaseAnonKey());
}
