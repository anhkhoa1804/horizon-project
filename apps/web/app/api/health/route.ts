import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminAuthConfigured } from "@/lib/auth/localAdminSession";
import { CON_HO } from "@/lib/geo";

/**
 * Operational health, for a deploy check or an uptime ping.
 *
 * WHAT IT DELIBERATELY DOES NOT SAY
 * No secrets, no URLs, no keys, no connection strings, no row counts, no user
 * data, no internal paths, no error messages from upstream. Every field is
 * either a boolean, a fixed enum, or a duration — enough to answer "is this
 * deployment wired up?" and nothing an attacker could use to map the system.
 *
 * `configured` vs `reachable` are separate on purpose. "Supabase not
 * configured" is a deployment mistake; "configured but unreachable" is an
 * incident. Collapsing them into one flag would make the most common
 * production failure indistinguishable from the most common setup failure.
 *
 * Auth reports configured-ness only. It never reveals the allowlist, and a
 * false here means /admin is unusable — which an operator needs to know
 * without having to attempt a login.
 *
 * Uncached and node-runtime: a cached health check is worse than none, and
 * the Supabase probe needs a real network call.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROBE_TIMEOUT_MS = 3000;

type ProbeState = "ok" | "unreachable" | "not_configured";

async function probeDatabase(): Promise<ProbeState> {
  const supabase = createServiceClient();
  if (!supabase) return "not_configured";

  try {
    // Cheapest possible round-trip that still proves auth + connectivity:
    // a zero-row count against a public table.
    const { error } = await supabase
      .from("stations")
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));

    return error ? "unreachable" : "ok";
  } catch {
    return "unreachable";
  }
}

async function probeWeather(): Promise<ProbeState> {
  try {
    // HEAD against the same host the weather adapter uses. Keyless, so there
    // is nothing to configure and nothing to leak.
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${CON_HO.lat}&longitude=${CON_HO.lng}&current=temperature_2m`,
      { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), cache: "no-store" },
    );
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  const startedAt = Date.now();
  const [database, weather] = await Promise.all([probeDatabase(), probeWeather()]);

  // The site is "up" if it can serve its own pages. Weather is supplementary
  // context and its absence is handled gracefully everywhere it is used, so it
  // must not drive a red status and page someone at 3am.
  const healthy = database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      environment: process.env.NODE_ENV,
      // Vercel injects this; absent locally. First 7 chars only — enough to
      // identify a deploy, not enough to be a source reference.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      checks: {
        database,
        weather,
        adminAuthConfigured: isAdminAuthConfigured(),
      },
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
