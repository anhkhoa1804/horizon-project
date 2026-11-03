import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Regression for the Admin CSV export: it selected `soil_ec` and put air
 * temperature/humidity on the water table, neither of which exists, so
 * PostgREST rejected the query and every export failed with 502. The column
 * lists in the route must name columns that the migrations actually create.
 */
const root = path.resolve(process.cwd(), "../..");
const migrations = readdirSync(path.join(root, "infra/supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(root, "infra/supabase/migrations", file), "utf8"))
  .join("\n");
const route = readFileSync(path.join(process.cwd(), "app/admin/export/route.ts"), "utf8");

function columnsOf(constant: string): string[] {
  const match = new RegExp(`const ${constant} =\\s*"([^"]+)"`).exec(route);
  assert.ok(match, `${constant} not found in export route`);
  return match[1].split(",").map((c) => c.trim());
}

function tableBlock(table: string): string {
  const start = migrations.indexOf(`create table if not exists public.${table} (`);
  assert.ok(start >= 0, `${table} not created by migrations`);
  const end = migrations.indexOf("\n);", start);
  const created = migrations.slice(start, end);
  const alters = [...migrations.matchAll(new RegExp(`alter table public\\.${table}[\\s\\S]*?;`, "g"))].map((m) => m[0]).join("\n");
  return `${created}\n${alters}`;
}

describe("admin export column lists match the schema", () => {
  for (const [constant, table] of [
    ["WATER_COLUMNS", "environmental_readings"],
    ["SOIL_COLUMNS", "soil_readings"],
  ] as const) {
    it(`${constant} only names columns of ${table}`, () => {
      const block = tableBlock(table);
      for (const column of columnsOf(constant)) {
        assert.match(block, new RegExp(`\\b${column}\\b`), `${table}.${column} is not defined by any migration`);
      }
    });
  }

  it("does not reintroduce the nonexistent soil_ec column", () => {
    assert.ok(!columnsOf("SOIL_COLUMNS").includes("soil_ec"));
    assert.ok(!columnsOf("WATER_COLUMNS").includes("air_temp_c"));
  });
});
