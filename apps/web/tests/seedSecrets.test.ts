import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The pilot seed must never reset a rotated device secret.
 *
 * `device_secret` is the HMAC key that authenticates telemetry
 * (services/edge-ingestion/src/canonical.ts). The seed ships PUBLIC
 * placeholder values so a fresh clone can exercise the ingestion path, and
 * `apply-migrations.mjs` re-runs the seed on EVERY `npm run db:migrate`.
 *
 * Its upsert used to carry `device_secret = excluded.device_secret`, which
 * meant: an operator rotates the production secrets, deploys once more, and
 * every device silently reverts to a value published in the repository. The
 * window was invisible — no error, no log, nothing in the diff.
 *
 * This test reads the SQL directly rather than the database, so it holds in
 * CI with no credentials.
 */

const SEED = path.resolve(process.cwd(), "..", "..", "infra", "supabase", "seed", "pilot_seed.sql");

function seed(): string {
  return fs.readFileSync(SEED, "utf8");
}

/** The `do update set ...` clause of the devices upsert, lower-cased. */
function devicesUpdateClause(sql: string): string {
  const start = sql.toLowerCase().indexOf("insert into public.devices");
  assert.ok(start !== -1, "the devices seed statement is gone");
  const statement = sql.slice(start).split(";")[0].toLowerCase();
  const update = statement.indexOf("do update");
  return update === -1 ? "" : statement.slice(update);
}

describe("pilot seed — device secrets", () => {
  it("seeds only the three canonical field nodes", () => {
    const sql = seed();
    for (const fixture of ["STATION_04", "STATION_05", "Brackish Edge", "Mangrove Spur"]) {
      assert.ok(!sql.includes(fixture), `fixture ${fixture} must not be seeded into a production-shaped database`);
    }
    for (const station of ["STATION_01", "STATION_02", "STATION_03"]) {
      assert.ok(sql.includes(station), `canonical node ${station} missing from seed`);
    }
  });

  it("never overwrites device_secret on conflict", () => {
    const clause = devicesUpdateClause(seed());
    assert.ok(clause.length > 0, "expected an upsert with a do-update clause");
    assert.ok(
      !/device_secret\s*=/.test(clause),
      "the seed would reset every rotated production device secret on the next `db:migrate`",
    );
  });

  it("still upserts the non-secret columns, so the seed stays useful", () => {
    const clause = devicesUpdateClause(seed());
    for (const column of ["station_id", "status", "kind"]) {
      assert.match(clause, new RegExp(`${column}\\s*=`), `${column} should still be reconciled`);
    }
  });

  it("keeps the warning that these values are public", () => {
    // The next person to touch this file needs to know why device_secret is
    // deliberately absent above.
    const sql = seed().toLowerCase();
    assert.ok(
      sql.includes("public") && sql.includes("rotate"),
      "the seed must state that its secrets are public and must be rotated",
    );
  });
});
