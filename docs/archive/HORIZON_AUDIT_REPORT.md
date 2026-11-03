# HORIZON — Repository Audit

**HISTORICAL SNAPSHOT — superseded by [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) for current architecture/auth/data-model reality.** Written before three later passes (Phase A correctness fixes, the auth/ingestion architecture realignment, and the production-readiness hardening pass that added `soil_readings`). Several findings below are now resolved — most notably §7's unauthenticated gateway route (removed), §18's report-form accessibility gap (fixed), and the RLS-bypass-via-service-role finding for public reads (fixed — public reads now use anon-key + RLS). Other findings — the stub salinity sensor, the firmware/backend payload mismatch that existed at the time, dead components, branding cleanup — were accurate as of this writing and many still are; treat this as a dated data point, not current truth, and cross-check against `ARCHITECTURE_DECISIONS.md` or the source before relying on any specific claim.

*Prepared as a lead-engineer / architect / product / UI-UX review. No implementation, redesign, rename, commit, or push was performed beyond the git conflict reconciliation described in §3, which was explicitly authorized. Everything else below is findings and a proposed plan awaiting approval.*

---

## 1. Executive Summary

HORIZON is a real, well-scoped environmental IoT platform for Cồn Hô, a small island in Trà Vinh, Vietnam: ESP32 sensor nodes measure water level, salinity, and soil EC; a gateway relays readings; a Supabase backend stores and rolls up the data; a Next.js app serves a public dashboard, per-station pages, a community field-report flow, and an admin console.

The engineering foundation is genuinely solid in places — the documented HMAC-signed ingestion contract is implemented faithfully and tested (6/6 contract tests pass), the Postgres schema and its RLS policies are well-designed once migrations run to completion, and the frontend has a real PWA (service worker, offline fallback, install prompt) and a coherent Vietnamese-first visual language.

But there is a wide gap between what the documentation describes and what actually runs today:

- The **real field firmware doesn't use the secure ingestion path at all** — it posts unsigned, unauthenticated JSON to a different Next.js route. The HMAC contract that's implemented and tested is effectively unused by real hardware.
- The **headline sensor — water salinity — is an unimplemented stub** in firmware (`readWaterEc()` always returns "not measured").
- The **documented multi-role, RLS-backed authorization model doesn't exist in the application** — everything runs through a service-role client that bypasses RLS, admin auth is one shared password, and the "farmer" role/RLS machinery built at the database layer is never called by any reachable page.
- Three dashboard components are fully built, accessible, and **never imported anywhere** — pages reimplement the same UI inline instead, three times, with drift between them.
- The repository had **6 unresolved merge conflicts representing two divergent product directions** (a Vietnamese-first "HORIZON," 3-station-type version already on GitHub vs. an English-first "Eco-Sense," single-station-type uncommitted local WIP) sitting in the working tree from an interrupted `git stash pop`. These are now hand-resolved (§3) but were blocking any further work.
- Branding migration to "HORIZON" is roughly 80% complete already, with one live user-facing leftover string and ~70 documentation-only references to the old name.

No P0 "site is down" defect was found. But several P1-severity gaps (security-relevant auth/RLS bypass, unauthenticated firmware ingestion, a stub core sensor) should be closed before treating this as ready for real farmers or a public rollout, and the repository needs a stabilization pass (Phase 0–1 below) before any further feature or design work.

---

## 2. Current Repository State

Monorepo (npm workspaces) with five top-level areas:

| Area | Path | Stack |
|---|---|---|
| Web app | `apps/web` | Next.js (App Router), Tailwind v4 tokens, Supabase JS, `@ducanh2912/next-pwa`, Recharts, `@tanstack/react-query` (unused) |
| Ingestion service | `services/edge-ingestion` | Node/TypeScript, bundled with esbuild into a Supabase Edge Function |
| Edge function | `functions/edge-ingest` | Generated bundle output of the above |
| Database/infra | `infra/supabase` | 17 SQL migrations, RLS, seed data, deploy scripts (PowerShell + POSIX), verification script |
| Firmware | `firmware/esp32-node` | Arduino/PlatformIO, ESP32, 2 station nodes + 1 gateway node (Vietnamese filenames), plus a superseded scaffold |

At session start the working tree was dirty: 6 real merge conflicts, ~35 files cleanly auto-merged but unstaged, 20 new untracked design/product docs, 3 new untracked UI components, and a stash entry from an interrupted sync. See §3 for the full resolution.

---

## 3. Git Synchronization Result

**What actually happened, reconstructed from reflog/stash/branch state:**

1. Local `main` had 3 commits: `dc82d91` (initial) → `f958a5c` (refactor) → `d4ee803` ("fix: stabilize build and harden ingestion").
2. Before syncing, a prior session ran `git stash` on uncommitted WIP ("On main: WIP before syncing with origin"), then `git pull --rebase origin main`. Origin had 2 additional commits on top of `d4ee803` (`e63c19d`, `87b7110`, both "Add files via upload" — pushed via the GitHub web UI), so the pull was a clean **fast-forward** to `87b7110`. **There was no true history divergence** — local and origin never needed a merge or rebase at the commit level; `HEAD` already equals `origin/main`.
3. The subsequent `git stash pop` hit conflicts and left them unresolved — that was the dirty state found at the start of this session (staged/unstaged/unmerged files, `refs/stash` still populated).

**Real conflicts found:** exactly 6 files with content conflicts, plus `apps/web/tsconfig.tsbuildinfo` (a generated TypeScript build-info cache, not source — resolved by truncating it to `{}` so it regenerates cleanly on next `tsc` run; this is a justified exception to "never blindly pick a side," since the file carries no source-of-truth information).

The 6 real conflicts were not a stale-vs-fresh situation — they were **two fully-built, divergent product directions** that split after `d4ee803`:

