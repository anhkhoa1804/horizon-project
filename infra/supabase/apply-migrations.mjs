import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env.supabase");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const migrationsDir = path.join(__dirname, "migrations");
const pilotSeedPath = path.join(__dirname, "seed", "pilot_seed.sql");

const SCHEMA_MIGRATIONS_DDL = `
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
`;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.DATABASE_POOLER_URL ?? null;
}

async function readSqlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function ensureMigrationsTable(client) {
  await client.query(SCHEMA_MIGRATIONS_DDL);
}

async function isMigrationApplied(client, version) {
  const { rows } = await client.query(
    "select 1 from public.schema_migrations where version = $1",
    [version],
  );
  return rows.length > 0;
}

async function recordMigration(client, version) {
  await client.query(
    "insert into public.schema_migrations (version) values ($1) on conflict do nothing",
    [version],
  );
}

async function bootstrapExistingDatabase(client, migrationFiles) {
  const { rows } = await client.query("select count(*)::int as count from public.schema_migrations");
  if (rows[0].count > 0) {
    return false;
  }

  const { rows: stationRows } = await client.query(
    "select to_regclass('public.stations') as stations",
  );
  if (!stationRows[0]?.stations) {
    return false;
  }

  console.log("Bootstrapping schema_migrations for existing database (skipping re-apply of historical SQL).");
  for (const filePath of migrationFiles) {
    await recordMigration(client, path.basename(filePath));
  }
  await recordMigration(client, "seed/pilot_seed.sql");
  return true;
}

async function applyMigrationFile(client, filePath) {
  const version = path.basename(filePath);
  if (await isMigrationApplied(client, version)) {
    console.log(`Skipping ${version} (already applied)`);
    return false;
  }

  const sql = await readFile(filePath, "utf8");
  console.log(`Applying ${version}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await recordMigration(client, version);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return true;
}

async function applyPilotSeed(client) {
  const version = "seed/pilot_seed.sql";
  const sql = await readFile(pilotSeedPath, "utf8");
  console.log(`Applying ${version} (idempotent upserts)`);
  await client.query(sql);
  await recordMigration(client, version);
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error("DATABASE_URL or DATABASE_POOLER_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const migrationFiles = await readSqlFiles(migrationsDir);
    const bootstrapped = await bootstrapExistingDatabase(client, migrationFiles);

    let applied = 0;
    if (!bootstrapped) {
      for (const filePath of migrationFiles) {
        if (await applyMigrationFile(client, filePath)) {
          applied += 1;
        }
      }
    } else {
      for (const filePath of migrationFiles) {
        const version = path.basename(filePath);
        if (!(await isMigrationApplied(client, version))) {
          if (await applyMigrationFile(client, filePath)) {
            applied += 1;
          }
        }
      }
    }

    if (!(await isMigrationApplied(client, "seed/pilot_seed.sql"))) {
      await applyPilotSeed(client);
    } else {
      console.log("Applying seed/pilot_seed.sql (idempotent upserts)");
      const sql = await readFile(pilotSeedPath, "utf8");
      await client.query(sql);
    }
    console.log(`Migrations complete (${applied} new migration(s) applied). Pilot seed refreshed.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
