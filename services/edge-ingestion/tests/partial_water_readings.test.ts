import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingestTelemetry, type IngestConfig } from "../src/ingest.js";
import { MockDb } from "../src/mockDb.js";
import type { IngestRequest, TelemetryPayloadV1 } from "../src/types.js";

const NOW = 1_700_000_000;
const GATEWAY_TEST_TOKEN = "unit-test-gateway-token";

const config: IngestConfig = {
  allowedContractVersion: "v1",
  maxTimestampDriftSeconds: 300,
  gatewayIngestToken: GATEWAY_TEST_TOKEN,
};

function waterPayload(overrides: Partial<TelemetryPayloadV1> = {}): TelemetryPayloadV1 {
  return {
    contract_version: "v1",
    reading_kind: "water",
    device_id: "STATION_01",
    message_id: "partial-water-default",
    timestamp: NOW,
    salinity: 1.2,
    water_level: 278.7,
    distance_cm: 71.3,
    fault_flags: 0,
    sensor_status: { ec_probe: "ok", ultrasonic: "ok" },
    firmware_version: "station1-test",
    ...overrides,
  };
}

function request(payload: TelemetryPayloadV1): IngestRequest {
  return {
    headers: { "x-gateway-token": GATEWAY_TEST_TOKEN, "x-contract-version": "v1" },
    payload,
  };
}

describe("partial Station 1 water readings", () => {
  it("persists ultrasonic data with unavailable EC/salinity as null", async () => {
    const db = new MockDb({}, {}, ["STATION_01"]);
    const payload = waterPayload({
      message_id: "partial-water-ultrasonic-only",
      salinity: undefined,
      ec_ms_cm: undefined,
      fault_flags: 1,
      sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
    });

    const response = await ingestTelemetry(request(payload), db, config, NOW);
    assert.equal(response.ok, true);
    const row = db.getSnapshot().environmentalReadings[0];
    assert.equal(row?.distance_cm, 71.3);
    assert.equal(row?.water_level, 278.7);
    assert.equal(row?.ec_ms_cm, null);
    assert.equal(row?.salinity, null);
  });

  it("persists EC/salinity data with unavailable ultrasonic data as null", async () => {
    const db = new MockDb({}, {}, ["STATION_01"]);
    const payload = waterPayload({
      message_id: "partial-water-ec-only",
      water_level: undefined,
      distance_cm: undefined,
      ec_ms_cm: 1.4,
      salinity: 0.8,
      fault_flags: 2,
      sensor_status: { ec_probe: "ok", ultrasonic: "fault" },
    });

    const response = await ingestTelemetry(request(payload), db, config, NOW);
    assert.equal(response.ok, true);
    const row = db.getSnapshot().environmentalReadings[0];
    assert.equal(row?.salinity, 0.8);
    assert.equal(row?.ec_ms_cm, 1.4);
    assert.equal(row?.water_level, null);
    assert.equal(row?.distance_cm, null);
  });

  it("continues to reject an empty water payload with no health signal", async () => {
    const db = new MockDb({}, {}, ["STATION_01"]);
    const payload = waterPayload({
      message_id: "partial-water-empty",
      salinity: undefined,
      water_level: undefined,
      distance_cm: undefined,
      fault_flags: 3,
      sensor_status: { ec_probe: "fault", ultrasonic: "fault" },
    });

    const response = await ingestTelemetry(request(payload), db, config, NOW);
    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
    }
    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
  });
});
