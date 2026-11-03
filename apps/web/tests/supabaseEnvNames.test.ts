import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { hasSupabasePublicConfig, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * The web app must accept the same Supabase variable names the rest of the
 * monorepo uses.
 *
 * The trap this closes: `services/edge-ingestion`, every script in
 * `infra/supabase`, `.env.supabase` and the CI workflows all use
 * `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Only `apps/web` wanted the
 * `NEXT_PUBLIC_` spelling. A deployment configured with the unprefixed names
 * — which is the natural thing to do, since they are what the project uses
 * everywhere else — produced null clients, so the site silently served DEMO
 * DATA while every page returned 200 and looked entirely healthy. Nothing
 * failed; it just quietly stopped being real.
 *
 * The prefixed name still wins so existing local setups are unaffected.
 */
describe("Supabase env variable names", () => {
  const saved = { ...process.env };

  const clear = () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  };

  beforeEach(clear);
  afterEach(() => {
    clear();
    for (const k of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
    ]) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
    }
  });

  it("accepts the prefixed names", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prefixed.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJprefixed";
    assert.equal(supabaseUrl(), "https://prefixed.supabase.co");
    assert.equal(supabaseAnonKey(), "eyJprefixed");
    assert.equal(hasSupabasePublicConfig(), true);
  });

  it("accepts the unprefixed names the rest of the monorepo uses", () => {
    process.env.SUPABASE_URL = "https://plain.supabase.co";
    process.env.SUPABASE_ANON_KEY = "eyJplain";
    assert.equal(supabaseUrl(), "https://plain.supabase.co");
    assert.equal(supabaseAnonKey(), "eyJplain");
    assert.equal(
      hasSupabasePublicConfig(),
      true,
      "a deployment using SUPABASE_URL must not silently fall back to demo mode",
    );
  });

  it("prefers the prefixed name when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prefixed.supabase.co";
    process.env.SUPABASE_URL = "https://plain.supabase.co";
    assert.equal(supabaseUrl(), "https://prefixed.supabase.co");
  });

  it("still reports missing config when neither is set", () => {
    assert.equal(supabaseUrl(), undefined);
    assert.equal(hasSupabasePublicConfig(), false);
  });

  it("rejects a malformed url or key rather than half-configuring", () => {
    process.env.SUPABASE_URL = "not-a-url";
    process.env.SUPABASE_ANON_KEY = "eyJplain";
    assert.equal(hasSupabasePublicConfig(), false);

    process.env.SUPABASE_URL = "https://plain.supabase.co";
    process.env.SUPABASE_ANON_KEY = "clearly-not-a-key";
    assert.equal(hasSupabasePublicConfig(), false);
  });
});
