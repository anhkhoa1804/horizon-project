import { resolveIngestConfig } from "./config.js";
import { ingestTelemetry } from "./ingest.js";
import type { DbPort } from "./dbPort.js";
import type { IngestConfig } from "./ingest.js";
import type { IngestRequest, IngestResponse, TelemetryPayloadV1 } from "./types.js";

type GatewayAuthDiagnostic = {
  received_contract_version: string;
  received_token_present: boolean;
  received_token_length: number;
  received_token_fingerprint: string | null;
};

type BaseFieldDiagnostic = {
  payload_is_object: boolean;
  contract_version_present: boolean;
  contract_version_type: string;
  contract_version_nonempty: boolean;
  device_id_present: boolean;
  device_id_type: string;
  device_id_nonempty: boolean;
  message_id_present: boolean;
  message_id_type: string;
  message_id_nonempty: boolean;
  timestamp_present: boolean;
  timestamp_type: string;
  timestamp_finite: boolean;
  firmware_version_present: boolean;
  firmware_version_type: string;
  firmware_version_nonempty: boolean;
  fault_flags_present: boolean;
  fault_flags_type: string;
  fault_flags_finite: boolean;
};

type UnknownRecord = Record<string, unknown>;

function valueType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function hasOwnField(payload: UnknownRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

// Safe, deliberately value-free evidence for the exact predicate in
// hasBaseRequiredFields(). It is only returned behind a temporary feature
// flag and never includes payload contents, headers, or configured secrets.
function baseFieldDiagnostic(payload: unknown): BaseFieldDiagnostic {
  const payloadIsObject = payload !== null && typeof payload === "object" && !Array.isArray(payload);
  const fields: UnknownRecord = payloadIsObject ? payload as UnknownRecord : {};
  const contractVersion = fields.contract_version;
  const deviceId = fields.device_id;
  const messageId = fields.message_id;
  const timestamp = fields.timestamp;
  const firmwareVersion = fields.firmware_version;
  const faultFlags = fields.fault_flags;

  return {
    payload_is_object: payloadIsObject,
    contract_version_present: hasOwnField(fields, "contract_version"),
    contract_version_type: valueType(contractVersion),
    contract_version_nonempty: Boolean(contractVersion),
    device_id_present: hasOwnField(fields, "device_id"),
    device_id_type: valueType(deviceId),
    device_id_nonempty: Boolean(deviceId),
    message_id_present: hasOwnField(fields, "message_id"),
    message_id_type: valueType(messageId),
    message_id_nonempty: Boolean(messageId),
    timestamp_present: hasOwnField(fields, "timestamp"),
    timestamp_type: valueType(timestamp),
    timestamp_finite: typeof timestamp === "number" && Number.isFinite(timestamp),
    firmware_version_present: hasOwnField(fields, "firmware_version"),
    firmware_version_type: valueType(firmwareVersion),
    firmware_version_nonempty: Boolean(firmwareVersion),
    fault_flags_present: hasOwnField(fields, "fault_flags"),
    fault_flags_type: valueType(faultFlags),
    fault_flags_finite: typeof faultFlags === "number" && Number.isFinite(faultFlags),
  };
}

function isBaseFieldFailure(response: { status: number; body: Record<string, unknown> }): boolean {
  // This exact response is emitted only by ingest.ts's hasBaseRequiredFields
  // branch. Keep this strict so reading/auth failures never gain this body.
  return response.status === 400 &&
    response.body.error_code === "MISSING_FIELD" &&
    response.body.message === "required field missing";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// This reports only facts about the caller-supplied header. It never hashes,
// returns, or compares against the configured secret, so enabling it does not
// turn the ingest response into a secret oracle.
async function gatewayAuthDiagnostic(receivedContractVersion: string, receivedToken: string): Promise<GatewayAuthDiagnostic> {
  return {
    received_contract_version: receivedContractVersion,
    received_token_present: receivedToken.length > 0,
    received_token_length: receivedToken.length,
    received_token_fingerprint: receivedToken.length > 0 ? await sha256Hex(receivedToken) : null,
  };
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
  const response = await handleIngestRequest(payload, headers, db, resolveIngestConfig(env), nowEpochSeconds);

  if (env.GATEWAY_INGEST_DIAGNOSTICS === "1" && isBaseFieldFailure(response)) {
    return {
      ...response,
      body: {
        ...response.body,
        base_field_diagnostic: baseFieldDiagnostic(payload),
      },
    };
  }

  // Disabled by default and intended only for a controlled physical-gateway
  // investigation. The authentication decision and 401 response are unchanged.
  if (env.GATEWAY_AUTH_DIAGNOSTICS === "1" &&
      response.status === 401 &&
      response.body.error_code === "INVALID_SIGNATURE") {
    return {
      ...response,
      body: {
        ...response.body,
        auth_diagnostic: await gatewayAuthDiagnostic(
          headers["x-contract-version"] ?? "",
          headers["x-gateway-token"] ?? "",
        ),
      },
    };
  }

  return response;
}
