import { handleIngestFromEnv } from "./httpHandler.js";
import { SupabaseDb } from "./supabaseDb.js";
import type { TelemetryPayloadV1 } from "./types.js";

export async function processIngestHttp(
  payload: Record<string, unknown>,
  headers: Record<string, string>,
  env: Record<string, string | undefined>,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = SupabaseDb.fromEnv(env);
  return handleIngestFromEnv(payload as unknown as TelemetryPayloadV1, headers, db, env, nowEpochSeconds);
}