| | `origin/main` ("Updated upstream") | Local stash ("Stashed changes") |
|---|---|---|
| Branding | Already says "Horizon" in hero copy | Still says "Eco-Sense" |
| Language | Vietnamese-first | English-first |
| Station model | 3 distinct kinds: water / soil / gateway, each with kind-specific metrics | 1 generic station type, salinity-threshold risk labels (Safe/Increasing/High Risk) |
| Admin login | Working password + allowlist server action | Magic-link-style client component referencing undefined React state (`email`, `setEmail`, `loading`, `error` with no `useState`/`"use client"` — does not compile as written) |
| About page | 2-line stub (`redirect("/")`) | Fully written page |

Per your decision: **login-form.tsx** took origin's version wholesale (the stashed side was non-compiling). **about/page.tsx** took the stashed content wholesale (origin was a stub). The 4 remaining files (**home page, dashboard page, station-detail, public-shell nav**) were hand-merged rather than picked wholesale:

- Kept origin's 3-station data model as the functional backbone (it's what `dashboard`/`station-detail` both already depend on, and it's more complete — soil EC, gateway delivery-rate, a real map image).
- Folded in the stash's UX improvements where they didn't conflict with that model: the `EmptyState` component (replacing ad hoc paragraphs), the threshold-based Safe/Increasing/High-Risk language (now computed from the live `getDefaultSalinityThreshold()` value instead of a hardcoded 1.2/1.8 cutoff), `ArrowRight`-accented buttons, the animated `NetworkPreview` panel on the homepage, the `storyBlocks` narrative section, ring/shadow card treatments, and `max-w-7xl` container consistency.
- Dropped one redundant duplicate (stash's abstract animated-pin map preview on the dashboard, since origin's real photo-based `StationMap` already serves that purpose and having both was visual noise).
- Caught and fixed a real latent bug in the process: origin's dashboard code called `<MetricCard>` with a `note` prop that doesn't exist on `MetricCardProps` (which requires `unit`/`status`/`statusLabel`/`freshness`) — this would not have compiled. The merged dashboard avoids `MetricCard` entirely in favor of the simpler `TelemetryStat` pattern, sidestepping the bug (also flagged in §6 as a broader dead-component issue).

**Current state:** all 6 conflicts resolved and staged (`git status` shows `M ` for each, no `UU` remaining). ~35 other files that merged cleanly with no conflicts are present as normal unstaged modifications. All 20 new untracked docs, the 3 new untracked UI components (`empty-state.tsx`, `select.tsx`, `textarea.tsx`), and the `mock/` directory carried through intact — nothing was lost. `refs/stash` still contains the original pre-merge snapshot (`stash@{0}`) — **deliberately not dropped**, kept as a safety net until you've reviewed the hand-merged files. Nothing has been committed or pushed.

One sandbox limitation: outbound network access to `github.com` is blocked in this environment (`git fetch origin` returns `403` from the proxy), so a live re-fetch couldn't be performed this session — but local refs already confirm `HEAD == origin/main` with no pending remote commits, so this doesn't block the reconciliation above.

**Recommended next step (not yet performed):** review the 4 hand-merged files, then `git add -A && git commit -m "..."` followed by `git stash drop` once you're satisfied nothing further is needed from the stash.

---

## 4. Architecture Map

```
Firmware (ESP32, 2 stations + gateway)
   │  raw JSON over LoRa/UART
   ▼
apps/web/app/api/public/gateway/route.ts   ← ACTUAL path, unauthenticated
   │
   ▼
Supabase Postgres (gateway_observations table)


services/edge-ingestion (HMAC-signed contract, tested, documented)
   │  bundled via esbuild
   ▼
functions/edge-ingest → Supabase Edge Function (deployed with --no-verify-jwt)
   │
   ▼
Supabase Postgres (environmental_readings, environmental_events, ingestion_audit_logs)
   ← DOCUMENTED path, not what firmware actually calls


apps/web (Next.js, server components)
   │  service-role client (bypasses RLS)
   ▼
lib/repositories/*.ts  →  Supabase Postgres (all tables)
```

Two parallel ingestion paths exist and only one is documented/secured; firmware uses the other. The web app reads everything — public and admin — through a service-role client, so the RLS policies built into the schema (§12) are not the active access-control boundary for the shipped app; a hand-written scope-filtering layer in `lib/repositories/base.ts` is.

CI: `ci-validate.yml` (every PR — typecheck + contract test + build, **no lint step**), `ci-live-smoke.yml` (weekly/manual — live RLS + integration tests against real infra), `release-deploy.yml` (tag push — migrate, build, deploy edge function). No workflow deploys `apps/web` itself (presumably a separate Vercel integration) and none compiles the firmware.

---

## 5. Feature Matrix

