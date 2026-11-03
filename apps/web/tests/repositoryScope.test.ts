import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStationIdScope,
  applyStationScope,
  canAccessStation,
  NO_ACCESS_STATION_ID,
  scopedStationIds,
} from "@/lib/repositories/base";
import type { RepositoryScope } from "@/types";

function mockQuery() {
  const calls: { method: string; args: unknown[] }[] = [];
  const query = {
    in(col: string, vals: string[]) {
      calls.push({ method: "in", args: [col, vals] });
      return query;
    },
    calls,
  };
  return query;
}

const farmerScope: RepositoryScope = {
  userId: "farmer-1",
  role: "farmer",
  stationIds: ["STATION_01"],
};

const unassignedFarmer: RepositoryScope = {
  userId: "farmer-2",
  role: "farmer",
  stationIds: [],
};

const adminScope: RepositoryScope = {
  userId: "admin-1",
  role: "admin",
  stationIds: [],
};

// Matches PUBLIC_READ_SCOPE (lib/publicRead.ts) exactly — regression guard
// for the role: "admin" -> "public" rename: behavior must be identical to
// admin scope for read-filtering purposes, only the label changed.
const publicScope: RepositoryScope = {
  userId: "public-read",
  role: "public",
  stationIds: [],
};

describe("repository scope helpers", () => {
  it("admin scope does not filter station queries", () => {
    const query = mockQuery();
    applyStationScope(query, adminScope);
    assert.equal(query.calls.length, 0);
  });

  it("public scope (PUBLIC_READ_SCOPE's role) does not filter station queries — same as admin", () => {
    const query = mockQuery();
    applyStationScope(query, publicScope);
    assert.equal(query.calls.length, 0);
    assert.equal(scopedStationIds(publicScope), null);
    assert.equal(canAccessStation(publicScope, "STATION_01"), true);
    assert.equal(canAccessStation(publicScope, "STATION_99"), true);
  });

  it("farmer scope filters to assigned station IDs", () => {
    const query = mockQuery();
    applyStationScope(query, farmerScope);
    assert.deepEqual(query.calls[0]?.args, ["station_id", ["STATION_01"]]);
  });

  it("unassigned farmer gets no-access sentinel", () => {
    assert.deepEqual(scopedStationIds(unassignedFarmer), [NO_ACCESS_STATION_ID]);
    const query = mockQuery();
    applyStationIdScope(query, unassignedFarmer);
    assert.deepEqual(query.calls[0]?.args, ["id", [NO_ACCESS_STATION_ID]]);
  });

  it("canAccessStation enforces farmer assignments", () => {
    assert.equal(canAccessStation(farmerScope, "STATION_01"), true);
    assert.equal(canAccessStation(farmerScope, "STATION_02"), false);
    assert.equal(canAccessStation(adminScope, "STATION_02"), true);
    assert.equal(canAccessStation(unassignedFarmer, "STATION_01"), false);
  });
});
