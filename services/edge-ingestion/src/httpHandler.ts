import { resolveIngestConfig } from "./config.js";
import { ingestTelemetry } from "./ingest.js";
import type { DbPort } from "./dbPort.js";
import type { IngestConfig } from "./ingest.js";
import type { IngestRequest, IngestResponse, TelemetryPayloadV1 } from "./types.js";

type JsonObject = Record<string, unknown>;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | undefined {
  const numberValue = finiteNumber(value);
  return numberValue !== undefined && numberValue > 0 ? numberValue : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeStationSummaryPayload(
  raw: JsonObject,
  nowEpochSeconds: number,
): TelemetryPayloadV1 | null {
  if (raw.type !== "station_summary") {
    return null;
  }

  const stationId = stringValue(raw.station_id);
  const messageId = stringValue(raw.message_id);
  const firmwareVersion = stringValue(raw.firmware_version);
  if (!stationId || !messageId || !firmwareVersion) {
    return null;
  }

  const timestamp = finiteNumber(raw.timestamp) ?? nowEpochSeconds;
  const base = {
    contract_version: "v1" as const,
    device_id: stationId,
    message_id: messageId,
    timestamp,
    sequence: finiteNumber(raw.sequence),
    summary_minutes: finiteNumber(raw.summary_minutes),
    firmware_version: firmwareVersion,
    fault_flags: 0,
    battery_voltage: positiveNumber(raw.battery_voltage_v),
    battery_percent: finiteNumber(raw.battery_percent),
    raw_station_payload: raw,
  };

  if (stationId === "STATION_02") {
    return {
      ...base,
      reading_kind: "soil",
      crop: stringValue(raw.crop),
      soil: {
        air_temp_c: nullableNumber(raw.air_temp_c),
        air_humidity_pct: nullableNumber(raw.air_humidity_pct),
        soil_temp_c: nullableNumber(raw.soil_temp_c),
        soil_moisture_pct: nullableNumber(raw.soil_moisture_pct),
        soil_ec_ms_cm: nullableNumber(raw.soil_ec_ms_cm),
        soil_ec_us_cm: nullableNumber(raw.soil_ec_us_cm),
        soil_salinity: nullableNumber(raw.soil_salinity),
        soil_tds: nullableNumber(raw.soil_tds),
        soil_ph: nullableNumber(raw.soil_ph),
      },
    };
  }

  if (stationId === "STATION_01") {
    const ecMsCm = finiteNumber(raw.ec_ms_cm);
    const ecUsCm = finiteNumber(raw.ec_us_cm);
    const waterLevel = finiteNumber(raw.water_level_cm);
    const distance = finiteNumber(raw.distance_cm);
    return {
      ...base,
      reading_kind: "water",
      salinity: finiteNumber(raw.salinity_ppt),
      salinity_ppm: finiteNumber(raw.salinity_ppm),
      water_level: waterLevel,
      sensor_height_cm: finiteNumber(raw.sensor_height_cm),
      distance_cm: distance,
      ec_ms_cm: ecMsCm,
      ec_us_cm: ecUsCm,
      temperature_c: finiteNumber(raw.temperature_c),
      tds_ppm: finiteNumber(raw.tds_ppm),
      sensor_status: {
        ec_probe: ecMsCm !== undefined || ecUsCm !== undefined ? "ok" : "fault",
        ultrasonic: waterLevel !== undefined || distance !== undefined ? "ok" : "fault",
      },
    };
  }

  return null;
}

function normalizePayload(payload: TelemetryPayloadV1 | JsonObject, nowEpochSeconds: number): TelemetryPayloadV1 {
  const rawPayload = payload as JsonObject;
  const stationPayload =
    rawPayload.raw_station_payload && typeof rawPayload.raw_station_payload === "object" && !Array.isArray(rawPayload.raw_station_payload)
      ? (rawPayload.raw_station_payload as JsonObject)
      : rawPayload;
  const stationSummary = normalizeStationSummaryPayload(stationPayload, nowEpochSeconds);
  return stationSummary ?? (payload as TelemetryPayloadV1);
}

export function ingestResponseToHttp(result: IngestResponse): { status: number; body: Record<string, unknown> } {
  if (!result.ok) {
    const statusByCode = {
      MISSING_FIELD: 400,
      INVALID_SIGNATURE: 401,
      TIMESTAMP_OUT_OF_WINDOW: 400,
      DEVICE_NOT_REGISTERED: 404,
      VALUE_OUT_OF_RANGE: 400,
      SENSOR_FAULT: 422,
      INTERNAL_ERROR: 500,
    } as const;
    return { status: statusByCode[result.error_code], body: { ...result } };
  }

  return { status: 200, body: { ...result } };
}

export async function handleIngestRequest(
  payload: TelemetryPayloadV1 | JsonObject,
  headers: Record<string, string>,
  db: DbPort,
  config: IngestConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  const normalizedPayload = normalizePayload(payload, nowEpochSeconds);
  const request: IngestRequest = {
    headers: {
      "x-device-id": headers["x-device-id"] ?? "",
      "x-timestamp": headers["x-timestamp"] ?? "",
      "x-signature": headers["x-signature"] ?? "",
      "x-contract-version": headers["x-contract-version"] ?? "",
      "x-gateway-token": headers["x-gateway-token"] ?? "",
    },
    payload: normalizedPayload,
  };

  const result = await ingestTelemetry(request, db, config, nowEpochSeconds);
  return ingestResponseToHttp(result);
}

export async function handleIngestFromEnv(
  payload: TelemetryPayloadV1 | JsonObject,
  headers: Record<string, string>,
  db: DbPort,
  env: Record<string, string | undefined>,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  return handleIngestRequest(payload, headers, db, resolveIngestConfig(env), nowEpochSeconds);
}
