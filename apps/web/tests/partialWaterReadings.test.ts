import test from "node:test";
import assert from "node:assert/strict";
import { ReadingRepository } from "../lib/repositories/readingRepository";
import type { AppSupabase } from "../lib/repositories/base";
import type { RepositoryScope } from "../types";

const scope: RepositoryScope = { userId: "public", role: "public", stationIds: [] };
const partial = { id: "fixture", message_id: "fixture", station_id: "STATION_01", timestamp: new Date().toISOString(), salinity: null, water_level: 0, water_ec_ms_cm: null, water_temp_c: null, fault_flags: 1, ec_probe_status: "fault", ultrasonic_status: "ok" };
function client(): AppSupabase {
  const result = { data: [partial], error: null };
  const query = { select: () => query, eq: () => query, gte: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: partial, error: null }), then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  return { from: () => query } as unknown as AppSupabase;
}
test("SSR reading mapping preserves missing salinity and a genuine zero water level", async () => {
  const reading = await new ReadingRepository(client()).getLatestByStation("STATION_01", scope);
  assert.equal(reading?.salinity, null);
  assert.equal(reading?.water_level, 0);
});
test("history never plots or averages a missing water measurement as zero", async () => {
  const repository = new ReadingRepository(client());
  const trend = await repository.getTrend24h("STATION_01", scope);
  assert.equal(trend[0].salinity, null);
  assert.equal(trend[0].water_level, 0);
  const daily = await repository.getDailyComparison(scope, 1);
  assert.equal(daily[0].salinity, null);
  assert.equal(daily[0].tideLevel, 0);
});
