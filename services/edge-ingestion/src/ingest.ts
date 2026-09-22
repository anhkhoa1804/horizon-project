import { timingSafeEqualHex } from "./canonical.js";
import type { DbPort } from "./dbPort.js";
import type { IngestRequest, IngestResponse, IngestionAuditLogRow, EnvironmentalEventRow, TelemetryPayloadV1 } from "./types.js";

export interface IngestConfig {
  allowedContractVersion: string;
  maxTimestampDriftSeconds: number;
  lowBatteryVoltage?: number;
  lowSignalStrengthDbm?: number;
  gatewayIngestToken?: string;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function readingKind(payload: TelemetryPayloadV1): "water" | "soil" {
  // Absent reading_kind means "water" — every caller that predates this
  // field (tests, scripts/simulator.ts, scripts/mock_ingest.ts) never sets
  // it, and must keep behaving exactly as before.
  return payload.reading_kind === "soil" ? "soil" : "water";
}

function hasBaseRequiredFields(payload: TelemetryPayloadV1): boolean {
  return Boolean(
    payload.contract_version &&
      payload.device_id &&
      payload.message_id &&
      Number.isFinite(payload.timestamp) &&
      payload.firmware_version &&
      Number.isFinite(payload.fault_flags),
  );
}

function hasRequiredReadingFields(payload: TelemetryPayloadV1): boolean {

  if (readingKind(payload) === "soil") {
    const soil = payload.soil;
    if (!soil) {
      return false;
    }
    // At least one sensor must have reported something — an entirely-null
    // reading carries no information and would just be noise.
    return [soil.air_temp_c, soil.air_humidity_pct, soil.soil_temp_c, soil.soil_moisture_pct, soil.soil_ec_ms_cm, soil.soil_ph].some(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
  }

  return Boolean(
    payload.sensor_status?.ec_probe &&
      payload.sensor_status?.ultrasonic &&
      Number.isFinite(payload.salinity) &&
      Number.isFinite(payload.water_level),
  );
}

function isFaulty(payload: TelemetryPayloadV1): boolean {
  // Soil readings don't use the whole-row ec_probe/ultrasonic fault model —
  // each of the six soil sensors independently reports null instead of a
  // value when it faults (see SoilMeasurements), rather than rejecting an
  // otherwise-good reading because one unrelated sensor is broken.
  if (readingKind(payload) === "soil") {
    return false;
  }

  if (payload.fault_flags > 0) {
    return true;
  }

  return payload.sensor_status?.ec_probe === "fault" || payload.sensor_status?.ultrasonic === "fault";
}

function soilValuesInRange(payload: TelemetryPayloadV1): boolean {
  const soil = payload.soil;
  if (!soil) {
    return false;
  }

  const checks: Array<[number | null, number, number]> = [
    [soil.air_temp_c, -10, 60],
    [soil.air_humidity_pct, 0, 100],
    [soil.soil_temp_c, -10, 60],
    [soil.soil_moisture_pct, 0, 100],
    [soil.soil_ec_ms_cm, 0, 20],
    [soil.soil_ec_us_cm ?? null, 0, 20000],
    [soil.soil_salinity ?? null, 0, 100000],
    [soil.soil_tds ?? null, 0, 100000],
    [soil.soil_ph, 0, 14],
  ];

  return checks.every(([value, min, max]) => value === null || inRange(value, min, max));
}

function optionalInRange(value: number | undefined, min: number, max: number): boolean {
  return typeof value !== "number" || inRange(value, min, max);
}

function auditRow(payload: TelemetryPayloadV1, status: IngestionAuditLogRow["status"], reason: string, timestamp: number): IngestionAuditLogRow {
  return {
    message_id: payload.message_id ?? "",
    device_id: payload.device_id ?? "",
    status,
    reason,
    timestamp,
  };
}

async function emitAlertEvents(db: DbPort, payload: TelemetryPayloadV1, config: IngestConfig, nowEpochSeconds: number): Promise<void> {
  const lowBatteryVoltage = config.lowBatteryVoltage ?? 3.6;
  const lowSignalStrengthDbm = config.lowSignalStrengthDbm ?? -95;

  const events: EnvironmentalEventRow[] = [];

  // Water salinity has no active, site-validated operational threshold in
  // the registry. It is therefore persisted as a measurement, but never
  // promoted to HIGH_SALINITY from a hard-coded value here. The registry is
  // the only authority that may activate an environmental interpretation.

  // Battery/signal are optional (see TelemetryPayloadV1) — only alert on
  // thresholds the device actually reported.
  if (typeof payload.battery_voltage === "number" && payload.battery_voltage < lowBatteryVoltage) {
    events.push({
      station_id: payload.device_id,
      event_type: "LOW_BATTERY",
      severity: "warning",
      message_id: payload.message_id,
      details: { battery_voltage: payload.battery_voltage, threshold: lowBatteryVoltage },
      timestamp: nowEpochSeconds,
    });
  }

  if (typeof payload.signal_strength_dbm === "number" && payload.signal_strength_dbm < lowSignalStrengthDbm) {
    events.push({
      station_id: payload.device_id,
      event_type: "OFFLINE",
      severity: "info",
      message_id: payload.message_id,
      details: { signal_strength_dbm: payload.signal_strength_dbm, threshold: lowSignalStrengthDbm },
      timestamp: nowEpochSeconds,
    });
  }

  for (const event of events) {
    await db.insertEvent(event);
  }
}

export async function ingestTelemetry(
  request: IngestRequest,
  db: DbPort,
  config: IngestConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<IngestResponse> {
  try {
    const payload = request.payload;
    const kind = readingKind(payload);

    if (!hasBaseRequiredFields(payload)) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "required field missing", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "required field missing", retryable: false };
    }

    if (payload.contract_version !== config.allowedContractVersion) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "unsupported contract version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "unsupported contract version", retryable: false };
    }

    // x-contract-version is carried on the transport (header) as well as the
    // payload body — normally redundant, but a proxy/gateway bug could
    // rewrite one without the other. Both must agree; the payload's value is
    // still the one checked against config.allowedContractVersion above.
    const headerContractVersion = request.headers["x-contract-version"];
    if (headerContractVersion && headerContractVersion !== payload.contract_version) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "x-contract-version header does not match payload.contract_version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "x-contract-version header does not match payload.contract_version", retryable: false };
    }

