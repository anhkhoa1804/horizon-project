import type { AppSupabase } from "@/lib/repositories/base";

/**
 * Rate limiting for the public report endpoint.
 *
 * Two layers, in this order:
 *
 *   1. DURABLE  — a Postgres counter shared by every serverless instance
 *                 (migration 021). This is the real control.
 *   2. MEMORY   — the original per-process Map, kept as a fallback for when
 *                 the durable path is unavailable: no Supabase configured
 *                 (local demo mode), or migration 021 not yet applied.
 *
 * The fallback matters because the durable path can be absent in a perfectly
 * healthy deployment — this repo ships the migration but does not apply it, so
 * a release that forgets step 3 of the checklist would otherwise silently lose
 * throttling entirely. Degrading to the weaker limiter is worse than the
 * strong one and better than none, and `backend` in the result says which ran
 * so the caller can log it.
 *
 * Deliberately NOT fail-open on a database error: if Postgres is reachable but
 * the call fails, we still consult the in-memory limiter rather than waving
 * the request through.
 */

export const REPORT_RATE_WINDOW_SECONDS = 60 * 60;
export const REPORT_RATE_MAX = 5;

export type RateLimitBackend = "durable" | "memory";

export interface RateLimitResult {
  limited: boolean;
  backend: RateLimitBackend;
}

// ---------------------------------------------------------------------------
// Client identity
// ---------------------------------------------------------------------------

/**
 * The client identifier a rate limit is keyed on.
 *
 * `x-forwarded-for` is a comma-separated chain, and the LEFTMOST entry is
 * whatever the original caller sent — it is attacker-controlled. The previous
 * implementation keyed on exactly that, so `X-Forwarded-For: <random>` on each
 * request bought an unlimited quota.
 *
 * Platform-set headers are preferred because an inbound client cannot forge
 * them: Vercel overwrites `x-vercel-forwarded-for` and `x-real-ip` at the
 * edge, discarding any client-supplied copy. Only if neither exists do we fall
 * back to `x-forwarded-for`, and then to its RIGHTMOST entry — the hop nearest
 * our own infrastructure, which is the least forgeable part of the chain.
 *
 * Behind a proxy that is not Vercel, an operator must confirm which header
 * their edge sets; see docs/PRODUCTION_READINESS.md.
 */
export function clientIdentifier(request: Request): string {
  const platform =
    request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  if (platform && platform.trim()) {
    return platform.split(",")[0]!.trim();
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1]!;
    }
  }

  // No usable identity. Everything lands in one shared bucket, which is
  // deliberately strict rather than deliberately permissive.
  return "unknown";
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const memoryHits = new Map<string, number[]>();

/** Exported for tests only. */
export function resetMemoryRateLimit(): void {
  memoryHits.clear();
}

export function memoryRateLimited(
  key: string,
  now = Date.now(),
  max = REPORT_RATE_MAX,
  windowSeconds = REPORT_RATE_WINDOW_SECONDS,
): boolean {
  const windowStart = now - windowSeconds * 1000;
  const times = (memoryHits.get(key) ?? []).filter((t) => t > windowStart);

  if (times.length >= max) {
    memoryHits.set(key, times);
    return true;
  }

  times.push(now);
  memoryHits.set(key, times);
  return false;
}

// ---------------------------------------------------------------------------
// Durable limiter
// ---------------------------------------------------------------------------

/**
 * Consumes one unit of quota. Returns whether the caller is rate limited, and
 * which backend decided it.
 *
 * `supabase` may be null (demo mode) — the memory limiter answers instead.
 */
export async function consumeReportQuota(
  supabase: AppSupabase | null,
  key: string,
  options: { max?: number; windowSeconds?: number } = {},
): Promise<RateLimitResult> {
  const max = options.max ?? REPORT_RATE_MAX;
  const windowSeconds = options.windowSeconds ?? REPORT_RATE_WINDOW_SECONDS;

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("consume_report_rate_limit", {
        p_bucket: `report:${key}`,
        p_max: max,
        p_window_seconds: windowSeconds,
      });

      // `data === false` means the function ran and refused the request.
      if (!error && typeof data === "boolean") {
        return { limited: !data, backend: "durable" };
      }
    } catch {
      // Network/transport failure — fall through to the memory limiter.
    }
  }

  return { limited: memoryRateLimited(key, Date.now(), max, windowSeconds), backend: "memory" };
}
