import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { processIngestHttp } from "./bundle.mjs";

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function readEnv(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-contract-version, x-gateway-token",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error_code: "METHOD_NOT_ALLOWED", message: "POST required", retryable: false });
  }

  const env = {
    SUPABASE_URL: readEnv("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    MAX_TIMESTAMP_DRIFT_SECONDS: readEnv("MAX_TIMESTAMP_DRIFT_SECONDS"),
    DEFAULT_CONTRACT_VERSION: readEnv("DEFAULT_CONTRACT_VERSION"),
    LOW_BATTERY_VOLTAGE: readEnv("LOW_BATTERY_VOLTAGE"),
    LOW_SIGNAL_STRENGTH_DBM: readEnv("LOW_SIGNAL_STRENGTH_DBM"),
    GATEWAY_INGEST_TOKEN: readEnv("GATEWAY_INGEST_TOKEN"),
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, {
      ok: false,
      error_code: "INTERNAL_ERROR",
      message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured",
      retryable: false,
    });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return jsonResponse(400, { ok: false, error_code: "MISSING_FIELD", message: "invalid json body", retryable: false });
  }

  const headers: Record<string, string> = {
    "x-contract-version": req.headers.get("x-contract-version") ?? "",
    "x-gateway-token": req.headers.get("x-gateway-token") ?? "",
  };

  const result = await processIngestHttp(payload, headers, env);
  return jsonResponse(result.status, result.body);
});
