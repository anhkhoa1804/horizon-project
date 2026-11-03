import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadingRepository } from "@/lib/repositories/readingRepository";
import type { AppSupabase } from "@/lib/repositories/base";
import type { RepositoryScope } from "@/types";

/**
 * Multi-row variant of the fake client used by soilReadingRepository.test.ts.
 * getSoilTrend awaits the builder directly rather than calling maybeSingle(),
 * so the chain is thenable; `gte`/`lte` are recorded so range filtering can
 * be asserted.
 *
 * `rows` is what the fake "database" holds. It is returned as-is, mirroring
 * how PostgREST would answer the built query — the tests assert on the
 * arguments the repository sent plus the shape it maps back.
 */
function fakeSupabase(rows: Record<string, unknown>[] | null, error: { code: string } | null = null) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {
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
    gte(col: string, val: unknown) {
      calls.push({ method: "gte", args: [col, val] });
      return chain;
    },
    lte(col: string, val: unknown) {
      calls.push({ method: "lte", args: [col, val] });
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
    then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve({ data: rows, error }).then(resolve);
    },
  };
  return { client: chain as unknown as AppSupabase, calls };
}

const adminScope: RepositoryScope = { userId: "admin-1", role: "admin", stationIds: [] };
const unassignedFarmer: RepositoryScope = { userId: "farmer-2", role: "farmer", stationIds: [] };

/** Newest-first, as the descending query would return them. */
function row(timestamp: string, overrides: Record<string, unknown> = {}) {
  return {
    timestamp,
    air_temp_c: "30.0",
    air_humidity_pct: "70.0",
    soil_temp_c: "28.0",
    soil_moisture_pct: "50.0",
    soil_ec_ms_cm: "1.20",
    soil_ph: "6.2",
    ...overrides,
  };
}

