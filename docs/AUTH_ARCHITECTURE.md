# HORIZON Authentication & Authorization Architecture

## The finding that drives this document

The codebase contains **two complete, non-overlapping authentication
systems**, and only one of them is reachable from any live UI:

1. **Custom password + signed cookie session** (`apps/web/lib/auth/
   localAdminSession.ts`, `adminSessionCookie.ts`, `session.ts`,
   `middleware.ts`) — this is what `/admin/login` actually uses. Verified
   by reading every line of these files.
2. **Supabase Auth** (magic-link/OAuth via `@supabase/ssr`,
   `apps/web/lib/supabase/client.ts` + `server.ts`, `apps/web/app/auth/
   callback/route.ts`, `apps/web/lib/auth/bootstrap.ts`'s
   `ensureUserProfile()`, plus the entire `is_admin()`/
   `has_station_access()`/`station_assignments` RLS apparatus in
   migrations 008–009) — fully implemented, real code, correctly using
   the Supabase SSR cookie pattern. **Grep-confirmed**: nothing under
   `apps/web/app/` imports `supabase/server`, `supabase/client`, or
   `ensureUserProfile` except the callback route itself. No login page,
   button, or link anywhere triggers it. It is complete, dormant
   scaffolding for a "farmer" login that was designed but never given a
   UI entry point.

Every architecture decision below is about reconciling these two systems
deliberately, not pretending only one exists.

## Decision: the final security model

