# HORIZON (Cồn Hô)

Environmental monitoring platform for a farming community on Cồn Hô, an
island in Vĩnh Long, Vietnam. Originally built as "Eco-Sense Cồn Hô" — that
name persists in some technical identifiers (npm workspace scopes) and is
not renamed without a deliberate migration.

**For the real, current, source-verified architecture — station topology,
what's live vs. not yet deployed, whether GCP is required — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** This file is a short
front door only; it is not the source of truth for architecture claims.

## What this is

Three physical field devices (a water station, a soil station, and a
gateway) relay signed telemetry to a Supabase Edge Function, which
validates and stores it in Postgres. A Next.js PWA reads that data for a
public dashboard, per-station pages, a community field-report flow, and a
password-gated admin console. Full handbook: [`docs/README.md`](docs/README.md).

## Repository structure

```text
.
├── apps/web/              Next.js 15 PWA (public + admin)
├── services/edge-ingestion/  Telemetry validation logic + Deno edge function source
├── firmware/esp32-node/   ESP32 firmware (station1 / station2 / gateway)
├── infra/supabase/        SQL migrations, seed data, deploy/verify scripts
└── docs/                  Product handbook — start at docs/README.md
```

## Local development

```bash
npm install
npm run check         # typecheck all workspaces
npm run test           # edge-ingestion contract tests (mocked, no network)
npm run test:web       # web app unit tests (mocked, no network)
npm run dashboard       # start the Next.js app at http://localhost:4173
```

`npm run simulator` and `npm run mock:ingest` generate synthetic telemetry
for local UI development. **Correction (Phase G):** an earlier version of
this README claimed these write to a live Supabase project if pointed at
one — that was checked against the source and found to be wrong. Both
scripts hardcode `MockDb` (`services/edge-ingestion/src/mockDb.ts`) with
no network code path at all; `simulator.ts` only writes local files under
`apps/web/mock/*.json`, `mock_ingest.ts` only logs to the console. Neither
can write to a real Supabase project regardless of environment variables.

### Test tiers — what's safe to run

| Command | Tier | Writes to live Supabase? |
|---|---|---|
| `npm run check`, `npm run lint` | Static analysis | No |
| `npm run test`, `npm run test:web` | Unit / mocked | No — no network calls |
| `npm run simulator`, `npm run mock:ingest` | Synthetic telemetry generator | **No — `MockDb` only, no network code path exists** |
| `npm run test:rls` | Mocked unless `RUN_RLS_TESTS=1` | **Yes if enabled** — creates real throwaway users/assignments |
| `npm run test:integration`, `npm run test:all` | Live integration | **Yes if `LIVE_SUPABASE_INTEGRATION=1`** — POSTs real signed telemetry through `edge-ingest` |

`test:rls` and `test:integration`/`test:all` are the only commands that
require caution — both need deliberately-set env vars and should not be
run against this project's live Supabase instance without a specific
reason. `.github/workflows/ci-live-smoke.yml` runs both on a weekly cron
if its GitHub secrets are configured — see `docs/ARCHITECTURE.md` for the
current status of that workflow.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

See [`apps/web/README.md`](apps/web/README.md) for the full list including
admin-auth variables.

## Current status

Backend and frontend are live against a real Supabase project (migrations
001–025 applied). Three GitHub Actions workflows
exist under `.github/workflows/` (validation on every PR/push, a weekly
live-integration smoke test, and a tag-triggered release/deploy pipeline)
— and the current token-authenticated gateway route retains real observation
envelopes and promotes their nested water/soil readings. Physical installation
and field calibration are not established by the repository alone.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#deployment-status-current-vs-future)
for the exact current-vs-future boundary, and
[`docs/EDGE_INGEST_READINESS.md`](docs/EDGE_INGEST_READINESS.md) for what's
blocking a real deployment.

## License

All rights reserved unless otherwise specified.
