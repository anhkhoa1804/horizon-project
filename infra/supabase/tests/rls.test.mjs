import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  asAuthenticatedUser,
  assignStation,
  createAppUser,
  createAuthUser,
  loadEnv,
  withClient,
} from "./helpers.mjs";

loadEnv();

const RUN_RLS = process.env.RUN_RLS_TESTS === "1";

async function anonSelect(table, headers) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { skip: "SUPABASE_URL or SUPABASE_ANON_KEY not set" };
  }

  const jwtPayload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
  if (jwtPayload.role !== "anon") {
    return { skip: `SUPABASE_ANON_KEY must be anon JWT (got role=${jwtPayload.role}) — fix .env.supabase` };
  }

  const response = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", ...headers },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

describe("production RLS policies", { skip: !RUN_RLS }, () => {
  // Migration 018/019 deliberately restored anon SELECT for exactly six
  // tables — this is the current, intended public-transparency boundary
  // (see docs/ARCHITECTURE.md's "Data domains and source of truth" table),
  // not the migration-012-era "anon reads everything blocked" world these
  // tests used to assert. Row *count* is never asserted here — that's seed
  // data, not an architectural invariant (see docs/ARCHITECTURE.md's
  // "Station topology" section) — only whether the read is structurally
  // permitted.
  for (const table of [
    "stations",
    "environmental_readings",
    "environmental_events",
    "station_health_logs",
    "crop_thresholds",
    "soil_readings",
  ]) {
    it(`anon can read ${table} via PostgREST (migration 018/019 public grant)`, async (t) => {
      const result = await anonSelect(table);
      if (result.skip) {
        t.skip(result.skip);
        return;
      }
      assert.equal(result.status, 200, `expected a successful read, got ${result.status}: ${JSON.stringify(result.body)}`);
      assert.ok(Array.isArray(result.body), "expected an array response, even if empty");
    });
  }

  // No anon grant exists for these — either PostgREST returns 401 (no
  // table-level GRANT) or 200 with an empty array (RLS present but no
  // matching policy). Either is "not readable"; only a populated 200
  // response would be a real leak.
  for (const table of ["devices", "ingestion_audit_logs", "users", "damage_logs", "admin_allowed_emails"]) {
    it(`anon cannot read ${table}`, async (t) => {
      const result = await anonSelect(table);
      if (result.skip) {
        t.skip(result.skip);
        return;
      }
      const leaked = result.status === 200 && Array.isArray(result.body) && result.body.length > 0;
      assert.ok(!leaked, `${table} leaked ${Array.isArray(result.body) ? result.body.length : "?"} row(s) to anon`);
    });
  }

  it("farmer A cannot read farmer B assigned stations", async () => {
    const farmerA = randomUUID();
    const farmerB = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: farmerA, email: `farmer-a-${farmerA}@test.local` });
      await createAppUser(client, { id: farmerB, email: `farmer-b-${farmerB}@test.local` });
      await assignStation(client, { userId: farmerA, stationId: "STATION_01" });
      await assignStation(client, { userId: farmerB, stationId: "STATION_02" });

      let farmerAStations = [];
      await asAuthenticatedUser(client, farmerA, async (scoped) => {
        const { rows } = await scoped.query(`select id from public.stations order by id`);
        farmerAStations = rows.map((r) => r.id);
      });

      return farmerAStations;
    });

    if (outcome.skipped) {
      return;
    }

    assert.deepEqual(outcome.value, ["STATION_01"]);
    assert.ok(!outcome.value.includes("STATION_02"));
  });

  it("farmer cannot read unassigned environmental_readings", async () => {
    const farmerId = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: farmerId, email: `farmer-readings-${farmerId}@test.local` });
      await assignStation(client, { userId: farmerId, stationId: "STATION_01" });

      let count = -1;
      await asAuthenticatedUser(client, farmerId, async (scoped) => {
        const { rows } = await scoped.query(
          `select count(*)::int as count from public.environmental_readings where station_id = 'STATION_02'`,
        );
        count = rows[0].count;
      });

      return count;
    });

    if (outcome.skipped) {
      return;
    }

    assert.equal(outcome.value, 0);
  });

  it("admin sees every station a superuser connection sees — no per-user filtering applies", async () => {
    // Deliberately not asserting a specific row count: how many stations
    // exist is seed/pilot data (see docs/ARCHITECTURE.md's "Station
    // topology" — STATION_04/05 are seed artifacts, not an architectural
    // invariant), and a test tied to that number would keep "passing" for
    // the wrong reason even if admin's RLS bypass silently broke, as long
    // as row count coincidentally stayed the same. The actual invariant is
    // comparative: an admin-scoped authenticated read must return the same
    // count as an unfiltered superuser read of the same table.
    const adminId = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: adminId, email: `admin-${adminId}@test.local`, role: "admin" });

      const { rows: unfiltered } = await client.query(`select count(*)::int as count from public.stations`);

      let adminCount = -1;
      await asAuthenticatedUser(client, adminId, async (scoped) => {
        const { rows } = await scoped.query(`select count(*)::int as count from public.stations`);
        adminCount = rows[0].count;
      });

      return { unfiltered: unfiltered[0].count, adminCount };
    });

    if (outcome.skipped) {
      return;
    }

    assert.equal(outcome.value.adminCount, outcome.value.unfiltered);
  });

  it("ensure_user_profile creates farmer profile idempotently", async () => {
    const userId = randomUUID();

    const outcome = await withClient(async (client) => {
      const email = `bootstrap-${userId}@test.local`;
      await createAuthUser(client, { id: userId, email });

      let firstRole;
      let secondRole;

      await asAuthenticatedUser(client, userId, async (scoped) => {
        const first = await scoped.query(
          `select (public.ensure_user_profile($1, $2)).role as role`,
          [userId, email],
        );
        firstRole = first.rows[0].role;

        const second = await scoped.query(
          `select (public.ensure_user_profile($1, $2)).role as role`,
          [userId, email],
        );
        secondRole = second.rows[0].role;
      });

      return { firstRole, secondRole };
    });

    if (outcome.skipped) {
      return;
    }

    assert.equal(outcome.value.firstRole, "farmer");
    assert.equal(outcome.value.secondRole, "farmer");
  });
});
