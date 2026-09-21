import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env.supabase");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const SECRET_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MAX_TIMESTAMP_DRIFT_SECONDS",
  "DEFAULT_CONTRACT_VERSION",
  "LOW_BATTERY_VOLTAGE",
  "LOW_SIGNAL_STRENGTH_DBM",
  "GATEWAY_INGEST_TOKEN",
];

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) {
  console.error("SUPABASE_PROJECT_REF is required to push edge secrets.");
  process.exit(1);
}

const pairs = SECRET_KEYS.filter((key) => process.env[key]).map((key) => `${key}=${process.env[key]}`);

if (pairs.length === 0) {
  console.log("No edge secrets to push.");
  process.exit(0);
}

console.log(`Pushing ${pairs.length} secret(s) to edge-ingest...`);
const result = spawnSync(
  "npx",
  ["supabase", "secrets", "set", ...pairs, "--project-ref", projectRef],
  { stdio: "inherit", shell: true, env: process.env },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Edge secrets updated.");
