// Deterministic verification for the migration-018 architecture decisions
// (docs/ARCHITECTURE_DECISIONS.md). Written because this environment could
// not reach the linked Supabase project when this was authored — DNS
// lookup for the project hostname returned ENOTFOUND, and the shared
// Supabase pooler reported the tenant unknown, consistent with the project
// having been paused or deleted. Run this the moment a real project is
// reachable (after `npm run migrate -w @eco-sense/supabase-infra`).
//
// Usage: node verify-architecture.mjs
// Requires infra/supabase/.env.supabase with DATABASE_URL, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Never prints secret values
// — only pass/fail per check plus short diagnostic text.

import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

function loadLocalEnv(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv(".env.supabase");

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Part A: schema-level checks via direct Postgres connection
// ---------------------------------------------------------------------------

async function runSchemaChecks() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_POOLER_URL;
  if (!databaseUrl) {
    record("schema: DATABASE_URL configured", false, "not set in .env.supabase");
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. devices.kind column + check constraint
    const kindColumn = await client.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public' and table_name = 'devices' and column_name = 'kind'`,
    );
    record(
      "devices.kind column exists",
      kindColumn.rows.length === 1,
      kindColumn.rows[0] ? `type=${kindColumn.rows[0].data_type} default=${kindColumn.rows[0].column_default}` : "column missing",
    );

    const kindConstraint = await client.query(
      `select conname, pg_get_constraintdef(oid) as def
       from pg_constraint
       where conrelid = 'public.devices'::regclass and conname = 'devices_kind_check'`,
    );
    record(
      "devices_kind_check constraint exists",
      kindConstraint.rows.length === 1,
      kindConstraint.rows[0]?.def,
    );

    // 2. station_health_logs nullable battery/signal
    const healthCols = await client.query(
      `select column_name, is_nullable
       from information_schema.columns
       where table_schema = 'public' and table_name = 'station_health_logs'
         and column_name in ('battery_voltage', 'signal_strength_dbm')
       order by column_name`,
    );
    const allNullable = healthCols.rows.length === 2 && healthCols.rows.every((r) => r.is_nullable === "YES");
    record(
      "station_health_logs battery_voltage/signal_strength_dbm nullable",
      allNullable,
      healthCols.rows.map((r) => `${r.column_name}=${r.is_nullable}`).join(", "),
    );

    // 3. anon SELECT grants on exactly the 5 intended tables
    const expectedAnonTables = [
      "stations",
      "environmental_readings",
      "environmental_events",
      "station_health_logs",
      "crop_thresholds",
      "soil_readings",
    ];
    const anonGrants = await client.query(
      `select table_name from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT'
       order by table_name`,
    );
    const anonTables = anonGrants.rows.map((r) => r.table_name);
    const missingGrants = expectedAnonTables.filter((t) => !anonTables.includes(t));
    const unexpectedGrants = anonTables.filter((t) => !expectedAnonTables.includes(t));
    record(
      "anon SELECT grants match exactly the 5 intended public tables",
      missingGrants.length === 0 && unexpectedGrants.length === 0,
      `have=[${anonTables.join(",")}] missing=[${missingGrants.join(",")}] unexpected=[${unexpectedGrants.join(",")}]`,
    );

    // 3b. anon has NO write-privilege grants anywhere in public schema
    const anonWriteGrants = await client.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`,
    );
    record(
      "anon has zero INSERT/UPDATE/DELETE grants",
      anonWriteGrants.rows.length === 0,
      anonWriteGrants.rows.map((r) => `${r.table_name}:${r.privilege_type}`).join(", "),
    );

    // 4. RLS policies for the public tables exist and are SELECT-only, `to anon`
    const expectedPolicies = [
      ["stations", "stations_public_select"],
      ["environmental_readings", "environmental_readings_public_select"],
      ["environmental_events", "environmental_events_public_select"],
      ["station_health_logs", "station_health_logs_public_select"],
      ["crop_thresholds", "crop_thresholds_public_select"],
      ["soil_readings", "soil_readings_public_select"],
    ];
    for (const [table, policyName] of expectedPolicies) {
      const policy = await client.query(
        `select cmd, roles, qual from pg_policies
         where schemaname = 'public' and tablename = $1 and policyname = $2`,
        [table, policyName],
      );
      const row = policy.rows[0];
      const isSelectOnlyForAnon =
        row && row.cmd === "SELECT" && Array.isArray(row.roles) && row.roles.includes("anon");
      record(
        `RLS policy ${policyName} is SELECT-only, scoped to anon`,
        Boolean(isSelectOnlyForAnon),
        row ? `cmd=${row.cmd} roles=${row.roles}` : "policy not found",
      );
    }

    // 5. RLS is actually enabled (not just policies defined with RLS off, which would be a no-op)
    const rlsEnabled = await client.query(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace
         and relname = any($1::text[])`,
      [expectedAnonTables],
    );
    const allEnabled = rlsEnabled.rows.length === 5 && rlsEnabled.rows.every((r) => r.relrowsecurity === true);
    record(
      "RLS is enabled (not just policies defined) on all 5 public tables",
      allEnabled,
      rlsEnabled.rows.map((r) => `${r.relname}=${r.relrowsecurity}`).join(", "),
    );

    // 6. sensitive tables have NO anon grant at all
    const sensitiveTables = [
      "devices",
      "ingestion_audit_logs",
      "users",
      "station_assignments",
      "damage_logs",
      "firmware_updates",
      "admin_allowed_emails",
      "gateway_observations",
    ];
    const sensitiveGrants = await client.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public' and table_name = any($1::text[])`,
      [sensitiveTables],
    );
    record(
      "sensitive tables have zero anon grants of any kind",
      sensitiveGrants.rows.length === 0,
      sensitiveGrants.rows.map((r) => `${r.table_name}:${r.privilege_type}`).join(", "),
    );

    // 7. relevant indexes exist for the public dashboard's actual query patterns
    const expectedIndexes = [
      ["environmental_readings", "idx_environmental_readings_station_time"],
      ["station_health_logs", "idx_station_health_logs_station_time"],
    ];
    for (const [table, indexName] of expectedIndexes) {
      const index = await client.query(
        `select indexname from pg_indexes where schemaname = 'public' and tablename = $1 and indexname = $2`,
        [table, indexName],
      );
      record(`index ${indexName} exists on ${table}`, index.rows.length === 1);
    }

    // 8. gateway_observations is commented as deprecated (documentation-in-schema check)
    const tableComment = await client.query(
      `select obj_description('public.gateway_observations'::regclass, 'pg_class') as comment`,
    );
    const commentText = tableComment.rows[0]?.comment ?? "";
    record(
      "gateway_observations carries a deprecation comment",
      commentText.toLowerCase().includes("deprecated"),
      commentText.slice(0, 80),
    );
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Part B: behavioral checks via the real REST API (anon vs service-role) —
// this is what actually matters, since it's the exact path the app uses.
// ---------------------------------------------------------------------------