describe("ReadingRepository.getSoilTrend", () => {
  it("returns an empty array without querying when the scope cannot access the station", async () => {
    const { client, calls } = fakeSupabase([]);
    const repo = new ReadingRepository(client);
    const result = await repo.getSoilTrend("STATION_02", unassignedFarmer);
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });

  it("queries soil_readings filtered to the requested station only", async () => {
    const { client, calls } = fakeSupabase([row("2026-06-01T03:00:00Z")]);
    const repo = new ReadingRepository(client);
    await repo.getSoilTrend("STATION_02", adminScope);

    assert.deepEqual(calls[0], { method: "from", args: ["soil_readings"] });
    const eqCalls = calls.filter((c) => c.method === "eq");
    assert.equal(eqCalls.length, 1, "exactly one station filter — never a mixed-station series");
    assert.deepEqual(eqCalls[0], { method: "eq", args: ["station_id", "STATION_02"] });
  });

  it("returns points in chronological order, oldest first", async () => {
    // Descending, as the query asks the database for.
    const { client } = fakeSupabase([
      row("2026-06-01T05:00:00Z"),
      row("2026-06-01T04:00:00Z"),
      row("2026-06-01T03:00:00Z"),
    ]);
    const repo = new ReadingRepository(client);
    const result = await repo.getSoilTrend("STATION_02", adminScope);

    assert.deepEqual(
      result.map((p) => p.timestamp),
      ["2026-06-01T03:00:00Z", "2026-06-01T04:00:00Z", "2026-06-01T05:00:00Z"],
    );
  });

  it("orders by observation timestamp descending, then reverses — never by created_at", async () => {
    const { client, calls } = fakeSupabase([row("2026-06-01T03:00:00Z")]);
    const repo = new ReadingRepository(client);
    await repo.getSoilTrend("STATION_02", adminScope);

    const orderCall = calls.find((c) => c.method === "order");
    assert.deepEqual(orderCall, { method: "order", args: ["timestamp", { ascending: false }] });
    // created_at is insertion time; a queued/retried gateway send would sort wrong.
    assert.ok(!calls.some((c) => JSON.stringify(c.args).includes("created_at")));
  });

  it("returns an empty array for a station with no rows", async () => {
    const { client } = fakeSupabase([]);
    const repo = new ReadingRepository(client);
    const result = await repo.getSoilTrend("STATION_02", adminScope);
    assert.deepEqual(result, []);
  });

  it("preserves null measurements instead of substituting zero", async () => {
    const { client } = fakeSupabase([
      row("2026-06-01T03:00:00Z", {
        soil_ec_ms_cm: null,
        soil_ph: null,
        air_humidity_pct: null,
      }),
    ]);
    const repo = new ReadingRepository(client);
    const [point] = await repo.getSoilTrend("STATION_02", adminScope);

    assert.equal(point.soil_ec_ms_cm, null);
    assert.equal(point.soil_ph, null);
    assert.equal(point.air_humidity_pct, null);
    // Sensors that did report are still parsed to numbers.
    assert.equal(point.soil_moisture_pct, 50);
    assert.equal(point.soil_temp_c, 28);
  });

  it("applies both ends of a time range when given", async () => {
    const { client, calls } = fakeSupabase([row("2026-06-01T03:00:00Z")]);
    const repo = new ReadingRepository(client);
    await repo.getSoilTrend("STATION_02", adminScope, {
      sinceIso: "2026-05-31T00:00:00Z",
      untilIso: "2026-06-02T00:00:00Z",
    });

    assert.deepEqual(
      calls.find((c) => c.method === "gte"),
      { method: "gte", args: ["timestamp", "2026-05-31T00:00:00Z"] },
    );
    assert.deepEqual(
      calls.find((c) => c.method === "lte"),
      { method: "lte", args: ["timestamp", "2026-06-02T00:00:00Z"] },
    );
  });

  it("omits range filters entirely when no range is given", async () => {
    const { client, calls } = fakeSupabase([row("2026-06-01T03:00:00Z")]);
    const repo = new ReadingRepository(client);
    await repo.getSoilTrend("STATION_02", adminScope);

    assert.ok(!calls.some((c) => c.method === "gte"));
    assert.ok(!calls.some((c) => c.method === "lte"));
  });

  it("applies a default row cap, and honours an explicit one", async () => {
    const { client: c1, calls: calls1 } = fakeSupabase([]);
    await new ReadingRepository(c1).getSoilTrend("STATION_02", adminScope);
    assert.deepEqual(calls1.find((c) => c.method === "limit"), { method: "limit", args: [1000] });

    const { client: c2, calls: calls2 } = fakeSupabase([]);
    await new ReadingRepository(c2).getSoilTrend("STATION_02", adminScope, { limit: 50 });
    assert.deepEqual(calls2.find((c) => c.method === "limit"), { method: "limit", args: [50] });
  });

  it("returns an empty array (not a throw) when the table is missing", async () => {
    const { client } = fakeSupabase(null, { code: "PGRST205" });
    const repo = new ReadingRepository(client);
    const result = await repo.getSoilTrend("STATION_02", adminScope);
    assert.deepEqual(result, []);
  });

  it("keeps ordering correct across a date boundary in Vietnam local time", async () => {
    // 23:30 and 00:30 Asia/Ho_Chi_Minh (UTC+7) sit either side of local
    // midnight but are only an hour apart — ordering must follow the instant,
    // not the local calendar date.
    const { client } = fakeSupabase([
      row("2026-06-01T17:30:00Z"), // 2026-06-02 00:30 +07
      row("2026-06-01T16:30:00Z"), // 2026-06-01 23:30 +07
    ]);
    const repo = new ReadingRepository(client);
    const result = await repo.getSoilTrend("STATION_02", adminScope);

    assert.deepEqual(
      result.map((p) => p.timestamp),
      ["2026-06-01T16:30:00Z", "2026-06-01T17:30:00Z"],
    );
  });
});
