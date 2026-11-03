import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The service-role key bypasses RLS completely. Every protection verified
 * against the live database — anon cannot write, cannot read damage_logs,
 * cannot read users — is void for anyone holding it. Shipping it to a browser
 * would hand every visitor full read/write on the whole schema.
 *
 * Nothing in the type system prevents that: a `"use client"` module importing
 * a server helper is a build-time error in Next, but a plain `process.env`
 * read in a shared module is not, and `NEXT_PUBLIC_`-prefixed variables are
 * inlined into the client bundle by design.
 *
 * These are cheap source-level guards for the mistakes that would actually
 * cause it.
 */

const WEB = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = SOURCE_DIRS.flatMap((d) => walk(path.join(WEB, d)));
const rel = (f: string) => path.relative(WEB, f).split(path.sep).join("/");
const isClientModule = (src: string) => /^\s*["']use client["']/.test(src);

describe("service-role secret boundary", () => {
  it("reads the service-role key in exactly one module", () => {
    const readers = sourceFiles.filter((f) =>
      fs.readFileSync(f, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"),
    );
    assert.deepEqual(
      readers.map(rel),
      ["lib/supabase/service.ts"],
      "the service-role key must be read in one server-only chokepoint",
    );
  });

  it("keeps that module server-only", () => {
    const src = fs.readFileSync(path.join(WEB, "lib/supabase/service.ts"), "utf8");
    assert.match(src, /^import "server-only";/m, "the import that makes a client bundle fail loudly");
    assert.ok(!isClientModule(src));
  });

  it("never lets a client component import a service-role or server-only module", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      if (!isClientModule(src)) continue;
      if (/from "@\/lib\/supabase\/service"|from "@\/lib\/auth\/(localAdminSession|adminAllowlist|session)"/.test(src)) {
        offenders.push(rel(file));
      }
    }
    assert.deepEqual(offenders, [], "these run in the browser and must not reach server-only modules");
  });

  it("exposes only the intended NEXT_PUBLIC_ variables", () => {
    // Anything NEXT_PUBLIC_ is inlined into the browser bundle, so each entry
    // below is a deliberate decision that the value is safe to publish:
    //
    //   NEXT_PUBLIC_SUPABASE_URL       the project's public API origin
    //   NEXT_PUBLIC_SUPABASE_ANON_KEY  RLS-bound and public by design
    //   NEXT_PUBLIC_SITE_URL           the site's own public origin — it is
    //                                  printed in the sitemap and in every
    //                                  canonical link, so it is public by
    //                                  definition
    //
    // A NEW variable failing here is the point. Confirm it can be published
    // before adding it.
    const found = new Set<string>();
    for (const file of sourceFiles) {
      for (const m of fs.readFileSync(file, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        found.add(m[0]);
      }
    }
    assert.deepEqual(
      [...found].sort(),
      [
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
      ],
      "a new client-exposed variable appeared — confirm it is safe to publish",
    );
  });

  it("never prefixes an admin secret with NEXT_PUBLIC_", () => {
    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      assert.ok(
        !/NEXT_PUBLIC_(ADMIN|SERVICE|SESSION)/.test(src),
        `${rel(file)} exposes an admin/service secret to the browser`,
      );
    }
  });
});