| Feature | Current State | Evidence | Risk | Priority |
|---|---|---|---|---|
| HMAC-signed telemetry ingestion contract | IMPLEMENTED (code + tests) but **unused by real firmware** | `services/edge-ingestion/src/ingest.ts`, `canonical.ts`; 6/6 contract tests pass | High — secure path built, not the one that's live | P1 |
| Gateway ingestion (actual firmware path) | IMPLEMENTED, **no auth at all** | `apps/web/app/api/public/gateway/route.ts` | High — unauthenticated public write endpoint | P1 |
| Water salinity sensor (Trạm 1) | BROKEN / stub | `trạm 1.ino::readWaterEc()` returns `{false, NAN, "pending_ec_protocol"}` | High — core product metric doesn't exist | P0 |
| Soil EC / moisture sensor (Trạm 2) | IMPLEMENTED (CRC-checked Modbus + I2C) | `trạm 2.ino` | — | — |
| Water level / ultrasonic sensor | IMPLEMENTED (checksum-validated) | `trạm 1.ino::readA02yyuwDistanceCm` | — | — |
| Store-and-forward on gateway | PARTIALLY_IMPLEMENTED | logs to SD, `retryPendingNotice()` explicitly does not replay ("manual replay required") | Medium — data loss on connectivity gaps | P2 |
| OTA firmware update | MISSING in firmware (server side scaffolding exists) | no OTA code in any `.ino`; `firmware_updates` table + server logic unused by firmware | Low today, blocks future fleet management | P3 |
| Multi-role auth (public/operator/admin/researcher/service) | OUTDATED_SPECIFICATION — only admin & public exist | `docs/AUTHORIZATION_MODEL.md` vs `lib/auth/session.ts` | High — documented security model doesn't match reality | P1 |
| RLS as real enforcement boundary | PARTIALLY_IMPLEMENTED — correct policies exist, but app bypasses them via service-role client | migrations 008/009 vs `lib/supabase/service.ts` | Medium — latent architectural risk, not currently exploitable | P1 |
| `/admin` route protection | PARTIALLY_IMPLEMENTED — page-level only, middleware is a no-op | `middleware.ts` vs `lib/supabase/middleware.ts` (built, never wired) | Medium — no network-edge backstop | P1 |
| Admin login | IMPLEMENTED (shared password + allowlist), but **contradicts its own UI copy** ("magic-link") | `login-form.tsx`, `admin/page.tsx:373` | Medium — user-facing claim is false | P2 |
| Public dashboard | IMPLEMENTED | `app/dashboard/page.tsx` | — | — |
| Station detail pages (3 kinds) | IMPLEMENTED | `components/stations/station-detail.tsx` | — | — |
| Field report submission | IMPLEMENTED with non-durable fallback | Supabase insert with file-based demo fallback (`demoReportStore.ts`) | Medium — fallback data can silently vanish on serverless hosting | P2 |
| Report rate limiting | PARTIALLY_IMPLEMENTED — in-memory, not durable across instances | `api/public/reports/route.ts` | Low-Medium | P2 |
| PWA (installable, offline) | IMPLEMENTED | real service worker, `offline` fallback page, install prompt | — | — |
| PWA icon completeness | PARTIALLY_IMPLEMENTED — single SVG, no maskable/PNG set | `manifest.webmanifest` | Low | P4 |
| MetricCard / AlertCard / StationCard components | BUILT, **dead code — never imported** | 0 references outside own files | Medium — 3x drifting reimplementations instead | P3 |
| react-query provider | BUILT, **dead code — no `useQuery` anywhere** | `providers/query-provider.tsx` wired into root layout, unused | Low | P4 |
| CI typecheck/build/contract-test gate | IMPLEMENTED | `.github/workflows/ci-validate.yml` | — | — |
| CI lint gate | MISSING | not a step in any workflow | Low-Medium | P3 |
| RLS/integration tests in PR gate | MISSING (only weekly/release) | `ci-live-smoke.yml` scope | Medium — a broken RLS policy wouldn't block a merge | P2 |
| Frontend/component/e2e tests | MISSING entirely | no RTL, no Playwright/Cypress found | Medium | P2 |
| Branding → HORIZON | ~80% complete | see §16 | Low | P3 |

---

## 6. Critical Bugs

1. **Water salinity sensor is unimplemented** (`trạm 1.ino::readWaterEc()`) — the platform's headline measurement is a stub that always reports "pending_ec_protocol." Every live reading ships `salinity_ppt: null` from the one path that would matter.
2. **`infra/supabase/seed/mock_seed.sql` is broken against the current schema** — it inserts into `public.environmental_data`, which migrations 010/011 renamed then dropped. Running it today errors. (`pilot_seed.sql` is the current, working seed file — `mock_seed.sql` should be deleted or updated.)
3. **Dashboard Suspense fallback double-renders `<PublicShell>`.** `app/dashboard/page.tsx` wraps `<DashboardContent>` in `<PublicShell>` and also passes `DashboardLoading` (from `app/dashboard/loading.tsx`) as the Suspense fallback — but `loading.tsx` *itself* renders `<PublicShell>`. During the loading state this nests two headers/nav bars.
4. **PlatformIO build ambiguity**: `firmware/esp32-node/src/` contains 4 files with independent `setup()`/`loop()` (`main.cpp`, `gateway.ino`, and the two `trạm *.ino` files) with no `src_filter`/multi-env config in `platformio.ini` to select one — a default build would likely produce duplicate-symbol errors. Needs a documented per-target build convention.
5. **`MetricCard` prop mismatch** (now moot in the merged code, but present as dead code): `MetricCardProps` requires `unit`/`status`/`statusLabel`/`freshness`; the pre-merge origin dashboard called it with a `label`/`value`/`note` shape that doesn't exist on the interface. Anyone reviving this component needs to fix the call site, not just re-import it.

## 7. Security Findings

Ordered by severity:

- **P1 — Field firmware bypasses the only authenticated ingestion path.** `gateway.ino` posts to `/api/public/gateway`, which has zero signature, timestamp, device-registration, or rate-limit checks — any POST with a plausible-looking `gateway_id`/`station_id` is accepted and stored. The HMAC-secured, replay-protected, tested `edge-ingest` path exists but nothing calls it from real hardware.
- **P1 — Documented authorization model is not the implemented one.** The only real states are "admin" (shared password) and "public" (unauthenticated, but served through an **admin-scoped** service-role client via `PUBLIC_READ_SCOPE = { role: "admin", stationIds: [] }` in `lib/publicRead.ts`). The `operator`/`researcher` roles, per-farmer RLS scoping, and the `station_assignments`/`has_station_access()` machinery built at the DB layer are all unreachable dead code from the application's perspective.
- **P1 — RLS is real and well-designed at the schema layer but is not the enforcement boundary in practice**, because every application code path uses the service-role key (`lib/supabase/service.ts`), which bypasses RLS outright. A future repository method that forgets to call `applyStationScope`/`canAccessStation` has no database-level backstop. Today this is latent (no farmer-scoped route is reachable yet), not exploitable — but it's an architectural landmine.
- **P1 — `/admin` middleware protection is dead code.** `lib/supabase/middleware.ts` implements a correct session-based redirect for `/admin/*`, but `middleware.ts` (the file Next.js actually invokes) is a no-op passthrough. `/admin` is currently protected only by a page-level `requireAdmin()` check repeated at the top of every server action — functional today, but one missed call away from an exposed route.
- **P2 — Hardcoded credential fallbacks.** `ADMIN_PASSWORD` falls back to the literal `"horizon2026"` and `ADMIN_SESSION_SECRET` falls back to `SUPABASE_SERVICE_ROLE_KEY` or a literal dev string if unset (`lib/auth/localAdminSession.ts`). Safe only if the env vars are guaranteed to be set in every deployment — should fail closed instead of falling back silently.
- **P2 — Device secrets stored in plaintext** (`devices.device_secret`) alongside a hash column that's added but not used to replace it — required by the current HMAC-over-shared-secret design, but means anyone with service-role/DB access reads every device's raw secret; no separate secrets manager.
- **P2 — HMAC comparison is not constant-time** (`ingest.ts`, plain `!==` string comparison) — minor timing-attack surface; `localAdminSession.ts` does this correctly elsewhere with `crypto.timingSafeEqual`, worth applying consistently.
- **P3 — No rate limiting on the ingestion paths** (neither `edge-ingest` nor the unauthenticated gateway route); the one rate limiter that exists (`api/public/reports`) is in-memory and won't hold across serverless instances/cold starts.
- **Informational — live secrets found in plaintext on this workspace's disk** (`.env`, `apps/web/.env.local`, `infra/supabase/.env.supabase`), correctly gitignored and never committed, but worth rotating as a precaution given this session's environment. Not a repository defect.

