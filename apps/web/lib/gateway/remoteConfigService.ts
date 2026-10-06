import {
  isRemoteConfig,
  encodeConfigFrame,
  decodeConfigFrame,
  stationConfigKey,
  type RemoteConfig,
} from "./remoteProtocol";
import { authorizeGatewayRequest } from "./ingestAuth";
export interface RemoteStore {
  desired(): Promise<RemoteConfig[]>;
  put(
    config: RemoteConfig,
    expected: number,
    actor: string,
  ): Promise<{ changed: boolean; config_revision: number; state: string }>;
  record(
    config: RemoteConfig,
    state: string,
    evidence: string,
    reason?: string,
  ): Promise<unknown>;
}
export class RemoteDbError extends Error {
  constructor(public code: string) {
    super("remote_database_error");
  }
}
export type SaveResult = {
  kind:
    | "success"
    | "validation_error"
    | "conflict"
    | "database_error"
    | "audit_error";
  message: string;
  revision?: number;
  state?: string;
};
export async function saveRemoteConfig(
  store: RemoteStore | null,
  value: unknown,
  expected: unknown,
  actor: string,
): Promise<SaveResult> {
  if (
    !isRemoteConfig(value) ||
    !Number.isInteger(expected) ||
    Number(expected) < 0 ||
    value.config_revision !== Number(expected) + 1
  )
    return {
      kind: "validation_error",
      message: "Cấu hình không hợp lệ. Kiểm tra trạm, chu kỳ và chế độ.",
    };
  if (!store)
    return {
      kind: "database_error",
      message: "Chưa kết nối được cơ sở dữ liệu.",
    };
  try {
    const result = await store.put(value, Number(expected), actor);
    return {
      kind: "success",
      message: result.changed
        ? "Đã lưu cấu hình mong muốn. Chưa xác nhận thiết bị áp dụng."
        : "Cấu hình giữ nguyên.",
      revision: result.config_revision,
      state: result.state,
    };
  } catch (e) {
    const code = e instanceof RemoteDbError ? e.code : "unknown";
    return {
      kind:
        code === "40001"
          ? "conflict"
          : code === "P0002"
            ? "audit_error"
            : "database_error",
      message:
        code === "40001"
          ? "Cấu hình đã được cập nhật ở nơi khác. Tải lại trước khi lưu."
          : code === "P0002"
            ? "Nhật ký chưa lưu được; giao dịch cấu hình đã được hoàn tác."
            : "Không lưu được cấu hình. Không có xác nhận áp dụng.",
    };
  }
}
const headers = { "Cache-Control": "no-store, private" };
function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}
function authorize(request: Request, token: string | undefined) {
  const auth = authorizeGatewayRequest(
    request.headers.get("x-gateway-token"),
    token,
  );
  return auth === "ok"
    ? null
    : response(
        {
          ok: false,
          error:
            auth === "not_configured"
              ? "configuration_unavailable"
              : "unauthorized",
        },
        auth === "not_configured" ? 503 : 401,
      );
}
function failure(error: unknown) {
  const code = error instanceof RemoteDbError ? error.code : "unknown";
  return response(
    {
      ok: false,
      error:
        code === "40001"
          ? "revision_conflict"
          : code === "P0001"
            ? "not_found"
            : code === "22023"
              ? "invalid_event"
              : "database_unavailable",
    },
    code === "40001"
      ? 409
      : code === "P0001"
        ? 404
        : code === "22023"
          ? 422
          : 500,
  );
}
export async function configGet(
  request: Request,
  store: RemoteStore | null,
  token: string | undefined,
  keyFor = stationConfigKey,
): Promise<Response> {
  const denied = authorize(request, token);
  if (denied) return denied;
  if (!store)
    return response({ ok: false, error: "configuration_unavailable" }, 503);
  if (request.method !== "GET")
    return response({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const configs = await store.desired();
    const frames = [];
    for (const config of configs) {
      if (!isRemoteConfig(config))
        throw new RemoteDbError("invalid_database_contract");
      const key = keyFor(config.station_id);
      if (!key || key.length < 32)
        return response({ ok: false, error: "station_key_unavailable" }, 503);
      frames.push(encodeConfigFrame(config, "SET", key));
    }
    // Nothing is claimed retrieved if evidence cannot be persisted; gateway retries.
    for (const config of configs) await store.record(config, "RETRIEVED", "");
    return response({
      ok: true,
      contract_version: 1,
      gateway_id: "GATEWAY_01",
      configs,
      frames,
      hardware_verified: false,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function configEventPost(
  request: Request,
  store: RemoteStore | null,
  token: string | undefined,
  keyFor = stationConfigKey,
): Promise<Response> {
  const denied = authorize(request, token);
  if (denied) return denied;
  if (!store)
    return response({ ok: false, error: "configuration_unavailable" }, 503);
  if (request.method !== "POST")
    return response({ ok: false, error: "method_not_allowed" }, 405);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return response({ ok: false, error: "json_required" }, 415);
  let text = "";
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let count = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      count += chunk.value.byteLength;
      if (count > 512) {
        await reader.cancel();
        return response({ ok: false, error: "body_too_large" }, 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  }
  if (text.length > 512)
    return response({ ok: false, error: "body_too_large" }, 413);
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text);
  } catch {
    return response({ ok: false, error: "malformed_json" }, 422);
  }
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join() !==
      ["contract_version", "frame", "gateway_id", "state"].sort().join() ||
    value.contract_version !== 1 ||
    typeof value.frame !== "string"
  )
    return response({ ok: false, error: "invalid_event" }, 422);
  if (value.gateway_id !== "GATEWAY_01")
    return response({ ok: false, error: "gateway_scope_forbidden" }, 403);
  const station =
    value.frame.split("|")[3] === "S1"
      ? "STATION_01"
      : value.frame.split("|")[3] === "S2"
        ? "STATION_02"
        : "";
  if (!station) return response({ ok: false, error: "invalid_station" }, 422);
  const key = keyFor(station);
  if (!key || key.length < 32)
    return response({ ok: false, error: "station_key_unavailable" }, 503);
  const decoded = decodeConfigFrame(value.frame, key);
  if (!decoded) return response({ ok: false, error: "invalid_evidence" }, 422);
  const expected = {
    SET: "SENT",
    ACK: "ACKNOWLEDGED",
    APPLIED: "APPLIED",
    REJECTED: "REJECTED",
  }[decoded.type];
  if (value.state !== expected)
    return response({ ok: false, error: "evidence_state_mismatch" }, 422);
  try {
    const result = await store.record(
      decoded.config,
      expected,
      value.frame,
      decoded.reason,
    );
    return response({
      ok: true,
      contract_version: 1,
      result,
      hardware_verified: false,
    });
  } catch (error) {
    return failure(error);
  }
}
