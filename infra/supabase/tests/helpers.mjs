import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.supabase");
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

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.DATABASE_POOLER_URL ?? null;
}

export async function withClient(fn) {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return { skipped: true, reason: "DATABASE_URL not set" };
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (error) {
    return { skipped: true, reason: error instanceof Error ? error.message : String(error) };
  }

  try {
    const value = await fn(client);
    return { skipped: false, value };
  } finally {
    await client.end();
  }
}

export async function asAuthenticatedUser(client, userId, fn) {
  await client.query("begin");
  try {
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await client.query("set local role authenticated");
    await fn(client);
  } finally {
    await client.query("rollback");
  }
}

export async function createAuthUser(client, { id, email }) {
  await client.query(`delete from public.users where id = $1`, [id]).catch(() => undefined);
  await client.query(`delete from auth.users where id = $1`, [id]).catch(() => undefined);

  await client.query(
    `
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      $1,
      'authenticated',
      'authenticated',
      $2,
      crypt('test-password', gen_salt('bf')),
      now(),
      now(),
      now()
    )
    on conflict (id) do update set email = excluded.email
    `,
    [id, email],
  );
}

export async function createAppUser(client, { id, email, role = "farmer" }) {
  await createAuthUser(client, { id, email });

  if (role === "admin") {
    await client.query("alter table public.users disable trigger users_prevent_role_escalation");
    try {
      await client.query(
        `
        insert into public.users (id, email, role)
        values ($1, $2, 'admin')
        on conflict (id) do update set email = excluded.email, role = 'admin'
        `,
        [id, email],
      );
    } finally {
      await client.query("alter table public.users enable trigger users_prevent_role_escalation");
    }
    return;
  }

  await client.query(
    `
    insert into public.users (id, email, role)
    values ($1, $2, 'farmer')
    on conflict (id) do update set email = excluded.email, role = 'farmer'
    `,
    [id, email],
  );
}

export async function assignStation(client, { userId, stationId }) {
  await client.query(
    `
    insert into public.station_assignments (user_id, station_id)
    values ($1, $2)
    on conflict do nothing
    `,
    [userId, stationId],
  );
}
