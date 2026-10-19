import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadingRepository } from "@/lib/repositories/readingRepository";
import type { AppSupabase } from "@/lib/repositories/base";
import type { RepositoryScope } from "@/types";

function fakeSupabase(data: Record<string, unknown> | null, error: { code: string } | null = null) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
    select(cols: string) {
      calls.push({ method: "select", args: [cols] });
      return chain;
    },
    eq(col: string, val: unknown) {
      calls.push({ method: "eq", args: [col, val] });
      return chain;
    },
    order(col: string, opts: unknown) {
      calls.push({ method: "order", args: [col, opts] });
      return chain;
    },
    limit(n: number) {
      calls.push({ method: "limit", args: [n] });
      return chain;
    },
    async maybeSingle() {
      return { data, error };
    },
  };
  return { client: chain as unknown as AppSupabase, calls };
}

const adminScope: RepositoryScope = { userId: "admin-1", role: "admin", stationIds: [] };
const unassignedFarmer: RepositoryScope = { userId: "farmer-2", role: "farmer", stationIds: [] };

describe("ReadingRepository.getLatestSoilReadingByStation", () => {
  it("returns null without querying when the scope cannot access the station", async () => {
    const { client, calls } = fakeSupabase(null);
    const repo = new ReadingRepository(client);
    const result = await repo.getLatestSoilReadingByStation("STATION_02", unassignedFarmer);
    assert.equal(result, null);
    assert.equal(calls.length, 0);
  });

  it("queries soil_readings scoped to the station and reads the latest row", async () => {
    const { client, calls } = fakeSupabase({
      id: "reading-1",
      message_id: "msg-1",
      station_id: "STATION_02",
      air_temp_c: "28.4",
      air_humidity_pct: null,
      soil_temp_c: null,
      soil_moisture_pct: "41.2",
      soil_ec_ms_cm: null,
      soil_ph: null,
      fault_flags: 2,
      timestamp: "2026-06-01T00:00:00Z",
      created_at: "2026-06-01T00:00:01Z",
    });
    const repo = new ReadingRepository(client);
    const result = await repo.getLatestSoilReadingByStation("STATION_02", adminScope);

    assert.deepEqual(calls[0], { method: "from", args: ["soil_readings"] });
    assert.deepEqual(
      calls.find((c) => c.method === "eq"),
      { method: "eq", args: ["station_id", "STATION_02"] },
    );

    // Never fabricate a value for a sensor that didn't report — null in, null out.
    assert.ok(result);
    assert.equal(result?.air_temp_c, 28.4);
    assert.equal(result?.air_humidity_pct, null);
    assert.equal(result?.soil_temp_c, null);
    assert.equal(result?.soil_moisture_pct, 41.2);
    assert.equal(result?.soil_ec_ms_cm, null);
    assert.equal(result?.soil_ph, null);
    assert.equal(result?.fault_flags, 2);
  });

  it("returns null when no reading exists for the station", async () => {
    const { client } = fakeSupabase(null);
    const repo = new ReadingRepository(client);
    const result = await repo.getLatestSoilReadingByStation("STATION_04", adminScope);
    assert.equal(result, null);
  });

  it("returns null (not a throw) when the table is missing", async () => {
    const { client } = fakeSupabase(null, { code: "PGRST205" });
    const repo = new ReadingRepository(client);
    const result = await repo.getLatestSoilReadingByStation("STATION_02", adminScope);
    assert.equal(result, null);
  });
});
