import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { auditRequiredCredentials, inspectHostedSecretNames } from "./credential-audit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && value) env[key] = value;
  }
  return env;
}

function jwtRole(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return payload.role ?? "unknown";
  } catch {
    return "invalid";
  }
}

function apiKeyKind(value) {
  if (value.startsWith("sb_publishable_")) return "publishable";
  if (value.startsWith("sb_secret_")) return "secret";
  return `legacy:${jwtRole(value)}`;
}

const repoRoot = path.resolve(__dirname, "../..");
const env = {
  ...loadEnvFile(path.join(repoRoot, ".env")),
  ...loadEnvFile(path.join(repoRoot, "apps/web/.env.local")),
  ...loadEnvFile(path.join(__dirname, ".env.supabase")),
  ...process.env,
};
const gatewaySecretsPath = path.join(repoRoot, "firmware/esp32-node/src/gateway/gateway_secrets.h");
const gatewaySecretsText = existsSync(gatewaySecretsPath) ? readFileSync(gatewaySecretsPath, "utf8") : null;
const stationHeaders = Object.fromEntries(["station_01", "station_02"].map((station) => {
  const headerPath = path.join(repoRoot, `firmware/esp32-node/src/${station}_config_secrets.h`);
  return [station, existsSync(headerPath) ? readFileSync(headerPath, "utf8") : null];
}));
const databaseUrl = env.DATABASE_URL ?? env.DATABASE_POOLER_URL;

/** Migration filenames on disk, used to report what `db:migrate` would apply. */
const MIGRATION_FILES = (() => {
  try {
    return readdirSync(path.join(__dirname, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
})();

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
];

console.log("Eco-Sense deploy verification\n");

let ok = true;

for (const key of required) {
  const present = Boolean(env[key]);
  console.log(`${present ? "OK" : "MISSING"}  ${key}`);
  if (!present) ok = false;
}

if (!databaseUrl) {
  console.log("MISSING  DATABASE_URL or DATABASE_POOLER_URL");
  ok = false;
} else {
  console.log(`OK      DATABASE_URL set (${databaseUrl.includes("pooler") ? "pooler" : "direct"})`);
}

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.log("WARN    SUPABASE_ACCESS_TOKEN not set; hosted Supabase Edge secret presence cannot be verified (run: npx supabase login)");
}

for (const issue of auditRequiredCredentials({ env, gatewayHeaderText: gatewaySecretsText, stationHeaders })) {
  console.log(`FAIL    Credential: ${issue.credentialClass}`);
  console.log(`        ${issue.reason}.`);
  console.log(`        Supply it via ${issue.source}.`);
  ok = false;
}
console.log("        Real production credentials must be provisioned/rotated outside source control; values are never printed by this check.");
console.log("        Local environment files do not prove that hosted runtime secrets are present.");

const supabaseCli = path.join(repoRoot, "node_modules/supabase/dist/supabase.js");
if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF || !existsSync(supabaseCli)) {
  console.log("FAIL    Credential: hosted Supabase Edge secret inventory");
  console.log("        Cannot verify GATEWAY_INGEST_TOKEN without SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, and the repository Supabase CLI.");
  ok = false;
} else {
  try {
    const output = execFileSync(process.execPath, [
      supabaseCli, "secrets", "list", "--project-ref", env.SUPABASE_PROJECT_REF,
      "--output-format", "json", "--log-level", "fatal",
    ], {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN },
    });
    const inventory = inspectHostedSecretNames(JSON.parse(output));
    if (!inventory.verified) {
      console.log("FAIL    Credential: hosted Supabase Edge secret inventory returned an unrecognized shape; secret values withheld.");
      ok = false;
    } else if (inventory.missing.includes("GATEWAY_INGEST_TOKEN")) {
      console.log("FAIL    Credential: gateway ingest token");
      console.log("        GATEWAY_INGEST_TOKEN is absent from the hosted Supabase Edge Function secrets.");
      console.log("        Supply it with `supabase secrets set GATEWAY_INGEST_TOKEN` for this project and provision the matching gateway header outside source control.");
      ok = false;
    } else {
      console.log("OK      Hosted Supabase Edge secret name GATEWAY_INGEST_TOKEN is configured (value withheld)");
    }
  } catch {
    console.log("FAIL    Credential: hosted Supabase Edge secret inventory could not be verified; diagnostic and secret values withheld.");
    ok = false;
  }
}