async function restRequest(table, { apikey, method = "GET", query = "", body } = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${apikey}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { Prefer: "return=minimal" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, ok: response.ok, text: await response.text() };
}

async function runBehavioralChecks() {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !anonKey || !serviceKey) {
    record("behavioral: SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY configured", false, "one or more missing");
    return;
  }

  // Public reads succeed with anon key
  for (const table of ["stations", "environmental_readings", "environmental_events", "station_health_logs", "crop_thresholds", "soil_readings"]) {
    const res = await restRequest(table, { apikey: anonKey, query: "?select=*&limit=1" });
    record(`anon can SELECT ${table}`, res.ok, `status=${res.status}`);
  }

  // Sensitive reads fail with anon key
  for (const table of ["devices", "ingestion_audit_logs", "users", "station_assignments", "damage_logs", "admin_allowed_emails", "firmware_updates"]) {
    const res = await restRequest(table, { apikey: anonKey, query: "?select=*&limit=1" });
    record(`anon CANNOT SELECT ${table}`, !res.ok, `status=${res.status}`);
  }

  // anon cannot write to a public table either (no insert policy/grant was added)
  const writeAttempt = await restRequest("stations", {
    apikey: anonKey,
    method: "POST",
    body: { id: "VERIFY_SHOULD_FAIL", name: "should not be writable by anon", lat: 0, lng: 0, status: "active" },
  });
  record("anon CANNOT INSERT into stations", !writeAttempt.ok, `status=${writeAttempt.status}`);

  // service-role can read everything, including sensitive tables
  for (const table of ["devices", "ingestion_audit_logs"]) {
    const res = await restRequest(table, { apikey: serviceKey, query: "?select=*&limit=1" });
    record(`service-role CAN SELECT ${table}`, res.ok, `status=${res.status}`);
  }

  // environmental_readings/events must not expose anything beyond the columns the schema defines
  // (spot-check: message_id should be present — it's the idempotency key, not a secret; there is
  // no column in this table that should be redacted, unlike devices.device_secret)
  const readingRes = await restRequest("environmental_readings", { apikey: anonKey, query: "?select=*&limit=1" });
  if (readingRes.ok) {
    try {
      const rows = JSON.parse(readingRes.text);
      const columns = rows[0] ? Object.keys(rows[0]) : [];
      const unexpectedSensitiveColumn = columns.some((c) => /secret|token|password|key/i.test(c));
      record(
        "environmental_readings exposes no secret-shaped column",
        !unexpectedSensitiveColumn,
        `columns=[${columns.join(",")}]`,
      );
    } catch {
      record("environmental_readings response is valid JSON", false, readingRes.text.slice(0, 100));
    }
  }
}

async function main() {
  console.log("=== Schema checks (direct Postgres) ===");
  await runSchemaChecks().catch((error) => {
    record("schema checks completed without throwing", false, String(error.message ?? error).slice(0, 200));
  });

  console.log("\n=== Behavioral checks (REST API, anon vs service-role) ===");
  await runBehavioralChecks().catch((error) => {
    record("behavioral checks completed without throwing", false, String(error.message ?? error).slice(0, 200));
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("Failed checks:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exitCode = 1;
  }
}

main();
