import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * I-18: the public water view reads water_ec_ms_cm / water_temp_c, while older
 * ingest builds wrote ec_ms_cm / temperature_c. These are source-level guards
 * on the repair; they do not prove the live database state.
 */
const root = path.join(process.cwd(), "..", "..");
const migration = fs
  .readFileSync(path.join(root, "infra", "supabase", "migrations", "035_mirror_water_ec_temperature.sql"), "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const ingestDb = fs.readFileSync(path.join(root, "services", "edge-ingestion", "src", "supabaseDb.ts"), "utf8");

describe("water EC/temperature column mirror", () => {
  it("copies only into empty public columns and never overwrites", () => {
    assert.match(migration, /new\.water_ec_ms_cm is null and new\.ec_ms_cm is not null/);
    assert.match(migration, /new\.water_temp_c is null and new\.temperature_c is not null/);
    assert.match(migration, /coalesce\(water_ec_ms_cm, ec_ms_cm\)/);
    assert.match(migration, /coalesce\(water_temp_c, temperature_c\)/);
  });

  it("never computes or touches salinity", () => {
    assert.ok(!/salinity/i.test(migration));
  });

  it("is non-destructive", () => {
    assert.ok(!/\b(delete|truncate|drop\s+(table|column|schema))\b/i.test(migration));
  });

  it("current ingest writes both column pairs from the same value", () => {
    assert.match(ingestDb, /water_ec_ms_cm:\s*row\.ec_ms_cm/);
    assert.match(ingestDb, /water_temp_c:\s*row\.temperature_c/);
  });
});
