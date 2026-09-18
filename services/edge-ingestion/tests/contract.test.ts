import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signPayload } from "../src/canonical.js";
import { handleIngestRequest } from "../src/httpHandler.js";
import { ingestTelemetry } from "../src/ingest.js";
import { MockDb } from "../src/mockDb.js";
import type { IngestConfig } from "../src/ingest.js";
import type { IngestRequest, TelemetryPayloadV1 } from "../src/types.js";

const DEVICE_SECRET = "station-secret-01";
const NOW = 1_700_000_000;

const config: IngestConfig = {
  allowedContractVersion: "v1",
  maxTimestampDriftSeconds: 300,
  salinityWarningLevel: 1.2,
  salinityCriticalLevel: 1.8,
  lowBatteryVoltage: 3.6,
  lowSignalStrengthDbm: -95,
};

const otaCatalog = {
  STATION_01: { update_available: false },
};

function basePayload(overrides: Partial<TelemetryPayloadV1> = {}): TelemetryPayloadV1 {
  return {
    contract_version: "v1",
    device_id: "STATION_01",
    message_id: "contract-test-message-001",
    timestamp: NOW,
    salinity: 1.1,
    water_level: 50,
    fault_flags: 0,
    sensor_status: { ec_probe: "ok", ultrasonic: "ok" },
    battery_voltage: 3.9,
    signal_strength_dbm: -85,
    firmware_version: "1.0.2",
    ...overrides,
  };
}

async function buildRequest(payload: TelemetryPayloadV1, signature?: string): Promise<IngestRequest> {
  return {
    headers: {
      "x-device-id": payload.device_id,
      "x-timestamp": String(payload.timestamp),
      "x-signature": signature ?? await signPayload(payload, DEVICE_SECRET),
      "x-contract-version": payload.contract_version,
    },
    payload,
  };
}

describe("ingest contract", () => {
  it("accepts a valid signed payload", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload();
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.status, "inserted");
      assert.equal(response.station_id, "STATION_01");
    }

    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 1);
    assert.equal(snapshot.auditLogs.at(-1)?.status, "accepted");
  });

  it("ignores duplicate message_id", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-duplicate-001" });
    const request = await buildRequest(payload);

    const first = await ingestTelemetry(request, db, config, NOW);
    const second = await ingestTelemetry(request, db, config, NOW + 1);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.status, "inserted");
      assert.equal(second.status, "duplicate_ignored");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 1);
    assert.equal(db.getSnapshot().auditLogs.filter((row) => row.status === "duplicate").length, 1);
  });

  it("still reports success when the health insert fails after a successful reading insert", async () => {
    // Regression test for the failure mode where a health/event/audit
    // side-effect error after a successful insert used to become a
    // retryable INTERNAL_ERROR. A gateway retry with the same message_id
    // would then hit "duplicate_ignored" and permanently skip ever
    // recording health/events for that reading — see ingest.ts's comment
    // at the health/event block for the full reasoning.
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const originalInsertHealth = db.insertHealth.bind(db);
    db.insertHealth = async () => {
      throw new Error("simulated transient health-insert failure");
    };

    const payload = basePayload({ message_id: "contract-test-health-failure-001" });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.status, "inserted");
    }

    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 1, "the reading itself must still be stored");
    assert.equal(snapshot.healthLogs.length, 0, "the failed health insert must not silently succeed");
    assert.equal(
      snapshot.auditLogs.at(-1)?.status,
      "accepted",
      "audit log must still record acceptance, with the side-effect failure noted in the reason",
    );
    assert.match(snapshot.auditLogs.at(-1)?.reason ?? "", /side effect failed/);

    db.insertHealth = originalInsertHealth;
  });

  it("rejects a request whose x-contract-version header does not match payload.contract_version", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-header-mismatch-001" });
    const request = await buildRequest(payload);
    request.headers["x-contract-version"] = "v2";

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "contract_mismatch");
  });

  it("accepts a request with no x-contract-version header at all (backward compatible)", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-header-absent-001" });
    const request = await buildRequest(payload);
    request.headers["x-contract-version"] = "";

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, true);
  });

  it("rejects invalid signature", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-bad-signature-001" });
    const response = await ingestTelemetry(await buildRequest(payload, "deadbeef"), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "INVALID_SIGNATURE");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "invalid_signature");
  });

  it("rejects sensor fault payloads", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({
      message_id: "contract-test-sensor-fault-001",
      fault_flags: 1,
      sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "SENSOR_FAULT");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "sensor_fault");
    assert.equal(db.getSnapshot().environmentalEvents.some((event) => event.event_type === "SENSOR_FAULT"), true);
  });

  it("rejects replay attack with timestamp too old", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const staleTimestamp = NOW - 600;
    const payload = basePayload({
      message_id: "contract-test-replay-old-001",
      timestamp: staleTimestamp,
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    }
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "expired_timestamp");
  });

  it("rejects replay attack with timestamp too far in the future", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const futureTimestamp = NOW + 600;
    const payload = basePayload({
      message_id: "contract-test-replay-future-001",
      timestamp: futureTimestamp,
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    }
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "expired_timestamp");
  });
});