**A. Supabase Auth for human users — deferred, not adopted now.**
The scaffolding is sound and should be the eventual mechanism *if and
when* a per-person farmer/researcher login is actually built, because it
gets RLS-scoped-by-user for free via `has_station_access()`. It is not
in use today and nothing should be built assuming it is. Recommendation:
leave it in place (deleting working, correctly-written code to "clean
up" would be pure loss), but treat it as inert until a concrete farmer-
login feature is scoped — do not let new work quietly start depending on
`auth.uid()` being populated, because for the admin flow it never will
be.

**B. Device/gateway HMAC authentication for machines — adopted, already
correct.** The gateway-relay model (gateway authenticates with its own
secret; the payload can be attributed to a different, independently-
registered device) is a deliberate, sound design for LoRa-only stations
that can't carry their own crypto/clock. Keep it. One real gap: no
gateway↔station ownership check — any active gateway can relay for any
active station (`ingest.ts`'s `isDeviceRegistered` check doesn't scope
by *which* gateway is asking). Acceptable for a single-gateway pilot;
flagged as a P2 item once a second gateway is ever deployed.

**C. Service-role only inside trusted server/edge boundaries — adopted,
already correct.** `services/edge-ingestion` (the edge function) and
`apps/web/app/admin/*` server actions use `createServiceClient()`. Both
are server-only code (the edge function has no client exposure by
construction; the admin page/actions are Next.js server components/
server actions, never shipped to the browser). This is the right
pattern: service-role never crosses into anything a browser can reach.

**D. RLS for user-scoped access — real, but currently unreachable.**
The RLS policies from migrations 008/009 (`has_station_access`,
`is_admin`) are correctly written **for a Supabase-Auth-based caller**,
but the live admin path never authenticates as one — it uses service-
role, which bypasses RLS entirely. So today, RLS's only *live* function
is the migration-018 anon policies that gate public reads. The
authenticated-role policies are real infrastructure sitting unused until
farmer login exists. Not a bug — just worth being honest that "RLS
protects admin data" is not currently true in practice; service-role
scope discipline (point C) is what actually protects it.

**E. Combination — this is what's actually in place**, and it's the
right shape: anon+RLS for public reads, service-role for the two trusted
server boundaries (ingestion, admin), HMAC for machines, Supabase-Auth
reserved for a not-yet-built farmer tier. No system should be collapsed
into another — they serve genuinely different trust boundaries.

## Public access

Anonymous, no login, via `getPublicRepositories()` →
`createAnonClient()` (anon key) → migration 018/019's `to anon using
(true)` policies on exactly 5 tables (`stations`,
`environmental_readings`, `environmental_events`, `station_health_logs`,
`crop_thresholds`, `soil_readings`). If the anon/URL env vars are
missing, `createAnonClient()` returns `null` and every public page
degrades to an honest "not connected" state (verified this session —
see the Phase B work log; two real crash bugs from *missing error
handling around a configured-but-unreachable* Supabase call were found
and fixed).

## Authenticated user access

Exists in code (Supabase Auth session → `ensureUserProfile()` →
`public.users` row with `role` and `station_assignments`), unreachable
in the live product. `role` is either `'farmer'` or `'admin'` at the
schema level (`002_schema.sql`'s check constraint), but the *live* admin
role is established entirely differently (see below) — the schema-level
`role='admin'` value is not what gates the actual admin UI today.

## Admin access

Single shared password (`ADMIN_PASSWORD` env, `timingSafeEqual`-compared)
+ HMAC-SHA256-signed cookie (`ADMIN_SESSION_SECRET` env, 12h max-age,
`httpOnly`, `sameSite=lax`, `secure` in production). Identity allowlist:
`ADMIN_ALLOWED_EMAILS` env (source of truth, always wins) unioned with
`admin_allowed_emails` DB table (operator-addable via the admin UI,
read/written through service-role). There is exactly one shared
password for every admin — not per-person credentials. `middleware.ts`
does a cheap edge-layer "does a plausible-looking cookie exist" check
(can't verify the HMAC there — no `node:crypto` in the Edge runtime);
`requireAdmin()` inside `admin/page.tsx` does the real, full
verification (signature + expiry) in the Node runtime. This two-layer
split is intentional and documented in the code itself, not an
oversight.

## Gateway access (machine)

`x-device-id` + `x-timestamp` + `x-signature` + `x-contract-version`
headers; secret looked up server-side by `x-device-id` from
`devices.device_secret` (plaintext column — see below); HMAC-SHA256 over
a canonical string that embeds the *attributed* device_id (which may
differ from the authenticating one). Constant-time comparison
(`timingSafeEqualHex`, works in both Node and Deno since it avoids
`node:crypto`).

## Device access (direct-connect, non-relayed)

Same contract, same header set — a station connecting directly (not
through a gateway) would authenticate as itself, `x-device-id ===
payload.device_id`. No such device is deployed today (both stations are
LoRa-only, relay-only), but the contract supports it without change —
confirmed by re-reading `ingest.ts`'s branch logic, which treats "same
device" and "relayed" as the same validated path, just skipping the
extra `isDeviceRegistered` check when they're equal.

## Service-role usage — the trust boundary, explicitly

Service-role is used in exactly two places, both server-only:

1. `services/edge-ingestion` (via `SupabaseDb`) — needs to bypass RLS to
   write telemetry from unauthenticated devices.
2. `apps/web/app/admin/*` and `apps/web/lib/auth/adminAllowlist.ts` —
   needs to read/write admin-only tables without depending on the unused
   Supabase-Auth session.

Nowhere else. `apps/web/lib/publicRead.ts` and every public page use the
anon client. This was verified, not assumed — every `createServiceClient`
call site was traced this session.

**Recommendation: keep this exactly as it is.** Do not try to replace
service-role with RLS-scoped authenticated access for admin until a real
per-person admin login is built — doing so today would just add
Supabase-Auth session plumbing around a single-shared-password system
that gains nothing from it.

## RLS — where it's used, where it isn't

| Table | RLS enabled | Anon policy | Authenticated policy | Live enforcement today |
|---|---|---|---|---|
| `stations`, `environmental_readings`, `environmental_events`, `station_health_logs`, `crop_thresholds`, `soil_readings` | yes | `to anon using (true)` (018/019) | `has_station_access()`-scoped (009) | **Anon policy is the real boundary** — public pages read through it |
| `devices`, `ingestion_audit_logs`, `firmware_updates`, `admin_allowed_emails`, `device_runtime_configs`, `gateway_observations` | yes | none (012 revoked, never restored) | `is_admin()`-scoped | **Not the real boundary** — admin reaches these via service-role, which ignores RLS entirely |
| `users`, `station_assignments` | yes | none | self-or-admin scoped | Unreachable — nothing authenticates as a Supabase-Auth user |
| `damage_logs` | yes | none | own-or-admin scoped (009), admin-update (016) | **Not the real boundary** — both the public insert (via `/api/public/reports`) and admin read/update go through service-role |

## Secret storage

`.env`/`.env.local` (not committed — never printed a value this
session or any prior one). `devices.device_secret` is stored **plaintext**
in the database; a `device_secret_hash` column exists (`006`, backfilled
via `md5(device_secret)`) but `getDeviceSecret()` in `supabaseDb.ts`
reads the plaintext column, never the hash — the hash column is dead
code, and even if it were used, MD5 is not an appropriate secret-hashing
function. This is fine for HMAC signing (the *server* needs the raw
secret to recompute the signature — a hash wouldn't work for that
purpose at all), so the plaintext column isn't itself wrong; the
`device_secret_hash` column is simply vestigial and should either be
removed or given an actual purpose, not left implying a security
property it doesn't provide.

## Session lifecycle

Admin: 12-hour cookie, no refresh mechanism found (`SESSION_MAX_AGE_
SECONDS = 60*60*12` in `localAdminSession.ts`) — a session simply expires
and the user must re-enter the password. No server-side session
revocation list — a leaked cookie is valid until its embedded `exp`
regardless of password rotation, for up to 12 hours. Acceptable for the
current single-operator pilot scale; worth a revocation mechanism (a
`session_version` counter checked against a stored value) if the admin
pool grows.

## Fail-open / fail-closed audit

| Path | Behavior on missing config | Verdict |
|---|---|---|
| `ADMIN_SESSION_SECRET` unset | `sessionSecret()` throws | **fail-closed** (correct) |
| `ADMIN_PASSWORD` unset | `configuredPassword()` throws | **fail-closed** (correct) |
| Anon Supabase env vars missing | `createAnonClient()` returns `null`, public pages show honest empty state | **fail-closed** in effect (correct — no fabricated data, confirmed this session after fixing two crash bugs) |
| Service-role env vars missing | `createServiceClient()` returns `null`; admin pages fall back to disclosed demo data (Phase B labeling) | **fail-closed with disclosure** (correct, deliberately) |
| Device secret unknown | `getDeviceSecret()` returns `null` → `DEVICE_NOT_REGISTERED`, request rejected | **fail-closed** (correct) |
| `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing in edge function | `index.ts` returns HTTP 500 explicitly | **fail-closed** (correct) |
| Middleware cookie check fails | Redirect to `/admin/login` | **fail-closed** (correct) |

No fail-open path was found in this pass. This matches the fail-closed
work already done in earlier sessions (Phase A) and confirms it has held
through subsequent changes.
