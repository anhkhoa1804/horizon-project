import { MockDb, ingestTelemetry } from "../src/index.js";
import type { IngestConfig } from "../src/ingest.js";
import type { IngestRequest, TelemetryPayloadV1 } from "../src/types.js";

const now = Math.floor(Date.now() / 1000);

const payload: TelemetryPayloadV1 = {
  contract_version: "v1",
  device_id: "STATION_01",
  message_id: "a4d216c0-c43f-48f4-9eb1-52f8b470e1b2",
  timestamp: now,
  salinity: 1.42,
  water_level: 52,
  fault_flags: 0,
  sensor_status: { ec_probe: "ok", ultrasonic: "ok" },
  battery_voltage: 3.92,
  signal_strength_dbm: -85,
  firmware_version: "1.0.2",
  temperature_c: 30.8,
};

const config: IngestConfig = {
  allowedContractVersion: "v1",
  maxTimestampDriftSeconds: 300,
  gatewayIngestToken: "gateway-token-01",
};

const db = new MockDb(
  { STATION_01: "station-secret-01" },
  {
    STATION_01: {
      update_available: true,
      target_version: "1.0.3",
      binary_url: "https://github.com/org/repo/releases/download/v1.0.3/esp32-node.bin",
      sha256: "mock_sha256",
      size_bytes: 1432200,
    },
  },
);

function buildRequest(body: TelemetryPayloadV1): IngestRequest {
  return {
    headers: {
      "x-gateway-token": "gateway-token-01",
      "x-contract-version": body.contract_version,
    },
    payload: body,
  };
}

const firstResponse = await ingestTelemetry(buildRequest(payload), db, config, now);
const duplicateResponse = await ingestTelemetry(buildRequest(payload), db, config, now + 1);

const faultyPayload: TelemetryPayloadV1 = {
  ...payload,
  message_id: "1b458aca-9c70-41be-aeec-ccdb2323f9f4",
  fault_flags: 1,
  sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
};
const faultyResponse = await ingestTelemetry(buildRequest(faultyPayload), db, config, now + 2);

console.log("inserted:", firstResponse);
console.log("duplicate:", duplicateResponse);
console.log("sensor_fault:", faultyResponse);
console.log("db_snapshot:", db.getSnapshot());