describe("station_summary gateway payloads", () => {
  const tokenConfig: IngestConfig = {
    ...config,
    gatewayIngestToken: "gateway-token-01",
  };

  it("stores every STATION_01 field from the gateway summary in environmental_readings", async () => {
    const db = new MockDb({}, otaCatalog, ["STATION_01"]);
    const payload = {
      type: "station_summary",
      station_id: "STATION_01",
      firmware_version: "simple-qos1-wire",
      message_id: "STATION_01-1",
      sequence: 1,
      summary_minutes: 5,
      sensor_height_cm: 350,
      distance_cm: 228.6,
      water_level_cm: 121.4,
      ec_ms_cm: 0.106,
      ec_us_cm: 106,
      temperature_c: 29.5,
      tds_ppm: 53,
      salinity_ppt: 0.055,
      salinity_ppm: 55,
      battery_voltage_v: 0,
      battery_percent: 0,
    };

    const response = await handleIngestRequest(payload, { "x-gateway-token": "gateway-token-01" }, db, tokenConfig, NOW);

    assert.equal(response.status, 200);
    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 1);
    assert.equal(snapshot.soilReadings.length, 0);
    assert.equal(snapshot.environmentalReadings[0]?.station_id, "STATION_01");
    assert.equal(snapshot.environmentalReadings[0]?.water_level, 121.4);
    assert.equal(snapshot.environmentalReadings[0]?.ec_us_cm, 106);
    assert.equal(snapshot.environmentalReadings[0]?.tds_ppm, 53);
    assert.equal(snapshot.environmentalReadings[0]?.raw_station_payload?.message_id, "STATION_01-1");
    assert.equal(snapshot.healthLogs[0]?.battery_voltage, null);
    assert.equal(snapshot.healthLogs[0]?.battery_percent, 0);
  });

  it("stores every STATION_02 field from the gateway summary in soil_readings", async () => {
    const db = new MockDb({}, otaCatalog, ["STATION_02"]);
    const payload = {
      type: "station_summary",
      station_id: "STATION_02",
      firmware_version: "simple-qos1-wire",
      message_id: "STATION_02-2",
      sequence: 2,
      summary_minutes: 5,
      crop: "grapefruit",
      air_temp_c: null,
      air_humidity_pct: null,
      soil_temp_c: 29.9,
      soil_moisture_pct: 43.7,
      soil_ec_ms_cm: 0.11,
      soil_ec_us_cm: 110,
      soil_salinity: 60,
      soil_tds: 55,
      soil_ph: 7,
      battery_voltage_v: null,
      battery_percent: null,
    };

    const response = await handleIngestRequest(payload, { "x-gateway-token": "gateway-token-01" }, db, tokenConfig, NOW);

    assert.equal(response.status, 200);
    const snapshot = db.getSnapshot();
    assert.equal(snapshot.soilReadings.length, 1);
    assert.equal(snapshot.environmentalReadings.length, 0);
    assert.equal(snapshot.soilReadings[0]?.station_id, "STATION_02");
    assert.equal(snapshot.soilReadings[0]?.soil_moisture_pct, 43.7);
    assert.equal(snapshot.soilReadings[0]?.soil_ec_us_cm, 110);
    assert.equal(snapshot.soilReadings[0]?.soil_salinity, 60);
    assert.equal(snapshot.soilReadings[0]?.soil_tds, 55);
    assert.equal(snapshot.soilReadings[0]?.crop, "grapefruit");
    assert.equal(snapshot.soilReadings[0]?.raw_station_payload?.message_id, "STATION_02-2");
    assert.equal(snapshot.healthLogs.length, 0);
  });

  it("unwraps the actual gateway envelope and stores the nested station summary", async () => {
    const db = new MockDb({}, otaCatalog, ["STATION_02"]);
    const response = await handleIngestRequest(
      {
        gateway_id: "GATEWAY",
        firmware_version: "gateway-lora-wifi-0.8.2-rx-priority-preserve-http-fix",
        sequence: 99,
        uptime_ms: 12345,
        transport: "lora_uart_to_4g",
        raw_station_payload: {
          type: "station_summary",
          station_id: "STATION_02",
          firmware_version: "simple-qos1-wire",
          message_id: "STATION_02-wrapped-1",
          sequence: 2,
          summary_minutes: 5,
          crop: "grapefruit",
          air_temp_c: null,
          air_humidity_pct: null,
          soil_temp_c: 29.9,
          soil_moisture_pct: 43.7,
          soil_ec_ms_cm: 0.11,
          soil_ec_us_cm: 110,
          soil_salinity: 60,
          soil_tds: 55,
          soil_ph: 7,
          battery_voltage_v: null,
          battery_percent: null,
        },
      },
      { "x-gateway-token": "gateway-token-01" },
      db,
      tokenConfig,
      NOW,
    );

    assert.equal(response.status, 200);
    const row = db.getSnapshot().soilReadings[0];
    assert.equal(row?.message_id, "STATION_02-wrapped-1");
    assert.equal(row?.soil_ec_us_cm, 110);
    assert.equal(row?.raw_station_payload?.type, "station_summary");
  });
});

