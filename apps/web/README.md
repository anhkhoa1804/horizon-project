# Horizon Web

Next.js 15 PWA for the Horizon environmental monitoring system (Cồn Hô network).

## Local Setup

```bash
cp apps/web/.env.local.example apps/web/.env.local
npm install
npm run dashboard
```

Open:

```text
http://localhost:4173
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_ALLOWED_EMAILS=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
GATEWAY_INGEST_TOKEN=
```

Supabase variables are optional for local UI work. When they are missing, the app falls back to demo data and admin changes that require storage will not persist.

`SUPABASE_SERVICE_ROLE_KEY` is required on the server for admin data, public report storage, gateway storage, and database-managed admin emails.

`ADMIN_ALLOWED_EMAILS` is a comma-separated list of Gmail/email accounts that can open `/admin`.

`ADMIN_PASSWORD` is the simple local admin password. The default development fallback is `horizon2026`.

`ADMIN_SESSION_SECRET` signs the local admin cookie. Set a long random value before sharing the app outside your machine.

`GATEWAY_INGEST_TOKEN` is the shared secret guarding Supabase `edge-ingest`, the LoRa gateway's 4G ingest path. The gateway sends it as an `x-gateway-token` header.

**This path fails closed.** With no token configured, the Edge Function rejects relay authentication; with a token configured it rejects a request whose header does not match. A deployment without this variable therefore ingests no telemetry at all.

Server-side only. Never rename it to `NEXT_PUBLIC_GATEWAY_INGEST_TOKEN`, which would inline the secret into the client bundle at build time. The value must match `GATEWAY_INGEST_TOKEN_VALUE` in `firmware/esp32-node/src/gateway_secrets.h` (gitignored; copy `gateway_secrets.example.h` to create it).

Example:

```env
ADMIN_ALLOWED_EMAILS=owner@gmail.com,operator@gmail.com
```

After signing in with an email from `ADMIN_ALLOWED_EMAILS`, open `/admin`. If Supabase is configured, "Gmail được phép quản trị" can add or revoke other admin emails in `admin_allowed_emails` from migration `017_admin_allowed_emails.sql`.

## Public Routes

- `/` - Home
- `/dashboard` - Monitoring map, chart, daily comparison table
- `/s/[stationId]` - Station detail page
- `/report` - Community report page

## Admin Routes

- `/admin/login` - Email + shared password login
- `/admin` - Operations console, admin email allowlist, report notifications, and sleep-mode control

## Data Retention

The pilot can keep raw station data for about one year because data volume is still small. Migration `015_retention_policy.sql` adds:

- hourly rollup table for water telemetry
- `rollup_environmental_readings_hourly()`
- `cleanup_horizon_data()`

Suggested defaults:

- raw readings, gateway observations, health logs, events: 365 days
- audit logs: 90 days
- hourly rollups: 1095 days

When data volume grows, schedule `cleanup_horizon_data()` with Supabase cron or an external scheduler.