## 8. Data Integrity Findings

- Idempotency is enforced correctly at the DB layer (`environmental_readings.message_id` unique constraint) with clean duplicate-detection in the ingestion path.
- Silent-failure points exist by design in non-critical paths (audit-log writes, `touchDeviceSeen`, both wrapped in `.catch(() => undefined)`) — reasonable so a telemetry-logging hiccup doesn't block ingestion, but currently un-alerted, so failures there are invisible.
- **Field report submission can silently discard data**: any non-`PGRST205` Supabase error on insert falls back to a file-based demo store rather than surfacing the failure — masking a real outage as a successful "demo" submission.
- The retention/rollup functions (`rollup_environmental_readings_hourly()`, `cleanup_horizon_data()`, migration 015) are written for `pg_cron` scheduling but **no cron schedule exists anywhere in the repo** — they will never run unless manually invoked or scheduled out-of-band.

## 9. API Contract Findings

- The documented `POST /functions/v1/edge-ingest` contract (`docs/API_CONTRACTS.md`) matches its implementation closely: canonical string format, error codes, HTTP status mapping, and response shapes all line up field-for-field with `services/edge-ingestion/src`.
- Three live production routes are **completely undocumented**: `api/public/gateway` (POST, unauthenticated), `api/public/gateway/configs` (GET, public), `api/public/reports` (POST, own ad hoc rate limiter). None appear in `API_CONTRACTS.md`.
- The doc's footnote about requiring `Authorization`/`apikey` headers on the gateway function is inconsistent with the actual deploy scripts, which explicitly pass `--no-verify-jwt`.

## 10. Firmware Findings

See §6/§7 for the critical items. Additional notes: power management (deep sleep + watchdog) is implemented properly across all three node files; sensor fault handling is real and protocol-correct for the sensors that are wired up (checksum/CRC validation on ultrasonic, I2C, and Modbus reads); the payload format sent by firmware does not include `contract_version`, `timestamp`, `fault_flags`, or any signature field that the documented contract requires — it's a materially different, older-looking payload shape than what `API_CONTRACTS.md` describes.

## 11. Frontend Findings

Full detail in §5/§6; summary of the most consequential items: clean repository-pattern data access with almost no scattered Supabase calls in leaf components; PWA is real; mobile-responsive coverage is broad and thoughtful (72 responsive-prefix usages, correct touch-target sizing, sticky mobile CTA pattern on the report form) — missing only `env(safe-area-inset-bottom)` on the fixed bottom nav; three components are fully built and accessible but never used, in favor of inline reimplementations that have already drifted from each other; `react-query` is wired into the root layout and entirely unused; English/Vietnamese copy is mixed within single pages (not just across pages), most severely on the homepage and About page, including one literal leftover "Eco-Sense" string in About page body copy.

## 12. Database/RLS Findings