describe("gateway relay authentication", () => {
  const GATEWAY_SECRET = "gateway-secret-01";

  it("accepts a station reading signed by its relaying gateway's secret", async () => {
    // STATION_02 is a registered, active device with NO signing secret of
    // its own — only the gateway that relays it authenticates the request.
    const db = new MockDb({ GATEWAY_01: GATEWAY_SECRET }, otaCatalog, ["STATION_02"]);
    const payload = basePayload({ device_id: "STATION_02", message_id: "gateway-relay-001" });
    const request: IngestRequest = {
      headers: {
        "x-device-id": "GATEWAY_01",
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, GATEWAY_SECRET),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.station_id, "STATION_02");
    }
    assert.equal(db.getSnapshot().environmentalReadings[0]?.station_id, "STATION_02");
  });

  it("rejects a relayed reading attributed to an unregistered station", async () => {
    const db = new MockDb({ GATEWAY_01: GATEWAY_SECRET }, otaCatalog, []); // STATION_99 not registered
    const payload = basePayload({ device_id: "STATION_99", message_id: "gateway-relay-002" });
    const request: IngestRequest = {
      headers: {
        "x-device-id": "GATEWAY_01",
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, GATEWAY_SECRET),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "DEVICE_NOT_REGISTERED");
    }
    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
  });

  it("rejects when the authenticating device (gateway) is unknown", async () => {
    const db = new MockDb({}, otaCatalog, ["STATION_02"]);
    const payload = basePayload({ device_id: "STATION_02", message_id: "gateway-relay-003" });
    const request: IngestRequest = {
      headers: {
        "x-device-id": "GATEWAY_UNKNOWN",
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, "some-guess"),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "DEVICE_NOT_REGISTERED");
    }
  });

  it("rejects a request missing the x-device-id header", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "gateway-relay-004" });
    const request: IngestRequest = {
      headers: {
        "x-device-id": "",
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, DEVICE_SECRET),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
    }
  });

  it("rejects a request with a missing (not just stale) x-timestamp header", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "gateway-relay-005" });
    const request: IngestRequest = {
      headers: {
        "x-device-id": "STATION_01",
        "x-timestamp": "",
        "x-signature": await signPayload(payload, DEVICE_SECRET),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    }
    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
  });
});

