import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadingRepository } from "@/lib/repositories/readingRepository";
import type { AppSupabase } from "@/lib/repositories/base";
import type { RepositoryScope } from "@/types";

/**
 * getDailySoilTrend awaits the query builder directly, so the fake chain is
 * thenable. Only the station filter and range are asserted on the query
 * itself; the interesting behaviour is the bucketing done in JS afterwards.
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
    order(col: string, opts: unknown) {
      calls.push({ method: "order", args: [col, opts] });
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

/** An ISO instant `daysAgo` days back, at a given Asia/Ho_Chi_Minh wall-clock hour. */
function localDaysAgo(daysAgo: number, localHour: number, localMinute = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  // Subtract from Cồn Hô's calendar day, not from the runner's UTC day. CI
  // runs in UTC, where 00:00–06:59 Vietnam time is already tomorrow locally.
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - daysAgo));
  // Build the instant that reads as `localHour:localMinute` in UTC+7.
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  return new Date(Date.UTC(y, m, d, localHour - 7, localMinute)).toISOString();
}

function soilRow(timestamp: string, overrides: Record<string, unknown> = {}) {
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

describe("ReadingRepository.getDailySoilTrend", () => {
  it("returns a full set of empty day slots when the scope cannot access the station", async () => {
    const { client, calls } = fakeSupabase([]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", unassignedFarmer, 7);

    assert.equal(calls.length, 0, "must not query at all");
    assert.equal(result.length, 7, "shape is preserved so the chart keeps its day slots");
    assert.ok(result.every((d) => d.soil_moisture_pct === null && d.readingCount === 0));
  });

  it("returns one entry per requested day for 7D and 30D", async () => {
    for (const days of [7, 30]) {
      const { client } = fakeSupabase([]);
      const repo = new ReadingRepository(client);
      const result = await repo.getDailySoilTrend("STATION_02", adminScope, days);
      assert.equal(result.length, days, `expected ${days} buckets`);
    }
  });

  it("filters to the requested station only", async () => {
    const { client, calls } = fakeSupabase([soilRow(localDaysAgo(1, 9))]);
    const repo = new ReadingRepository(client);
    await repo.getDailySoilTrend("STATION_02", adminScope, 7);

    assert.deepEqual(calls[0], { method: "from", args: ["soil_readings"] });
    const eqCalls = calls.filter((c) => c.method === "eq");
    assert.equal(eqCalls.length, 1);
    assert.deepEqual(eqCalls[0], { method: "eq", args: ["station_id", "STATION_02"] });
  });

  it("averages each metric independently within a day", async () => {
    const day = 2;
    const { client } = fakeSupabase([
      soilRow(localDaysAgo(day, 8), { soil_moisture_pct: "40.0", soil_ec_ms_cm: "1.00" }),
      soilRow(localDaysAgo(day, 14), { soil_moisture_pct: "60.0", soil_ec_ms_cm: "1.40" }),
    ]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);
    const bucket = result.find((d) => d.readingCount === 2);

    assert.ok(bucket, "both readings landed in one day bucket");
    assert.equal(bucket.soil_moisture_pct, 50);
    assert.equal(bucket.soil_ec_ms_cm, 1.2);
    assert.equal(bucket.soil_temp_c, 28);
  });

  it("keeps a metric null when only that probe was silent, without suppressing the others", async () => {
    const day = 1;
    const { client } = fakeSupabase([
      soilRow(localDaysAgo(day, 9), { soil_ph: null, soil_ec_ms_cm: null }),
      soilRow(localDaysAgo(day, 15), { soil_ph: null, soil_ec_ms_cm: null }),
    ]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);
    const bucket = result.find((d) => d.readingCount === 2);

    assert.ok(bucket);
    // Silent probes stay null — never averaged down toward zero.
    assert.equal(bucket.soil_ph, null);
    assert.equal(bucket.soil_ec_ms_cm, null);
    // Probes that did report are unaffected.
    assert.equal(bucket.soil_moisture_pct, 50);
    assert.equal(bucket.air_temp_c, 30);
  });

  it("does not let a null probe drag an average toward zero", async () => {
    const day = 3;
    const { client } = fakeSupabase([
      soilRow(localDaysAgo(day, 8), { soil_moisture_pct: "60.0" }),
      soilRow(localDaysAgo(day, 12), { soil_moisture_pct: null }),
    ]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);
    const bucket = result.find((d) => d.readingCount === 2);

    assert.ok(bucket);
    // Mean of [60], not of [60, 0].
    assert.equal(bucket.soil_moisture_pct, 60);
  });

  it("returns days in chronological order, oldest first", async () => {
    const { client } = fakeSupabase([]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 5);

    assert.equal(result.length, 5);
    // Labels are dd/MM; the last slot is today.
    const todayLabel = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
    assert.equal(result[result.length - 1].date, todayLabel);
  });

  it("buckets a late-evening reading into its Asia/Ho_Chi_Minh day, not the next UTC day", async () => {
    // 23:30 local on the day before yesterday is 16:30Z the same date —
    // bucketing on the raw UTC date would still agree here, so pair it with
    // a 00:30 local reading that IS on a different UTC date.
    const lateLocal = localDaysAgo(2, 23, 30); // 23:30 +07
    const earlyLocal = localDaysAgo(1, 0, 30); // 00:30 +07, one hour later

    const { client } = fakeSupabase([soilRow(lateLocal), soilRow(earlyLocal)]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);

    const populated = result.filter((d) => d.readingCount > 0);
    assert.equal(populated.length, 2, "an hour apart but on different local days → two buckets");
    assert.ok(populated.every((d) => d.readingCount === 1));
  });

  it("returns empty day slots (not a throw) when the table is missing", async () => {
    const { client } = fakeSupabase(null, { code: "PGRST205" });
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);

    assert.equal(result.length, 7);
    assert.ok(result.every((d) => d.readingCount === 0 && d.soil_ph === null));
  });

  it("leaves days with no readings fully null rather than dropping them", async () => {
    const { client } = fakeSupabase([soilRow(localDaysAgo(0, 10))]);
    const repo = new ReadingRepository(client);
    const result = await repo.getDailySoilTrend("STATION_02", adminScope, 7);

    assert.equal(result.length, 7, "gaps stay visible in the series");
    const empty = result.filter((d) => d.readingCount === 0);
    assert.equal(empty.length, 6);
    assert.ok(empty.every((d) => d.soil_moisture_pct === null));
  });
});
