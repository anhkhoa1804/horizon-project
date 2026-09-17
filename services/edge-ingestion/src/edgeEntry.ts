import { handleIngestFromEnv } from "./httpHandler.js";
import { SupabaseDb } from "./supabaseDb.js";

export async function processIngestHttp(
  payload: Record<string, unknown>,
  headers: Record<string, string>,
  env: Record<string, string | undefined>,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = SupabaseDb.fromEnv(env);
  return handleIngestFromEnv(payload, headers, db, env, nowEpochSeconds);
}