describe("optional health fields", () => {
  it("accepts a payload with no battery_voltage or signal_strength_dbm and skips the health log", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "no-health-001" });
    delete payload.battery_voltage;
    delete payload.signal_strength_dbm;

    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 1);
    assert.equal(snapshot.healthLogs.length, 0);
    // No fabricated LOW_BATTERY/OFFLINE alert from fields that were never reported.
    assert.equal(snapshot.environmentalEvents.some((e) => e.event_type === "LOW_BATTERY" || e.event_type === "OFFLINE"), false);
  });

  it("still records a health log when only one of battery/signal is present", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "partial-health-001" });
    delete payload.signal_strength_dbm;

    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    const snapshot = db.getSnapshot();
    assert.equal(snapshot.healthLogs.length, 1);
    assert.equal(snapshot.healthLogs[0]?.battery_voltage, 3.9);
    assert.equal(snapshot.healthLogs[0]?.signal_strength_dbm, null);
  });
});

describe("soil readings (reading_kind: soil)", () => {
  const SOIL_SECRET = "station-secret-02";

  function soilPayload(overrides: Partial<TelemetryPayloadV1> = {}): TelemetryPayloadV1 {
    return {
      contract_version: "v1",
      reading_kind: "soil",
      device_id: "STATION_02",
      message_id: "soil-test-001",
      timestamp: NOW,
      fault_flags: 0,
      soil: {
        air_temp_c: 29.4,
        air_humidity_pct: 78.2,
        soil_temp_c: 27.1,
        soil_moisture_pct: 41.5,
        soil_ec_ms_cm: 1.08,
        soil_ph: 6.2,
      },
      firmware_version: "station2-grapefruit-soil-0.1.0",
      ...overrides,
    };
  }

  async function buildSoilRequest(payload: TelemetryPayloadV1): Promise<IngestRequest> {
    return {
      headers: {
        "x-device-id": payload.device_id,
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, SOIL_SECRET),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };
  }

  it("accepts a valid soil payload and stores it in soil_readings, not environmental_readings", async () => {
    const db = new MockDb({ STATION_02: SOIL_SECRET }, otaCatalog);
    const payload = soilPayload();
    const response = await ingestTelemetry(await buildSoilRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    const snapshot = db.getSnapshot();
    assert.equal(snapshot.soilReadings.length, 1);
    assert.equal(snapshot.environmentalReadings.length, 0);
    assert.equal(snapshot.soilReadings[0]?.soil_moisture_pct, 41.5);
    assert.equal(snapshot.soilReadings[0]?.soil_ec_ms_cm, 1.08);
  });

  it("accepts a soil payload with some sensors null, preserving null (not 0) for the ones that faulted", async () => {
    const db = new MockDb({ STATION_02: SOIL_SECRET }, otaCatalog);
    const payload = soilPayload({
      message_id: "soil-test-002",
      soil: {
        air_temp_c: 29.4,
        air_humidity_pct: 78.2,
        soil_temp_c: null,
        soil_moisture_pct: 41.5,
        soil_ec_ms_cm: 1.08,
        soil_ph: null, // pH probe faulted — must not become 0
      },
    });

    const response = await ingestTelemetry(await buildSoilRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    const row = db.getSnapshot().soilReadings[0];
    assert.equal(row?.soil_ph, null);
    assert.equal(row?.soil_temp_c, null);
    assert.equal(row?.soil_moisture_pct, 41.5);
  });

  it("rejects a soil payload where every sensor is null (no information at all)", async () => {
    const db = new MockDb({ STATION_02: SOIL_SECRET }, otaCatalog);
    const payload = soilPayload({
      message_id: "soil-test-003",
      soil: {
        air_temp_c: null,
        air_humidity_pct: null,
        soil_temp_c: null,
        soil_moisture_pct: null,
        soil_ec_ms_cm: null,
        soil_ph: null,
      },
    });

    const response = await ingestTelemetry(await buildSoilRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
    }
  });

  it("rejects a soil payload signed with the water canonical string (cross-format signature confusion)", async () => {
    const db = new MockDb({ STATION_02: SOIL_SECRET }, otaCatalog);
    const payload = soilPayload({ message_id: "soil-test-004" });
    // Deliberately sign with the WATER canonical-string function to prove
    // the two formats are not interchangeable — this must fail, not
    // silently succeed with a coincidentally-valid signature.
    const { buildCanonicalString } = await import("../src/canonical.js");
    const wrongCanonical = buildCanonicalString(payload);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(SOIL_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(wrongCanonical));
    const wrongSignature = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const request: IngestRequest = {
      headers: {
        "x-device-id": "STATION_02",
        "x-timestamp": String(payload.timestamp),
        "x-signature": wrongSignature,
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);
    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "INVALID_SIGNATURE");
    }
  });

  it("does not affect water-payload validation — salinity/water_level still required when reading_kind is absent", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = soilPayload({
      device_id: "STATION_01",
      message_id: "soil-test-005",
      reading_kind: undefined,
    });
    delete (payload as Partial<TelemetryPayloadV1>).soil;

    const response = await ingestTelemetry(await buildSoilRequest({ ...payload, device_id: "STATION_01" }), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
    }
  });

  it("soil values out of physical range are rejected", async () => {
    const db = new MockDb({ STATION_02: SOIL_SECRET }, otaCatalog);
    const payload = soilPayload({
      message_id: "soil-test-006",
      soil: {
        air_temp_c: 29.4,
        air_humidity_pct: 78.2,
        soil_temp_c: 27.1,
        soil_moisture_pct: 41.5,
        soil_ec_ms_cm: 1.08,
        soil_ph: 25, // impossible pH
      },
    });

    const response = await ingestTelemetry(await buildSoilRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "VALUE_OUT_OF_RANGE");
    }
  });
});

