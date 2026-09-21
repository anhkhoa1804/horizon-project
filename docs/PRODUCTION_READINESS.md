# HORIZON — Production Readiness

Operational reference. Last verified 2026-08-28 against source, migrations and
the live Supabase project. Supersedes readiness claims in earlier phase reports.

Two questions are kept separate throughout, because the answers differ:

- **Safe to expose publicly** — can this be on the Internet without harm?
- **Fully operational** — does every intended capability actually work?

---

## 1. Architecture

```
ESP32 nodes (trạm 1 water, trạm 2 soil)
   └─ LoRa ─> gateway.ino ─ HTTPS + HMAC ─> edge-ingest (Supabase Edge Function)
                                                 └─> Postgres (Supabase)
                                                        └─> apps/web (Next.js 15, Vercel)
                                                               ├─ anon key   : public reads (RLS-bound)
                                                               └─ service key: admin + report writes
External: Open-Meteo (weather, keyless) · Esri Canvas (map tiles, keyless)
```

npm workspaces: `apps/web`, `services/edge-ingestion`, `infra/supabase`,
`firmware/esp32-node`.

---

## 2. Deployment (Vercel)

**Root Directory must be set to `apps/web`.** This is the one setting that
cannot be expressed in the repository — Vercel reads it before it reads any
file. Everything else is now in-repo:

| Concern | Where | Value |
|---|---|---|
| Framework | `apps/web/vercel.json` | `nextjs` |
| Install (workspace-aware) | `apps/web/vercel.json` | `npm install --workspaces --include-workspace-root` |
| Node version | root `package.json` `engines` | `>=22 <25` |
| Build command | auto-detected | `next build` |
| Security headers | `apps/web/next.config.ts` | see §9 |
| Health cache | `apps/web/vercel.json` | `no-store` on `/api/health` |

Headers live in `next.config.ts` rather than `vercel.json` so they survive a
change of host.

**Fresh-clone deploy:** import repo → set Root Directory `apps/web` → add the
variables in §3 to Production *and* Preview → deploy → run §12.

Region is left at the Vercel default. If latency to Vietnam matters, set it to
`sin1` in the dashboard; it is deliberately not pinned here because the right
choice depends on where the Supabase project lives.

---

## 2a. CRITICAL — device secrets are public

**Production device-secret rotation remains a release gate.** The former
five-node fixture topology has been removed; the canonical registry is
`GATEWAY_01` plus `STATION_01`–`STATION_03`. The seed contains public
development placeholders for fresh local setups, so the release checker must
be run against production before telemetry is exposed. This document does not
claim the current production secrets have been rotated.

`device_secret` is the HMAC key `services/edge-ingestion` uses to authenticate
telemetry (`canonical.ts` → `signPayload`). Anyone who can read this repository
can therefore forge signed readings into `environmental_readings` — fabricated
salinity and water levels, indistinguishable downstream from real ones. That is
the precise failure this project's data-honesty rules exist to prevent.

Two things made it durable, and one is now fixed:

- The seed re-runs on **every** `npm run db:migrate`, and its upsert carried
  `device_secret = excluded.device_secret` — so a rotated production secret was
  silently reset to the public placeholder on the next deploy. **Fixed:**
  `device_secret` no longer appears in the update clause. New rows still get a
  placeholder (that is what makes a fresh clone work); existing rows keep
  whatever the operator set.
- The secrets themselves are still the placeholders in the live database.
  **This requires an operator action and has not been performed** — rotating
  them is a production mutation, and it would break a deployed gateway that is
  still holding the old value.

### Rotation procedure (required before exposing ingestion)

```sql
-- Per device, against the production database. Use a distinct, random value.
update public.devices
   set device_secret = '<32+ random bytes, unique per device>'
 where device_id = 'STATION_01';
```

Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
The same value must be flashed into that node's firmware. Verify with
`npm run verify` — it now **fails** while any placeholder remains.