Schema is well-organized across 17 migrations (see the infra agent's table reproduced in §5/full detail available on request). RLS policies in `003_rls.sql`/`007_rls_observability.sql` are intentionally permissive bootstrap policies, explicitly commented as such, and correctly replaced by `009_production_rls.sql` with proper `has_station_access()`/`is_admin()`-scoped policies — **as long as migrations run in full numeric order**, which is the normal case. `012_revoke_anon_sensitive_grants.sql` adds a reasonable defense-in-depth layer independent of policy state. One small inconsistency: the admin-only policies in migrations 013/014 omit `to authenticated` (present everywhere else), not currently exploitable since `is_admin()` resolves false for anonymous callers, but worth normalizing. As noted in §7, this entire RLS layer is currently bypassed in practice by the application's use of the service-role client.

## 13. Testing Gaps

- No frontend/component tests (no React Testing Library, no `__tests__` anywhere in `apps/web`).
- No API route tests for any `app/api/**/route.ts`.
- No e2e tests (no Playwright/Cypress config found).
- RLS tests and live ingestion integration tests exist and are meaningful, but only run weekly/on release — **not on every PR**, so a broken RLS policy or a broken live-ingestion path would not block a merge.
- No test for the auth session/cookie code (`localAdminSession.ts`, `session.ts`) despite it containing the hardcoded-fallback issue in §7.
- No firmware compile check in CI (would have caught the multi-`.ino`/`platformio.ini` ambiguity in §6).

**Baseline actually run this session** (sandbox-limited — see below):

| Check | Result |
|---|---|
| `apps/web` typecheck (`tsc --noEmit`) | **PASS**, clean |
| `services/edge-ingestion` typecheck | **PASS**, clean |
| `services/edge-ingestion` contract tests | **PASS**, 6/6 |
| `apps/web` lint / build / unit tests | Blocked by sandbox network policy (native binary downloads for `@next/swc-*`/`esbuild` are proxy-blocked) — not a code defect; GitHub Actions' hosted runners install these without issue, so CI is expected to succeed where this sandbox couldn't verify |
| RLS tests / live integration tests | Self-skip by design (no live DB credentials in this environment) |

## 14. CI/CD Findings

`ci-validate.yml` is a real, substantive PR gate (typecheck both workspaces, contract tests, both builds) but **has no lint step at all**, and doesn't run RLS or integration tests on every PR — those are relegated to a weekly cron / manual dispatch (`ci-live-smoke.yml`) or release time (`release-deploy.yml`). No workflow builds or type-checks the firmware. No workflow deploys `apps/web` (presumably handled outside this repo, e.g., a Vercel Git integration — not visible here, worth confirming).

## 15. Documentation Drift

- `docs/AUTHORIZATION_MODEL.md` describes a 5-role, RLS-enforced model that does not match the single-admin-password reality (§7) — the widest spec-vs-implementation gap in the audit.
- `docs/API_CONTRACTS.md` documents one endpoint faithfully but omits three live routes entirely (§9).
- `firmware/esp32-node/docs/QUEUE_AND_FALLBACK.md` describes a bounded FIFO queue with retry-count/overflow tracking that isn't implemented — the real firmware logs to SD but doesn't replay it.
- 19 documentation files (mostly the newly-added, currently-untracked design docs) still say "Eco-Sense" throughout — see §16.

---

## 16. Branding / Naming Migration

Full inventory (git-tracked content via `git grep`, cross-checked against the full working tree including untracked files):

| Classification | Examples | Recommendation |
|---|---|---|
| (a) User-facing branding | One live string: `about/page.tsx` — "Eco-Sense makes the island legible..." | **Now** — trivial, zero-risk, and it's the single most visible inconsistency left |
| (b) Package/workspace identifiers | `package.json` name `eco-sense-con-ho`; `@eco-sense/{web,edge-ingestion,supabase-infra}` scope used in 4 `package.json` files, `package-lock.json`, both GitHub workflows | **Now, as one coordinated PR** — mechanical fan-out (every import specifier + workspace-filter script + lockfile regen), not urgent same-day but shouldn't be deferred long |
| (c) Technical identifiers | `firmware/esp32-node/src/main.cpp` + `platformio.ini` — `ECO_*` macros, `[eco-sense]` log tags | **Evaluate for deletion first** — this file looks like a dead scaffold superseded by the real, already-Horizon-branded `.ino` files; confirm it's unused before spending effort renaming vs. deleting |
| (d) Database identifiers | None found — all table/column/function names are domain-named; the one brand-named function (`cleanup_horizon_data()`) is already correctly named | **N/A**, nothing to do |
| (e) API contract | None found | **N/A** |
| (f) Environment variables | None found | **N/A** |
| (g) Deployment identifiers | Supabase project display name is still "Eco-Sense" (project `ref` itself is untouched); live Vercel demo domain is `eco-sense-con-ho.vercel.app` | **Supabase display name: now (safe, cosmetic).** **Vercel domain: planned cutover, not urgent** — changing it breaks any QR codes already printed/deployed at physical stations; add a Horizon-branded domain alongside the old one first |
| (h) Historical references | `ECO-XXX` ticket IDs in migration/firmware comments | **Leave alone** — issue-tracker numbering, not brand strings; renaming would break traceability for no benefit |
| (i) Documentation-only | 19 files, ~70+ occurrences (heaviest: `docs/VISUAL_REFERENCES.md`, ~40 occurrences) | **Now, batch find-and-replace** — zero technical risk, and most of these files are currently untracked/pre-first-commit, so this is the cheapest moment to fix it |

Suggested order: (1) fix the one live UI string + a stray console-log string in `verify-deploy.mjs`, (2) bulk find-and-replace across `docs/*.md` and `README.md`, (3) decide the fate of the dead firmware scaffold, (4) one coordinated PR for the npm workspace scope rename, (5) plan (don't rush) the Vercel domain cutover, (6) leave DB/API/env naming untouched — none of it references the old brand.

---

## 17. Product Review

**Primary users, in order of who the product should serve first:** (1) local residents and farmers of Cồn Hô, whose land and livelihood depend on reading water/salinity/soil signals early — the primary audience, Vietnamese-speaking, likely mobile-first; (2) visiting researchers/students who need clean, comparable historical data; (3) homestay tourists, for whom the platform is a trust signal about the place they're visiting, not a working tool.

**Core value proposition:** make slow, easy-to-miss environmental change (salinity creep, tidal shifts, soil stress) visible early enough to act on, in language and units the primary audience actually uses day to day.

**Main journey as currently built:** homepage story → dashboard overview → individual station page → (optional) field report submission; separately, an admin operational path for triage and config. This is the right shape for the product.

**What each surface should communicate, and where the current build falls short:**

- **Homepage** should communicate what HORIZON is, why it matters *for this specific island*, and offer one clear path into live data. Today it does this, but splits attention between Vietnamese narrative copy (the part that matters most to the primary audience) and English section labels/CTAs that dilute it — see §11/§18.
- **Dashboard** should communicate network health at a glance and surface what needs attention first. The priority-sorted station list and the salinity trend panel do this well; the redundant secondary "map" concept (now removed in the merge, §3) was diluting it.
- **Station page** should read like a single station's story — status, what changed, what it means, what to do. The kind-aware model (water/soil/gateway each showing relevant metrics) is a real strength here and should be leaned into further, not abandoned.
- **Report flow** should be a low-friction "I noticed something" capture, not a form that feels like paperwork. The current implementation is close (sticky mobile CTA, simple category picker) but the category picker isn't accessible as a real radiogroup (§18), and there's no visible confirmation of what happens to a report after submission from the citizen's side.
- **Admin experience** should feel like an operational control room (triage reports, watch device health, manage the allowlist) rather than a generic CRUD panel. It's functional today but makes a promise it doesn't keep — the copy says admins are added so they can "log in via magic-link," but the actual login is a single shared password (§7/§11). That's a real trust problem for anyone reading the interface literally, not just cosmetic.

**Cross-cutting issues:** the English/Vietnamese mixing within single pages is the most consequential product issue found — it doesn't just look inconsistent, it actively works against the primary audience (rural Vietnamese-speaking residents) by putting core status language ("Critical," "Increasing," "High Risk," "Top priority") in a second language on a page otherwise written for them. No onboarding or first-time explanation of what a salinity/EC number *means* exists outside the per-station recommendation text — a first-time visitor to the homepage gets numbers and trend arrows with no plain-language framing until they click into a station. Trust signals are inconsistent: the "last updated" freshness string is present in some places (dashboard ribbon) and absent in others (homepage hero card in the merged version now includes it via `LiveSummary`, which is good, but this should be a deliberate pattern, not incidental).

---

## 18. UI/UX Review

**Visual hierarchy:** generally strong — large type at hero scale, generous whitespace, consistent use of ambient gradient "glass" cards for map/network visuals, and a real typographic rhythm (`text-xs uppercase tracking` eyebrows before every heading). This is a deliberate, considered visual system, not default Tailwind soup.

**Design system:** undermined by three inconsistencies found directly in the audited code: (1) two parallel badge vocabularies mapped onto the same colors (`healthy/watch/risk/offline/fault` vs `default/success/warning/critical/secondary`) used interchangeably across files; (2) no radius token — 8+ distinct arbitrary pixel radius values (`rounded-[18px]` through `rounded-[42px]`) alongside the standard Tailwind scale, with no evident system for which component gets which; (3) three separate, drifting implementations of "show a metric" (the unused `MetricCard`, the unused `StationCard`, and two different inline patterns — `TelemetryStat` and `MetricTile` — that ended up as the ones actually shipping). This is the clearest technical-debt signal in the whole frontend: the design system exists in intention (real tokens in `globals.css`, a real `components/ui/*` layer) but isn't being consistently reached for.

**UX states:** loading/error/empty coverage is inconsistent — only the dashboard route has `loading.tsx`/`error.tsx`; no route in the app has a custom `not-found.tsx` despite `notFound()` being called from the station-detail flow, so unknown station IDs fall through to Next's generic 404. `EmptyState` (a well-built, reusable component) is used in 3 places on the dashboard and nowhere else — admin's "no reports yet" and "no admin emails yet" states are still ad hoc markup.

**Accessibility:** better than average for a project this size — real `aria-label`s on navigation, `aria-current` on active links, correct touch-target sizing (`min-h-12 min-w-16`) on the mobile nav, a global `:focus-visible` outline plus per-component focus rings. The one real gap: the report form's category picker is a set of plain buttons simulating single-select with only a background-color change — no `aria-pressed`, no `role="radiogroup"`, invisible to screen-reader/switch users. Minor gap: no `env(safe-area-inset-bottom)` on the fixed bottom nav for notched/gesture-bar phones.

**Data visualization:** the strongest part of the product. `SalinityChart` draws real threshold reference lines (Watch/High-risk) directly on the trend area — this is exactly the right way to make a threshold legible without a separate legend. The kind-aware `StationLiveChart` (different series for water vs. soil vs. gateway) is thoughtful and correctly matches what each station actually measures. One overload risk: `DailyComparisonChart` packs a bar chart, a 7-day data table, *and* a full reference-standards table into one card — appropriate for a farmer doing a careful weekly review, but a lot for someone doing a 5-second daily check; consider whether the reference-standards table belongs on a separate "what do these numbers mean" page rather than inline on every dashboard load.

---

## 19. Proposed HORIZON Design Direction

*Proposal only — not implemented. Each item ties to a specific problem found above and the page/component it would change.*

1. **Brand direction:** HORIZON as a quietly serious environmental-monitoring instrument for one specific place, not a generic "climate tech" SaaS product. Every generic English marketing phrase found in §11/§17 ("Climate-tech platform," "A public signal," "Trustworthy context") should be replaced with copy that names the island, the sensors, and the people — the Vietnamese narrative copy on the homepage already does this well and should be the model for every other surface, not the exception.

2. **Visual language:** keep the current ambient-gradient "glass panel" motif for map/network visuals (it's distinctive and already well-executed) but formalize it as one named pattern in the design system rather than a bag of arbitrary radius/shadow values repeated with drift.

3. **Color system:** consolidate the two badge vocabularies (§18) into one semantic set (`healthy/watch/risk/offline/fault`) and deprecate the generic `default/success/warning/critical/secondary` aliases — a status badge should always mean the same five things regardless of which page renders it. Affects `components/ui/badge.tsx` and every call site.

4. **Typography:** already strong (eyebrow + large heading + muted body pattern); the only change needed is enforcing it as the *only* pattern — currently a few components (admin's raw `<select>`, ad hoc empty states) opt out of the shared type scale entirely.

5. **Layout principles:** standardize on `max-w-7xl` for all public-facing shells (already true for `PublicShell`) and give admin its own named `AdminShell` rather than an ad hoc `max-w-5xl` wrapper, so there are exactly two layout containers in the whole app, both named and both reused.

6. **Navigation model:** keep the current desktop-horizontal / mobile-bottom-tab split (it's correctly implemented and accessible) — no change needed beyond the safe-area-inset fix (§18).

7. **Homepage structure:** lead with the Vietnamese narrative (place → pressure → network → people) as the primary copy track; keep English only where it's genuinely bilingual signage for visitors (e.g., a toggle or a clearly-marked secondary line), not interleaved section-by-section. Directly addresses the §17/§11 language-mixing finding on `app/page.tsx`.

8. **Dashboard structure:** keep the priority-sorted station list and threshold-annotated trend chart as the core (they're the best UX in the app); move the detailed reference-standards table out of the default view (§18) into a "what these numbers mean" link/page, so the default dashboard stays a 5-second read.

9. **Station detail page:** keep and extend the kind-aware model — it's a genuine differentiator (a water station and a soil station showing fundamentally different, correctly-labeled metrics instead of a generic template). Worth exposing this same kind-awareness on the dashboard's station list (small kind icon next to each station name) so users don't have to click in to know what a station measures.

10. **Community report experience:** fix the category picker's accessibility (§18) as part of any touch to this component; add a visible post-submission state that tells the citizen what happens next (reviewed by whom, roughly when) — right now the flow ends at "submitted" with no indication a human will act on it, which undercuts trust in the exact feature meant to build it.

11. **Admin experience:** rewrite the allowlist-management copy to match reality (shared password, not per-person magic-link, §7/§17) — this is a correctness fix disguised as a copy fix, and should happen before any further admin UI work. Longer-term, if per-person accounts are wanted, the Supabase-Auth magic-link flow already exists server-side (`auth/callback/route.ts`) and just needs a UI entry point — that's a Phase 5 feature decision, not a design one.

12. **Mobile experience:** already the strongest-audited surface (§18) — no structural change proposed, only the safe-area-inset fix.

13. **Empty/loading/error states:** roll out `EmptyState` and a per-route `error.tsx`/`not-found.tsx` consistently (currently dashboard-only) — this is mechanical, low-risk, and closes the biggest state-coverage gap found in §18.

14. **Data visualization principles:** keep threshold-reference-line charts as the house style for anything with a "safe/watch/risk" band (proven pattern in `SalinityChart`); apply the same treatment to soil EC and battery/signal metrics on `station-detail` instead of the current plain-number tiles, so risk is visually legible everywhere it applies, not just for salinity.

15. **Accessibility principles:** treat the category-picker gap (§18) as the template case — any custom interactive control (not a native `<button>`/`<select>`) gets an explicit accessibility pass (role, aria-pressed/aria-selected, keyboard operability) before merge, not after.

---

## 20. Missing Features

- Real multi-role, RLS-enforced authorization reachable from the application (currently DB-only, §7/§17).
- Authenticated, signed firmware ingestion actually used by hardware (currently bypassed, §7/§10).
- Working water-salinity sensor reading (currently a stub, §6).
- Automatic store-and-forward replay on the gateway (currently logs but never resends, §10).
- OTA firmware updates from the field (server-side pieces exist, firmware side doesn't, §5).
- Durable rate limiting and durable demo-report fallback storage for serverless/multi-instance hosting (§7/§8).
- Frontend component tests, API route tests, e2e tests (§13).
- Lint step in CI; RLS/integration tests on every PR, not just weekly/release (§14).
- A `not-found.tsx` for the app (or at minimum for `/s/[stationId]`) and consistent `loading`/`error` coverage beyond the dashboard (§18).
- A real UI entry point for the existing-but-orphaned Supabase magic-link auth flow, if per-person admin accounts are wanted (§11/§19).
- Firmware build-target documentation/config so `platformio.ini` doesn't ambiguously compile 4 independent files together (§6).

## 21. Technical Debt

- Three dead-but-built components (`MetricCard`, `AlertCard`, `StationCard`) duplicated by inline reimplementations that have already drifted (§11/§18) — the single highest-value cleanup target, since it's pure subtraction (delete the dead files, or delete the inline duplicates and wire up the real components — either direction reduces the codebase).
- `react-query` provider wired into the root layout with zero call sites — either use it or remove it.
- Orphaned `lib/supabase/middleware.ts` (a correct implementation that isn't wired into `middleware.ts`) and an orphaned Supabase magic-link auth flow (`auth/callback/route.ts`) that no UI triggers — both should be either connected or removed, not left as silent dead code that future contributors might assume is active.
- Generated build artifacts tracked in git (`apps/web/public/sw.js`, `workbox-*.js`, and until this session's fix, `tsconfig.tsbuildinfo`) despite a `.gitignore` entry that should exclude the first two — worth confirming whether these were committed before the ignore rule was added, and removing them from tracking if so.
- `firmware/esp32-node/src/main.cpp` + `platformio.ini` — a superseded scaffold stub coexisting with the real, working `.ino` firmware; candidate for deletion (§16).
- `infra/supabase/seed/mock_seed.sql` targets a table that no longer exists (§6) — delete or update to match the current schema (`pilot_seed.sql` is the working replacement).
- Radius/badge-token inconsistency across `components/ui/*` (§18) — mechanical cleanup once the design-system proposal (§19) is approved.

---

## 22. Prioritized Roadmap

### Phase 0 — Repository stabilization
- **Objective:** land the git reconciliation from §3 and get to a clean, reviewed baseline.
- **Files/modules:** the 6 hand-merged files; `apps/web/tsconfig.tsbuildinfo`.
- **Dependencies:** none — this is done pending your review.
- **Expected outcome:** a single clean commit on `main` incorporating both the origin and local work, stash dropped.
- **Tests:** `tsc --noEmit` in both workspaces (already passing); manual click-through of home/dashboard/about/station-detail/admin-login.
- **Acceptance criteria:** no `UU` files, no conflict markers anywhere, both typechecks pass, stash dropped only after your sign-off.
- **Risks:** none beyond normal review risk — no data was discarded.

### Phase 1 — Correctness
- **Objective:** fix the bugs in §6 that affect real behavior today.
- **Files/modules:** `trạm 1.ino` (salinity stub), `infra/supabase/seed/mock_seed.sql`, `platformio.ini` build config, (already fixed as part of Phase 0: dashboard double-`PublicShell`, `MetricCard` prop mismatch avoidance).
- **Dependencies:** Phase 0 merged.
- **Expected outcome:** salinity readings actually populate; seed script runs cleanly; firmware has an unambiguous build target per node.
- **Tests:** firmware bench test against a real EC probe; `psql -f mock_seed.sql` (or delete it) against a fresh migrated DB.
- **Acceptance criteria:** no `null` salinity in a live reading under normal sensor operation; seed script (if kept) succeeds on a clean DB.
- **Risks:** firmware sensor protocol work needs hardware access and may take longer than software fixes.

### Phase 2 — Security/reliability
- **Objective:** close the P1 findings in §7 — authenticate real firmware ingestion, wire up `/admin` middleware protection, remove hardcoded credential fallbacks, decide the RLS-vs-service-role trust model deliberately rather than by default.
- **Files/modules:** `gateway.ino`/station `.ino` files (add HMAC signing to match the documented contract, or formally re-document the gateway path with its own equivalent protections), `middleware.ts` (wire in the existing `lib/supabase/middleware.ts`), `lib/auth/localAdminSession.ts` (fail closed instead of falling back).
- **Dependencies:** Phase 1 (firmware changes touch the same files).
- **Expected outcome:** no unauthenticated write path into the database; `/admin` protected at both middleware and page level; no silently-defaulted secrets.
- **Tests:** extend `services/edge-ingestion/tests/contract.test.ts`-style coverage to the gateway path; add a session/cookie test for `localAdminSession.ts`; add middleware redirect test.
- **Acceptance criteria:** every ingestion path requires a verifiable signature; `/admin` redirects unauthenticated requests at the middleware layer; app fails to start (or logs loudly) if required secrets are unset rather than substituting a default.
- **Risks:** re-flashing/updating firmware in the field has real logistics cost; sequence carefully with Phase 1's firmware changes to minimize field visits.

### Phase 3 — Architecture cleanup
- **Objective:** remove the dead-code debt in §21 (unused components, orphaned auth/middleware code, unused `react-query`, dead firmware scaffold) and decide the RLS/service-role architecture question from Phase 2 formally (either start using RLS-scoped clients for any future non-admin route, or explicitly document that RLS is defense-in-depth only and the app-layer scope check is the real boundary).
- **Files/modules:** `components/dashboard/{metric-card,station-card}.tsx`, `components/alerts/alert-card.tsx`, `providers/query-provider.tsx`, `app/auth/callback/route.ts`, `lib/auth/bootstrap.ts`, `firmware/esp32-node/src/main.cpp`, `platformio.ini`.
- **Dependencies:** Phase 2 (touches some of the same auth files).
- **Expected outcome:** no component/provider/route exists in the tree without a live call site, or its dead status is a deliberate, documented decision.
- **Tests:** typecheck + build after each removal; no visual regression on pages that currently use the inline duplicates.
- **Acceptance criteria:** `grep` for each removed symbol returns zero references; bundle size doesn't regress.
- **Risks:** low — mostly subtractive.

### Phase 4 — HORIZON branding migration
- **Objective:** execute the plan in §16.
- **Files/modules:** `about/page.tsx`, `verify-deploy.mjs`, all `docs/*.md` + `README.md`, then a coordinated PR for `package.json`×4 + `package-lock.json` + both GitHub workflows, then a planned Supabase display-name rename and Vercel domain cutover.
- **Dependencies:** none strictly, but cleanest done after Phase 0 so it's not competing with merge noise.
- **Expected outcome:** zero live "Eco-Sense" strings anywhere; `@horizon/*` (or equivalent) package scope; documented plan for the domain cutover with no broken field QR codes.
- **Tests:** `git grep -i eco-sense` returns zero user-facing/package hits (ticket-ID historical references excepted by design); CI green after the workspace-scope rename.
- **Acceptance criteria:** matches the "now/later/leave" table in §16 exactly.
- **Risks:** the Vercel domain change is the only real-world-impact item — sequence it last and only after a parallel domain is confirmed working.

### Phase 5 — Product feature completion
- **Objective:** close the "missing features" in §20 that are product decisions, not just bugs — durable rate limiting/report storage, OTA, gateway store-and-forward replay, and a decision on whether per-person admin accounts (via the existing magic-link scaffolding) are actually wanted.
- **Files/modules:** `api/public/reports/route.ts`, `lib/reports/demoReportStore.ts`, `gateway.ino`, firmware OTA path, `app/admin/page.tsx` copy + optional new login UI.
- **Dependencies:** Phase 2 (security model needs to be settled first, since several of these are auth-adjacent).
- **Expected outcome:** product capabilities match what the UI already claims (or the UI stops claiming them).
- **Tests:** load-test the rate limiter under multi-instance simulation; verify a report survives a serverless cold start.
- **Acceptance criteria:** case-by-case per feature, defined when each is scoped.
- **Risks:** largest phase in scope/time; should be broken into sub-tickets per feature rather than shipped as one unit.

### Phase 6 — Website/UI redesign
- **Objective:** implement the design direction in §19, once approved.
- **Files/modules:** design tokens (`globals.css`), `components/ui/badge.tsx`, all public-facing pages for the language-consistency fix, `EmptyState`/`error.tsx`/`not-found.tsx` rollout, admin shell.
- **Dependencies:** Phase 3 (architecture cleanup should land first so the redesign isn't touching soon-to-be-deleted duplicate components) and Phase 4 (branding copy should be settled before a copy-heavy redesign pass).
- **Expected outcome:** one consistent design language, one badge vocabulary, one language-consistency standard per page, full state coverage.
- **Tests:** the accessibility-review checklist from §18 re-run against the redesigned surfaces; visual review against §19 item-by-item.
- **Acceptance criteria:** §19's 15 items each have a before/after and a stated rationale, matching this report's requirement that no visual change ships without a named user problem it solves.
- **Risks:** scope creep — treat §19 as the ceiling, not a floor; ship incrementally per page rather than as one big-bang redesign.

### Phase 7 — QA and production readiness
- **Objective:** close the testing gaps in §13, add lint + RLS/integration tests to the PR gate, and do a final security/accessibility pass before calling this rollout-ready.
- **Files/modules:** `.github/workflows/ci-validate.yml` (add lint step, consider a lighter-weight RLS check on PRs), new test suites for frontend components and API routes.
- **Dependencies:** all prior phases — this is the final gate.
- **Expected outcome:** every category in the Part 10 testing audit has at least baseline coverage; CI catches lint, RLS regressions, and firmware build errors before merge.
- **Tests:** the tests being added, by definition.
- **Acceptance criteria:** CI PR gate includes lint + typecheck + unit tests + a fast RLS smoke check for every push; weekly `ci-live-smoke.yml` remains for the fuller live-integration pass.
- **Risks:** adding RLS checks to every PR increases CI time/cost — worth scoping to a fast subset rather than the full weekly suite.

---

*This report reflects the repository state as reconciled in §3. Nothing beyond that reconciliation has been committed, pushed, renamed, or redesigned. Awaiting your review and approval before any phase above begins.*