    // The pilot ingress has one authentication model: the physical gateway's
    // configured bearer token. There is no direct-station or HMAC fallback.
    const gatewayToken = request.headers["x-gateway-token"] ?? "";
    const isGatewayTokenAuthorized = Boolean(config.gatewayIngestToken) && timingSafeEqualHex(gatewayToken, config.gatewayIngestToken ?? "");
    if (!isGatewayTokenAuthorized) {
      await db.insertAuditLog(auditRow(payload, "invalid_signature", "gateway token is missing or invalid", nowEpochSeconds));
      return { ok: false, error_code: "INVALID_SIGNATURE", message: "gateway token is missing or invalid", retryable: false };
    }

    if (!(await db.isDeviceRegistered(payload.device_id))) {
      await db.insertAuditLog(auditRow(payload, "device_not_registered", "attributed station is not a known, active device", nowEpochSeconds));
      return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "attributed station is not a known, active device", retryable: false };
    }

    const isPayloadValid = Math.abs(nowEpochSeconds - payload.timestamp) <= config.maxTimestampDriftSeconds;

    if (!isPayloadValid) {
      await db.insertAuditLog(auditRow(payload, "expired_timestamp", "payload timestamp is outside allowed drift window", nowEpochSeconds));
      return {
        ok: false,
        error_code: "TIMESTAMP_OUT_OF_WINDOW",
        message: "payload timestamp is outside allowed drift window",
        retryable: false,
      };
    }

    // A station that explicitly reports a water-sensor fault is a valid
    // contract message even when its affected measurement is null. Reject it
    // as a terminal SENSOR_FAULT rather than mislabelling it MISSING_FIELD.
    // We still never manufacture a number or store a partial water row.
    if (isFaulty(payload)) {
      await db.insertAuditLog(auditRow(payload, "sensor_fault", "sensor fault reported by node", nowEpochSeconds));
      await db.insertEvent({
        station_id: payload.device_id,
        event_type: "SENSOR_FAULT",
        severity: "critical",
        message_id: payload.message_id,
        details: { fault_flags: payload.fault_flags, sensor_status: payload.sensor_status },
        timestamp: nowEpochSeconds,
      });
      return { ok: false, error_code: "SENSOR_FAULT", message: "sensor fault reported by node", retryable: false };
    }

    if (!hasRequiredReadingFields(payload)) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "required reading field missing", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "required reading field missing", retryable: false };
    }

    const valuesInRange =
      kind === "soil"
        ? soilValuesInRange(payload)
        : inRange(payload.salinity as number, 0, 50) &&
          inRange(payload.water_level as number, -100, 1000) &&
          optionalInRange(payload.salinity_ppm, 0, 100000) &&
          optionalInRange(payload.sensor_height_cm, 0, 10000) &&
          optionalInRange(payload.distance_cm, -100, 10000) &&
          optionalInRange(payload.ec_ms_cm, 0, 20) &&
          optionalInRange(payload.ec_us_cm, 0, 20000) &&
          optionalInRange(payload.temperature_c, -10, 80) &&
          optionalInRange(payload.tds_ppm, 0, 100000) &&
          (typeof payload.battery_voltage !== "number" || inRange(payload.battery_voltage, 2.5, 18)) &&
          optionalInRange(payload.battery_percent, 0, 100) &&
          (typeof payload.signal_strength_dbm !== "number" || inRange(payload.signal_strength_dbm, -130, -30));

    if (!valuesInRange) {
      await db.insertAuditLog(auditRow(payload, "value_out_of_range", "value out of accepted range", nowEpochSeconds));
      return { ok: false, error_code: "VALUE_OUT_OF_RANGE", message: "value out of accepted range", retryable: false };
    }

    const status =
      kind === "soil"
        ? await db.insertSoilReading({
            message_id: payload.message_id,
            station_id: payload.device_id,
            air_temp_c: payload.soil?.air_temp_c ?? null,
            air_humidity_pct: payload.soil?.air_humidity_pct ?? null,
            soil_temp_c: payload.soil?.soil_temp_c ?? null,
            soil_moisture_pct: payload.soil?.soil_moisture_pct ?? null,
            soil_ec_ms_cm: payload.soil?.soil_ec_ms_cm ?? null,
            soil_ec_us_cm: payload.soil?.soil_ec_us_cm ?? null,
            soil_salinity: payload.soil?.soil_salinity ?? null,
            soil_tds: payload.soil?.soil_tds ?? null,
            soil_ph: payload.soil?.soil_ph ?? null,
            sequence: payload.sequence ?? null,
            summary_minutes: payload.summary_minutes ?? null,
            crop: payload.crop ?? null,
            fault_flags: payload.fault_flags,
            timestamp: payload.timestamp,
            raw_station_payload: payload.raw_station_payload ?? null,
          })
        : await db.insertEnvironmental({
            message_id: payload.message_id,
            station_id: payload.device_id,
            salinity: payload.salinity as number,
            salinity_ppm: payload.salinity_ppm ?? null,
            water_level: payload.water_level as number,
            sensor_height_cm: payload.sensor_height_cm ?? null,
            distance_cm: payload.distance_cm ?? null,
            ec_ms_cm: payload.ec_ms_cm ?? null,
            ec_us_cm: payload.ec_us_cm ?? null,
            temperature_c: payload.temperature_c ?? null,
            tds_ppm: payload.tds_ppm ?? null,
            sequence: payload.sequence ?? null,
            summary_minutes: payload.summary_minutes ?? null,
            fault_flags: payload.fault_flags,
            ec_probe_status: payload.sensor_status!.ec_probe,
            ultrasonic_status: payload.sensor_status!.ultrasonic,
            timestamp: payload.timestamp,
            raw_station_payload: payload.raw_station_payload ?? null,
          });

    if (status === "inserted") {
      // Isolated from the outer catch on purpose. The reading itself is
      // already durably stored and message_id-guarded — that's the part
      // that matters for correctness. If we let a failure here (health,
      // device-seen touch, alert events) become a `retryable: true`
      // response, the gateway will retry with the same message_id;
      // insertEnvironmental/insertSoilReading will then report
      // "duplicate_ignored", this whole branch won't run again, and
      // health/events/the "accepted" audit row would be lost permanently,
      // not just delayed. Best-effort log the failure and still report
      // success — the reading genuinely was accepted.
      try {
        // Only record a health log when the device actually reported at
        // least one health field — an empty row would just be noise.
        if (typeof payload.battery_voltage === "number" || typeof payload.battery_percent === "number" || typeof payload.signal_strength_dbm === "number") {
          await db.insertHealth({
            station_id: payload.device_id,
            battery_voltage: payload.battery_voltage ?? null,
            battery_percent: payload.battery_percent ?? null,
            signal_strength_dbm: payload.signal_strength_dbm ?? null,
            firmware_version: payload.firmware_version,
            timestamp: payload.timestamp,
          });
        }
        await db.touchDeviceSeen(payload.device_id, payload.firmware_version, nowEpochSeconds);
        await emitAlertEvents(db, payload, config, nowEpochSeconds);
        await db.insertAuditLog(auditRow(payload, "accepted", "payload inserted", nowEpochSeconds));
      } catch (sideEffectError) {
        const message = sideEffectError instanceof Error ? sideEffectError.message : "unexpected error";
        await db
          .insertAuditLog(auditRow(payload, "accepted", `payload inserted; side effect failed: ${message}`, nowEpochSeconds))
          .catch(() => undefined);
      }
    } else {
      await db.insertAuditLog(auditRow(payload, "duplicate", "duplicate message_id ignored", nowEpochSeconds));
    }

    const ota = await db.getActiveOta(payload.device_id).catch(() => ({ update_available: false as const }));

    return {
      ok: true,
      status,
      station_id: payload.device_id,
      message_id: payload.message_id,
      server_timestamp: nowEpochSeconds,
      ota,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await db.insertAuditLog({
      message_id: request.payload.message_id ?? "",
      device_id: request.payload.device_id ?? "",
      status: "internal_error",
      reason: message,
      timestamp: nowEpochSeconds,
    }).catch(() => undefined);
    return { ok: false, error_code: "INTERNAL_ERROR", message, retryable: true };
  }
}