It is a **release blocker for the telemetry path**, not for the public
read-only site. See `CURRENT_PRODUCT_STATUS.md` and the field release
checklist for the current verification boundaries.

---

## 3. Environment variables

### Needed by the deployed web app (Vercel)

| Variable | Required | Read by | Secret |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` **or** `SUPABASE_URL` | **yes** | `lib/supabase/env.ts` → both clients | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` **or** `SUPABASE_ANON_KEY` | **yes** | public reads | no (RLS-bound) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | admin + report writes, health probe | **yes** |
| `ADMIN_PASSWORD` | for `/admin` | login | **yes** |
| `ADMIN_SESSION_SECRET` | for `/admin` | session HMAC (≥32 random bytes) | **yes** |
| `ADMIN_ALLOWED_EMAILS` | for `/admin` | login allowlist (comma-separated) | no |
| `VERCEL_GIT_COMMIT_SHA` | auto | `/api/health` build id | no |

**Either spelling of the first two works.** The web app used to accept only the
`NEXT_PUBLIC_` names while the rest of the monorepo uses the unprefixed ones —
a deployment configured with `SUPABASE_URL` got null clients and silently
served **demo data** with every page returning 200. `lib/supabase/env.ts` now
accepts both (prefixed wins); `tests/supabaseEnvNames.test.ts` pins it.

This is safe: both Supabase clients are `server-only` and no client component
imports them, so neither value is inlined into the browser bundle — the
`NEXT_PUBLIC_` prefix here is a naming convention, not a publication boundary.
`tests/secretBoundary.test.ts` still fails the build if a third `NEXT_PUBLIC_`
variable appears or if an admin/service secret is given that prefix.

### Not read by the web app

These belong to other workspaces. Setting them in Vercel is harmless but does
nothing for the site:

| Variable | Actually read by |
|---|---|
| `DATABASE_URL` | `infra/supabase/apply-migrations.mjs`, `verify-deploy.mjs`, RLS tests |
| `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` | `infra/supabase` deploy scripts / Supabase CLI |
| `SUPABASE_ANON_KEY` (as a *verifier* input) | `infra/supabase/verify-deploy.mjs` |
| `EDGE_INGEST_URL` | ingestion integration tests / gateway config — **no web code path reads it** |
| `MAX_TIMESTAMP_DRIFT_SECONDS` | `services/edge-ingestion/src/config.ts` (the Edge Function's own secret set, not Vercel) |

`EDGE_INGEST_URL` and `MAX_TIMESTAMP_DRIFT_SECONDS` are consumed by the
Supabase Edge Function and its tests, which read their configuration from
Supabase Function secrets — not from Vercel's environment.

No key is required for weather or map tiles.

**Behaviour when admin variables are missing:** login is refused with an
explicit "not configured" message, and `/admin` redirects to the login page.
It does **not** throw. Earlier it did — an unconfigured deployment answered
every admin request with an unhandled 500 that named the missing variable in
the dev overlay.

### Admin secret requirements

| Variable | Mandatory for `/admin` | Requirement | Example shape |
|---|---|---|---|
| `ADMIN_SESSION_SECRET` | yes | ≥32 bytes of entropy. Rotating it invalidates every live session. | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PASSWORD` | yes | Long random string. It is compared, never hashed at rest, and is shared by all allowlisted emails — treat it as a service credential, not a human password. | 24+ random chars |
| `ADMIN_ALLOWED_EMAILS` | strongly recommended | Comma-separated, lower-cased. Without it the allowlist falls back to the `admin_allowed_emails` table, which is empty — so nobody can log in. | `a@example.com,b@example.com` |

Set all three in Vercel under **Settings → Environment Variables**, scoped to
**Production and Preview** (a Preview deployment without them has an unusable
admin, which is safe but confusing). Locally they go in `apps/web/.env.local`,
which is git-ignored.

Verify after deploy: `GET /api/health` reports `checks.adminAuthConfigured`.

---

## 4. Authentication

Not Supabase Auth. A self-contained scheme, retained deliberately.

**Decision: keep the custom model for this pilot.** Migrating to Supabase Auth
would add an email/OAuth provider, a second session system, and a user-profile
sync path, to serve one operator on a pilot with no IAM requirement. The
mechanism below is sound; its weaknesses are about *scale of team*, not about
whether it holds. Revisit when there is more than one operator, or when
per-actor audit becomes a requirement.

- Login posts email + password to a Server Action.
- Email must be on the allowlist (`ADMIN_ALLOWED_EMAILS`, or the
  `admin_allowed_emails` table).
- Password compared to `ADMIN_PASSWORD` with `timingSafeEqual`.
- Cookie `horizon_admin_session` = `base64url(payload).HMAC-SHA256(payload)`.

Cookie flags — verified in `lib/auth/localAdminSession.ts`:

| Flag | Value | Note |
|---|---|---|
| `httpOnly` | true | not readable from JS |
| `sameSite` | `lax` | survives the post-login top-level navigation; blocks cross-site POST |
| `secure` | `NODE_ENV === "production"` | correct — always-on would break `http://localhost` |
| `path` | `/` | |
| `maxAge` | 12 h | expiry also signed into the payload, so it is enforced server-side |

Enforcement is layered:

1. `middleware.ts` — edge-level shape check; redirects a missing/short cookie.
   It cannot verify the HMAC (no `node:crypto` in the Edge runtime).
2. `requireAdmin()` in `app/admin/page.tsx` — **authoritative**: verifies
   signature and expiry, re-checks the allowlist.
3. Every admin Server Action calls `requireAdmin()` independently, so a
   directly-invoked action cannot bypass the page check.

**Verified end-to-end** on 2026-08-28 against an isolated dev server with
throwaway credentials (destroyed afterwards; production was not touched):

| Case | Result |
|---|---|
| `/admin` unauthenticated | `307 → /admin/login?redirect=/admin` |
| `/admin` malformed / forged cookie | `307 → /admin/login` |
| `/admin` expired payload + bad signature | `307 → /admin/login` |
| Login, wrong password | `?error=bad-password`, no session issued |
| Login, correct password, allowlisted email | `→ /admin`, console renders |
| Login, correct password, **non**-allowlisted email | `?error=unauthorized`, access refused |
| Session cookie readable from JavaScript | **no** — httpOnly confirmed |
| Logout | `→ /admin/login`, session cleared |
| Direct navigation to `/admin` after logout | `307 → /admin/login` |

The mechanism is proven. It is unusable on this deployment only because the
three variables above are unset.

**Known limitations.** One shared password across all allowlisted emails: the
email selects *who*, not *what they may do*; no rotation, no 2FA, no per-actor
audit. Login throttling is per-process and in-memory (5 per 15 min per email),
so it resets on cold start and does not span instances. Distinct error codes
for "not allowlisted" vs "wrong password" permit allowlist enumeration.

Logout clears the cookie; there is no server-side session store, so a stolen
cookie stays valid until its 12-hour expiry. Rotating `ADMIN_SESSION_SECRET`
invalidates every session at once and is the emergency lever.

---

## 5. Database & RLS

RLS is enabled on every application table. Verified against the live project
with the anon key:

| Table | anon read | anon write |
|---|---|---|
| `stations`, `environmental_readings`, `soil_readings`, `crop_thresholds`, `environmental_events`, `station_health_logs` | 200 (intended public) | **denied** |
| `damage_logs`, `users`, `devices`, `ingestion_audit_logs` | **401** | **denied** |
| `admin_allowed_emails`, `device_runtime_configs` | 200, 0 rows (RLS filters) | **denied** |

Insert attempts against `damage_logs`, `stations` and `environmental_readings`
were all rejected with `42501 new row violates row-level security policy`.
**An unauthenticated user cannot modify any data.**

### Pending migrations — apply before release

Confirmed by `npm run verify` against the live database: **20 recorded, 2
pending.** Both are **SAFE TO APPLY**.

The runner (`infra/supabase/apply-migrations.mjs`, invoked by
`npm run db:migrate`) tracks applied versions in `public.schema_migrations`,
skips anything already recorded, and wraps each file in a transaction that
rolls back on error. Neither migration contains a destructive statement — no
`drop table`, no `delete`, no `truncate`, no column removal.

> **Note:** `db:migrate` also re-runs `seed/pilot_seed.sql` every time. That is
> idempotent (upserts on `stations` and `devices`) and, since the fix described
> in §2a, no longer overwrites `device_secret`.

- **`020_revoke_anon_admin_surface.sql`** — removes the residual anon SELECT
  grant on `admin_allowed_emails`, `device_runtime_configs` and
  `gateway_observations`. Those tables are currently protected by RLS alone
  (200-with-zero-rows); every other sensitive table is protected by a missing
  grant *and* a missing policy. Safe: it revokes a privilege that returns
  nothing today, and the app reads both tables through the service role, which
  ignores anon grants. There is **no dangerous grant requiring emergency
  action** — this is depth, not a hole.
- **`021_report_rate_limits.sql`** — the durable rate-limit counter (§7).

Apply with `npm run db:migrate`. Verify afterwards: anon reads of
`admin_allowed_emails` should return **401** instead of 200.

---

## 6. API routes

| Route | Method | Auth | Validation | Rate limit |
|---|---|---|---|---|
| `/api/public/reports` | POST | none (public by design) | category allowlist, 10–2000 chars, JSON guard | yes — §7 |
| `/api/public/gateway/configs` | GET | none | returns safe defaults only when the database is reachable | none needed |
| `/api/health` | GET | none | n/a | none needed |

Verified: `400 invalid_json`, `400 invalid_category`, `400
description_too_short`, `405` on GET to reports.

`/auth/callback` **has been removed** — it was a Supabase-Auth OAuth callback
that nothing linked to, and a session it created would have been ignored by
`getSessionContext()`. Its exclusive dependencies (`lib/supabase/server.ts`,
`lib/supabase/client.ts`, `lib/auth/bootstrap.ts`) went with it.

`/api/public/gateway/configs` fails closed with a generic 503 when the database
is unavailable or its query fails; it does not disclose an upstream error.

---

## 7. Rate limiting

Two layers, in `lib/reports/rateLimit.ts`:

1. **Durable** — a Postgres fixed-window counter shared by every serverless
   instance, via `consume_report_rate_limit()` (migration 021). Row-locked, so
   concurrent callers cannot both read the same count. **This is the real
   control.**
2. **Memory** — the original per-process Map, retained as a fallback for when
   the durable path is unavailable (no Supabase, or 021 not yet applied).

It never fails open: a database error falls through to the memory limiter
rather than admitting the request, and the route logs
`reports.rate_limit_degraded` when that happens.

**Client identity was also a bug.** The old key was the *leftmost*
`x-forwarded-for` entry — the part the caller sends — so rotating that header
bought unlimited quota. It now prefers platform-set headers
(`x-vercel-forwarded-for`, `x-real-ip`) that Vercel overwrites at the edge, and
falls back to the *rightmost* forwarded hop. **Behind a non-Vercel proxy, an
operator must confirm which header their edge sets.**

**Current state: migration 021 is not applied, so the memory fallback is what
runs.** Limits are per-instance until it is.

Admin login throttling is still memory-only (§4).

---

## 8. Observability

- **Logging** — `lib/observability/logger.ts`: one JSON line per event on
  stdout/stderr, which Vercel already collects and indexes. Every field passes
  a redaction filter that drops key/token/secret/password/cookie-shaped keys
  and truncates long values, so a future caller cannot casually log a
  service-role key or a Postgres error containing user text.
- **Error tracking** — none. Sentry was considered and deliberately deferred:
  it adds a vendor, a DSN across three environments, a client bundle and a
  privacy surface, to solve a problem a one-operator pilot does not have yet.
  Adopt it when there is a team to notify, or when reading logs by hand stops
  working.
- **Health** — `GET /api/health` returns `status`, `environment`, short commit
  SHA, and three checks: `database`, `weather`, `adminAuthConfigured`. Returns
  503 when the database is unreachable; weather being down does **not** turn
  it red, because the UI degrades gracefully without it. Exposes no secrets,
  URLs, row counts or user data.

---

## 9. Security

| Control | State |
|---|---|
| Secrets | `SUPABASE_SERVICE_ROLE_KEY` read in exactly one `server-only` module; test-enforced |
| Client exposure | Only two `NEXT_PUBLIC_*` variables; test-enforced |
| Cookies | httpOnly, sameSite=lax, secure in production, signed, 12 h |
| RLS | Verified empirically — no anon writes anywhere |
| Open redirect | **Fixed.** `/admin/login?redirect=/\evil.com` bypassed the old guard (browsers normalise `\`→`/`, giving `//evil.com`). Now allowlist-validated in `lib/auth/safeRedirect.ts` |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, no `X-Powered-By` |
| CSP | **Not yet.** Needs per-request nonces for Next's inline bootstrap; fails visibly when wrong, so it deserves its own verified pass |
| SQL injection | No raw SQL in the app; all access via PostgREST client bindings |
| SSRF | Only two outbound hosts, both hard-coded constants; no user-controlled fetch |
| Upload | No upload path exists (§11) |
| Markdown | Posts are local MDX authored in-repo, not user input |
| CORS | No custom CORS; same-origin by default |

---

## 10. Telemetry readiness

Per stage, **without hardware available**:

| Stage | State |
|---|---|
| Firmware (water) | EC, water temperature, TDS, salinity and ultrasonic water-level reads implemented. **Hardware/site calibration unverified.** |
| Firmware (soil) | Implemented. **Hardware-unverified.** |
| Gateway relay | Implemented. **Hardware-unverified.** |
| Ingestion contract | Implemented + tested (25 tests) |
| Signature verification | Implemented — HMAC, timing-safe |
| Replay protection | Implemented — `message_id` idempotency + audit log |
| Database | Ready; gateway observations are retained and promoted into typed water and soil histories by migration 025 and the current ingest route |
| Repository layer | Implemented + tested (latest, 24h trend, daily trend; ordering, nulls, VN timezone) |
| Dashboard | Implemented; renders real rows whenever they appear |

**Blocked:** live end-to-end delivery cannot be verified without a node.

### Water EC and temperature

The Station 01 firmware and gateway payload carry EC and water temperature.
Migration 024 stores both as their own quantities; migration 025 promotes the
existing raw history. The signed v1 Edge contract still requires its older
salinity + water-level pair, while the active gateway HTTP path retains and
normalizes the richer envelope. No EC↔salinity conversion is performed in the
backend. Site calibration remains a physical verification task.

---

## 11. Not implemented

- **Zalo OA — NOT IMPLEMENTED.** Zero code references repo-wide. No token, no
  webhook, no message API. Migration 016 is only an in-app `viewed_at` flag.
  *Recommendation: after launch.* Nothing depends on it, and it needs an OA
  account plus review before it can be built honestly.
- **Image storage — NOT IMPLEMENTED.** No bucket, no policy, no upload path;
  `damage_logs.image_url` is never written. The report form previews a photo
  locally and states "photo storage is not supported yet". *Recommendation:
  after launch*, and only with a size/type-validated signed-upload path.

Neither is faked anywhere in the UI.

---

## 12. Release checklist

Ticked = verified in this repository. Unticked = requires the operator, the
Vercel/Supabase dashboards, or hardware. Nothing is ticked on the strength of
code inspection alone.

### Verified

- [x] Production build passes from a clean `.next`
- [x] Typecheck, lint, 179 web tests, 25 edge tests pass
- [x] RLS verified live — anon writes denied on every table (`42501`)
- [x] Weather live (Open-Meteo, keyless)
- [x] Map live (Esri Canvas, keyless, 3 real coordinates, no `0,0`)
- [x] Reports persist to Supabase
- [x] `/api/health` returns no secrets, `no-store`
- [x] Security headers present; `X-Powered-By` absent
- [x] Open-redirect guard in place
- [x] Admin auth **mechanism** verified end-to-end (login, logout, forged,
      expired, wrong password, non-allowlisted email)
- [x] Seed no longer resets rotated device secrets
- [x] `npm run verify` fails while placeholder device secrets remain

### Before deployment

- [ ] Vercel **Root Directory = `apps/web`** (dashboard only — cannot be
      encoded in the repo)
- [ ] Supabase variables set in Production **and** Preview
- [ ] `ADMIN_SESSION_SECRET` generated (≥32 bytes) and set
- [ ] `ADMIN_PASSWORD` set
- [ ] `ADMIN_ALLOWED_EMAILS` set
- [ ] `npm run verify` — green (env, DB reachable, pending migrations listed)
- [ ] `npm run db:migrate` — applies 020 and 021
- [ ] **Rotate all six device secrets** (§2a) — required before the ingestion
      endpoint is publicly reachable
- [ ] `npm run verify` again — device-secret check now passes

### After deployment

- [ ] `/api/health` green on the deployed URL; `adminAuthConfigured: true`
- [ ] Admin login verified against the deployed URL
- [ ] Report submission verified end-to-end
- [ ] Rate limiting verified — no `reports.rate_limit_degraded` in logs
- [ ] Anon read of `admin_allowed_emails` returns **401** (proves 020 applied)
- [ ] `crop_thresholds` seeded, or accept status-neutral salinity
- [ ] Production build succeeds on Vercel
- [ ] No secrets in client bundle (`tests/secretBoundary.test.ts` enforces)

---

## 13. Rollback

- **Application** — redeploy the previous Vercel deployment; the build is
  stateless and holds no migration state.
- **Migrations 020/021** — additive and reversible. To undo 020, re-grant
  `select` to `anon` on the three tables. To undo 021,
  `drop function public.consume_report_rate_limit(text,integer,integer)` and
  `drop table public.report_rate_limits` — the app falls back to the memory
  limiter automatically, no redeploy needed.
- **Admin lockout** — rotate `ADMIN_SESSION_SECRET` to invalidate every session
  immediately; all operators must log in again.
- **Data** — no destructive migration exists. Nothing in this release drops or
  rewrites a row.

---

## 14. Known blockers

**Critical**
- **Device secrets are the repo's public placeholders (§2a).** Blocks the
  telemetry path; does not block the public read-only site. Requires an
  operator to rotate, and the matching firmware flash.
- `ADMIN_*` variables unset — `/admin` is unusable. Fails closed, so it is an
  operability blocker, not an exposure risk.

**High**
- Migrations 020 and 021 written but not applied; until 021 lands, report rate
  limiting is per-instance.
- No error tracking — production failures are visible only in Vercel logs.
- Vercel Root Directory still a manual dashboard step.

**Medium**
- Single shared admin password; no rotation, 2FA or per-actor audit.
- Admin login throttle is memory-only.
- Login errors permit allowlist enumeration.
- Water-EC blocker discards valid water levels.
- No CSP.

**Low**
- `gateway/configs` leaks `error.message`.
- `crop_thresholds` empty, so real-mode salinity is always status-neutral.
- Final imagery is placeholder, pending owner-supplied assets.