/**
 * The signed v1 edge contract still treats salinity + water level as its
 * required water pair. The active gateway HTTP path retains the richer raw
 * Station 01 payload and promotes EC/temperature through the web route; these
 * cases only pin validation at the older signed-contract boundary.
 */
describe("signed v1 water payload validation", () => {
  it("discards a valid water_level when salinity is null, via MISSING_FIELD", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({
      message_id: "water-ec-blocker-001",
      salinity: undefined,
      water_level: 51.0,
      sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
    });

    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false, "payload is rejected outright");
    if (!response.ok) {
      assert.equal(response.error_code, "MISSING_FIELD");
      assert.equal(response.retryable, false);
    }

    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 0, "an incomplete signed-v1 row is not stored");
    assert.equal(snapshot.auditLogs.at(-1)?.status, "missing_field");
  });

  it("also discards it via SENSOR_FAULT when a salinity value IS present but the EC probe is faulted", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({
      message_id: "water-ec-blocker-002",
      salinity: 1.1,
      water_level: 51.0,
      sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
    });

    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "SENSOR_FAULT");
    }

    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 0, "a faulted signed-v1 row is not stored");
    assert.equal(snapshot.environmentalEvents.at(-1)?.event_type, "SENSOR_FAULT");
  });

  it("contrasts with soil, which deliberately preserves a partial reading", async () => {
    // The soil helpers are scoped to the soil suite, so this builds its own
    // payload — the point is the contrast, and stating it explicitly here
    // keeps the comparison readable without reaching across suites.
    const soilSecret = "station-secret-02";
    const db = new MockDb({ STATION_02: soilSecret }, otaCatalog);

    // Five of six soil sensors silent — still accepted, because soil models
    // per-sensor nullability (ingest.ts:38-48) while water does not.
    const payload: TelemetryPayloadV1 = {
      contract_version: "v1",
      reading_kind: "soil",
      device_id: "STATION_02",
      message_id: "water-ec-blocker-003",
      timestamp: NOW,
      fault_flags: 0,
      soil: {
        air_temp_c: null,
        air_humidity_pct: null,
        soil_temp_c: null,
        soil_moisture_pct: 41.5,
        soil_ec_ms_cm: null,
        soil_ph: null,
      },
      firmware_version: "station2-grapefruit-soil-0.1.0",
    };

    const request: IngestRequest = {
      headers: {
        "x-device-id": payload.device_id,
        "x-timestamp": String(payload.timestamp),
        "x-signature": await signPayload(payload, soilSecret),
        "x-contract-version": payload.contract_version,
      },
      payload,
    };

    const response = await ingestTelemetry(request, db, config, NOW);

    assert.equal(response.ok, true, "one working sensor is enough for soil");
    assert.equal(db.getSnapshot().soilReadings.length, 1);
  });
});
