import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(
  path.join(process.cwd(), "app", "api", "public", "gateway", "route.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "..",
    "..",
    "infra",
    "supabase",
    "migrations",
    "025_gateway_observation_promotion.sql",
  ),
  "utf8",
);

describe("gateway observation promotion", () => {
  it("unwraps the station payload before writing typed telemetry", () => {
    assert.match(route, /function stationPayload/);
    assert.match(route, /writeTypedObservation\(station, receivedAt\)/);
    assert.match(route, /station_id: typeof station\.station_id/);
  });

  it("keeps unknown sensor status explicit rather than inventing ok", () => {
    assert.match(route, /: "unknown"/);
    assert.match(migration, /'ok', 'warn', 'fault', 'unknown'/);
  });

  it("backfills both real station domains by message id", () => {
    assert.match(migration, /STATION_01/);
    assert.match(migration, /STATION_02/);
    assert.match(migration, /on conflict \(message_id\)/);
    assert.match(migration, /water_ec_ms_cm/);
    assert.match(migration, /water_temp_c/);
    assert.match(migration, /soil_moisture_pct/);
  });

  it("never derives EC from salinity or salinity from EC", () => {
    assert.doesNotMatch(migration, /0\.64|640\s*\*/);
    assert.match(migration, /reading ->> 'ec_ms_cm'/);
    assert.match(migration, /reading ->> 'salinity_ppt'/);
  });
});
