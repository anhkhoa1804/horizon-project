import { resolveIngestConfig } from "./config.js";
import { ingestTelemetry } from "./ingest.js";
import type { DbPort } from "./dbPort.js";
import type { IngestConfig } from "./ingest.js";
import type { IngestRequest, IngestResponse, TelemetryPayloadV1 } from "./types.js";

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
  payload: TelemetryPayloadV1,
  headers: Record<string, string>,
  db: DbPort,
  config: IngestConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  const request: IngestRequest = {
    headers: {
      "x-contract-version": headers["x-contract-version"] ?? "",
      "x-gateway-token": headers["x-gateway-token"] ?? "",
    },
    payload,
  };

  const result = await ingestTelemetry(request, db, config, nowEpochSeconds);
  return ingestResponseToHttp(result);
}

export async function handleIngestFromEnv(
  payload: TelemetryPayloadV1,
  headers: Record<string, string>,
  db: DbPort,
  env: Record<string, string | undefined>,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  return handleIngestRequest(payload, headers, db, resolveIngestConfig(env), nowEpochSeconds);
}
