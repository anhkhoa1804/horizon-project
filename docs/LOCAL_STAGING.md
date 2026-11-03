# Local staging (isolated Supabase stack)

Purpose: run the real Supabase building blocks — Postgres, Auth, PostgREST, Storage, Edge Runtime — on one
machine, rebuild the schema from the repository migrations, and run the video-upload and Admin end-to-end tests
without touching the production project or needing a second cloud project.

**Nothing here reaches production.** The stack binds to `127.0.0.1`, every secret is generated locally and thrown
away with the stack, and both E2E scripts refuse to run against a non-loopback URL.

## What is in the stack

| Service | Image | Notes |
|---|---|---|
| Postgres 15 | `supabase/postgres:15.8.1.085` | the image Supabase itself ships; roles/extensions preinstalled |
| Auth | `supabase/gotrue:v2.164.0` | present for parity; the web app's Admin uses its own signed-cookie session |
| REST | `postgrest/postgrest:v12.2.3` | real PostgREST, so RLS/column grants are exercised exactly as in the cloud |
| Storage | `supabase/storage-api:v1.11.13` | file backend; the `report-evidence` bucket is created by migration 026 |
| Edge Functions | `supabase/edge-runtime:v1.65.3` | serves `edge-ingest` (local copy swaps the `deno.land` import for `Deno.serve`) |
| Gateway | `nginx:1.27-alpine` | one URL, `http://127.0.0.1:54321`, routing `/rest/v1 /auth/v1 /storage/v1 /functions/v1` |

Why not the Supabase CLI? Its release binary and npm package could not be downloaded from this build sandbox. The CLI
runs the same images, so this compose file is equivalent for our purposes. On a developer machine
`supabase start` (see `infra/supabase/config.toml`) is the simpler route and the two scripts work with either:
point `SUPABASE_LOCAL_URL`/`WEB_URL` at it.

## Bring it up

```bash
cd infra/supabase/local-stack
node gen-env.mjs                       # throw-away JWT secret, anon/service keys, DB + admin passwords -> .env.local-stack (git-ignored)
./prep-functions.sh                    # local copy of the edge function (no deno.land download)
docker compose --env-file .env.local-stack up -d db
./init-roles.sh                        # set the image's service-role passwords
docker compose --env-file .env.local-stack up -d rest auth storage functions gateway
./apply-repo-migrations.sh             # migrations 001-035 + pilot seed, one transaction each
./run-web.sh dev                       # Next.js on http://127.0.0.1:3100 wired to the local stack
```

## Run the tests

```bash
node scripts/staging/report-upload.e2e.mjs      # real MP4 through signed-URL upload -> finalize -> DB/Storage checks (19 checks)
node scripts/staging/admin-e2e.cjs              # Playwright: authorization boundary + every Admin flow, DB-verified (32 checks)
(cd infra/supabase/tests && RUN_RLS_TESTS=1 DATABASE_URL=... SUPABASE_URL=... SUPABASE_ANON_KEY=... node --test rls.test.mjs)   # 15 RLS checks
```

Results are written next to the scripts (`*.result.json`); Admin screenshots go to `docs/qa/screenshots/admin-local/`.

## Tear down

```bash
docker compose --env-file .env.local-stack down -v      # removes containers AND the data volumes
rm infra/supabase/local-stack/.env.local-stack
```

## What local staging does NOT prove

- Supabase **cloud** specifics: Free-plan limits (Storage size, egress), the hosted Auth/SMTP configuration, the
  hosted Storage CDN, Vercel's 4.5 MB body limit (the reason uploads go direct to Storage — verified here only as
  "the browser-equivalent direct path works", not as a Vercel measurement).
- Real phone-network behaviour of a 20 MB upload.
- Anything about the physical devices, firmware, LoRa link or gateway.
- Production data shape. Fixtures here are synthetic and labelled `SYNTHETIC`.

Those residual items are the reason a final **post-deploy smoke test on production** is still listed in
`docs/RELEASE_REPORT.md`; it is read-only except for one disposable report that needs your explicit approval.
