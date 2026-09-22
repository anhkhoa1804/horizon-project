import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value) {
      values[key] = value;
    }
  }
  return values;
}

export function loadSupabaseEnv(): Record<string, string> {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(testDir, "../../../infra/supabase/.env.supabase");
  const fromFile = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, "utf8")) : {};
  const merged = { ...fromFile, ...process.env } as Record<string, string>;

  if (!merged.DATABASE_URL && merged.DATABASE_POOLER_URL) {
    merged.DATABASE_URL = merged.DATABASE_POOLER_URL;
  }

  if (!merged.SUPABASE_PROJECT_REF && merged.SUPABASE_URL) {
    const match = merged.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      merged.SUPABASE_PROJECT_REF = match[1];
    }
  }

  if (!merged.EDGE_INGEST_URL && merged.SUPABASE_URL) {
    merged.EDGE_INGEST_URL = `${merged.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/edge-ingest`;
  }

  return merged;
}

/**
 * Gate for `tests/integration.test.ts` — requires explicit opt-in via
 * LIVE_SUPABASE_INTEGRATION=1, never inferred from env presence alone.
 *
 * WARNING: as of the Phase E/F reconciliation, `infra/supabase/.env.supabase`
 * (if present) points at a REAL, LIVE Supabase project. Setting
 * LIVE_SUPABASE_INTEGRATION=1 with that file present does not simulate
 * anything — it POSTs real gateway-token telemetry through the live edge-ingest
 * endpoint and writes real rows to `environmental_readings`/
 * `ingestion_audit_logs`. Do not set this flag casually, and never as part
 * of a default/CI test run. Run only `npm run test` (contract.test.ts,
 * fully mocked) unless you specifically intend to write live test data.
 */
export function hasLiveSupabaseEnv(env: Record<string, string>): boolean {
  return Boolean(
    env.LIVE_SUPABASE_INTEGRATION === "1" &&
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.DATABASE_URL &&
      env.EDGE_INGEST_URL,
  );
}