if (env.SUPABASE_ANON_KEY) {
  const kind = apiKeyKind(env.SUPABASE_ANON_KEY);
  if (kind === "publishable" || kind === "legacy:anon") {
    console.log(`OK      SUPABASE_ANON_KEY kind=${kind}`);
  } else {
    console.log(`FAIL    SUPABASE_ANON_KEY must be publishable or legacy anon (got ${kind})`);
    ok = false;
  }
}

if (env.SUPABASE_SERVICE_ROLE_KEY) {
  const kind = apiKeyKind(env.SUPABASE_SERVICE_ROLE_KEY);
  if (kind === "secret" || kind === "legacy:service_role") {
    console.log(`OK      SUPABASE_SERVICE_ROLE_KEY kind=${kind}`);
  } else {
    console.log(`WARN    SUPABASE_SERVICE_ROLE_KEY expected secret or legacy service_role (got ${kind})`);
  }
}

if (databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    console.log(`OK      Database reachable (${rows[0].version.slice(0, 40)}...)`);

    await client.query("select to_regclass('public.schema_migrations') as t");
    const { rows: migRows } = await client.query(
      "select count(*)::int as count from public.schema_migrations",
    ).catch(() => ({ rows: [{ count: 0 }] }));
    console.log(`OK      schema_migrations: ${migRows[0]?.count ?? 0} recorded`);

    // Pending migrations, so a release can see what `db:migrate` would do
    // before it does it.
    try {
      const { rows: pending } = await client.query(
        `select v from unnest($1::text[]) as v
          where v not in (select version from public.schema_migrations)`,
        [MIGRATION_FILES],
      );
      if (pending.length === 0) {
        console.log("OK      All migrations applied");
      } else {
        console.log(`INFO    ${pending.length} migration(s) pending: ${pending.map((r) => r.v).join(", ")}`);
      }
    } catch {
      console.log("WARN    Could not determine pending migrations");
    }

    /*
     * `devices.device_secret` is a legacy schema field; the active Edge path
     * authenticates the gateway bearer token checked above, not this column.
     * Keep this release gate so public seed values cannot silently become
     * credentials again if a retired direct-device path is restored. Select
     * only device_id and never emit the matched placeholder value.
     */
    try {
      const { rows: weak } = await client.query(
        `select device_id from public.devices
          where device_secret in (
            'gateway-secret-01','station-secret-01','station-secret-02',
            'station-secret-03','station-secret-04','station-secret-05'
          )
          order by device_id`,
      );
      if (weak.length === 0) {
        console.log("OK      Device secrets rotated (no repo placeholders in use)");
      } else {
        console.log(`FAIL    Credential: legacy devices.device_secret uses a public repository placeholder on ${weak.length} device(s): ${weak.map((r) => r.device_id).join(", ")}`);
        console.log("        Source: infra/supabase/seed/pilot_seed.sql. This is a legacy field; active gateway auth is separately checked. Provision/rotate production credentials outside source control.");
        ok = false;
      }
    } catch {
      console.log("WARN    Could not check legacy device-secret placeholders (database diagnostic withheld)");
    }
  } catch {
    console.log("FAIL    Database connection (diagnostic withheld to protect configured credentials)");
    if (databaseUrl.includes("db.") && databaseUrl.includes(".supabase.co:5432")) {
      console.log("        Hint: use pooler URL (port 6543) if direct db.* host fails DNS/IPv6.");
    }
    ok = false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (env.LIVE_SUPABASE_INTEGRATION === "1") {
  console.log("OK      LIVE_SUPABASE_INTEGRATION=1");
} else {
  console.log("INFO    Set LIVE_SUPABASE_INTEGRATION=1 after successful deploy");
}

console.log("");
if (ok) {
  console.log("Verification passed. Run: npm run db:migrate && npm run db:deploy");
} else {
  console.log("Verification failed. Fix .env.supabase and retry.");
  process.exit(1);
}
