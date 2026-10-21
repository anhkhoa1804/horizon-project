# HORIZON — user-flow test matrix

**Audit date:** 19 October 2026. Read with [AUDIT_ISSUES.md](AUDIT_ISSUES.md#audit-limits): the application was never run in a browser during this audit.

Result key
- **PASS-U**: an executed unit/integration test asserts it (mocked Supabase/Storage where noted).
- **PASS-S**: code reading only. No test or browser run.
- **SCRIPTED**: covered by `npm run qa:public-browser` (`scripts/public-flows-browser-qa.cjs`). Written and syntax-checked, **not executed**.
- **NOT RUN**: needs a running app, a database, or hardware.

| # | Flow | Start state | Action | Expected | Result | Evidence / where |
|---|---|---|---|---|---|---|
| 1 | Field Notes → article | Home, 6 notes | Click a card | Opens `/posts/{slug}`; back link returns to `#ghi-chep` | PASS-S, SCRIPTED | `field-notes-carousel.tsx`; script check 1. All 6 post bodies render: executed in `postsContent` checks |
| 2 | Field Notes by keyboard | Home | Tab to card, Enter | One tab stop per card, visible focus, title is the accessible name | PASS-S, SCRIPTED (click only) | Link wraps card; focus-visible outline in source |
| 3 | Report, text only | `/report` | Choose station, category, description, send | One row; success view | PASS-U (route, mocked DB), SCRIPTED | `reportDirectUpload.integration.test.ts` |
| 4 | Report with video ≤ 20 MB | `/report` | Attach `.mp4`, send | Small JSON POST; file PUT direct to Storage; finalize records it; "1/1 saved" | PASS-U (fake Storage), SCRIPTED (intercepted) | Real Storage **NOT RUN** |
| 5 | Video with empty/generic MIME (`.mov`, `.heic`) | `/report` | Attach | Accepted by extension | PASS-U | `reportEvidence.test.ts` |
| 6 | Unsupported type | `/report` | Attach `.pdf` | Refused before upload, with reason; concrete type never overridden by extension | PASS-U, SCRIPTED | `reportEvidence.test.ts` |
| 7 | Oversize video (> 20 MB) | `/report` | Attach | Refused with reason | PASS-U, SCRIPTED | same |
| 8 | Upload fails after report saved | Report created | Storage PUT returns 500 | Partial success, failed file labelled not uploaded, retry on same report; report not duplicated | PASS-U (server side), SCRIPTED (UI) | integration test: resign, no duplicate row |
| 9 | Finalize replay | Evidence recorded | Send finalize again | Idempotent, no duplicate `report_media` | PASS-U | integration test |
| 10 | Forged / foreign ticket | any | POST `/media` with bad ticket or other report's path | 403 / 400 | PASS-U, SCRIPTED | integration test |
| 11 | Double submit | Filled form | Double-click send | Exactly one POST | PASS-S (ref latch), SCRIPTED | not a race tested in a real browser |
| 12 | Invalid media declared | Manifest with 4 files / bad type | POST | 400 **before** a report row is written | PASS-U | integration test |
| 13 | Signing fails | Storage down | POST | Report kept, response says evidence not uploaded | PASS-U | integration test |
| 14 | Report with Supabase unconfigured | No env | POST | Honest failure, not success | PASS-U (existing tests) | not re-run end to end |
| 15 | Admin unauthenticated | No cookie | GET `/admin`, `/admin/export` | Redirect to login | PASS-S, SCRIPTED | middleware + `requireAdmin` |
| 16 | Admin login, wrong password / not allowlisted | `/admin/login` | Submit | Error, no cookie | PASS-U (existing session tests, not re-run under loader) | `adminSession` tests need `tsx` |
| 17 | Admin: view then resolve report | Report with status `new` | Click view, then resolve | Status `reviewing` → `resolved`, audit rows written | PASS-U (mutation), button PASS-S | UI **NOT RUN** (needs session) |
| 18 | Admin: media preview | Report with signed URLs | Open row | Video plays inline or download link; message if URL missing | PASS-S | **NOT RUN** |
| 19 | Admin CSV export (water, soil, date range) | Admin session | Submit export form | CSV with only existing columns; inclusive Vietnam end date; error redirects to `/admin?error=…` | PASS-U (columns vs migrations, date logic) | Against a real DB **NOT RUN** |
| 20 | Admin add/remove allowlist email, alert config, maintenance, calibration, site models, runtime config | Admin session | Each form | Row + audit event; audit failure not reported as success | PASS-U (existing `adminMutations`, not re-run under loader) | UI **NOT RUN** |
| 21 | Runtime config never claims applied | Config stored | View panel | State `STORED` until a station attests | PASS-S | `CONFIG_POLL_ENABLED=false`; no hardware touched |
| 22 | Observatory: stale / offline / partial / faulty displays | Live data states | Open `/dashboard` | Missing ≠ 0; offline ≠ healthy; EC ≠ salinity | NOT RUN (existing suites claim PASS; not re-executed). I-09, I-10 open | — |
| 23 | External weather separated from HORIZON data | `/dashboard` | Read labels | Labelled external | NOT RUN | — |
| 24 | Mobile 390 and desktop 1440 layout, overflow | any | Load pages | No horizontal scroll | SCRIPTED only | **NOT RUN** |
| 25 | Accessibility (names, focus order, contrast, reduced motion) | any | axe / manual | No blocking issues | Partly PASS-S (video button, post cards, report remove buttons); no automated scan run | **NOT RUN** |
| 26 | PWA offline fallback | Installed | Go offline | `/offline` shows | NOT RUN | — |
| 22a | I-09: packet without fault evidence | Live packet lacks `fault_flags` | Apply to model | Value shown, quality chip absent (not "valid") | PASS-U | `dataIntegrity.test.ts` |
| 22b | I-10: no snapshot | No Supabase data | Build real model | No `0` coordinates; demo unplaced | PASS-U | `dataIntegrity.test.ts` |
| 28 | Sign-in as non-allowlisted email vs wrong password | `/admin/login` | Submit | Identical error | PASS-U (source-level) | `loginDisclosure.test.ts`; browser NOT RUN |
| 29 | Stranger's failed sign-ins vs real admin | 5 failures from IP A | Admin signs in from IP B | Not locked out | PASS-U (throttle logic) | `loginRateLimit.test.ts` |
| 30 | Admin report pagination/filter/error state | >20 reports / read failure | Page, filter | Correct page; failure shown as failure not empty | Query parsing PASS-U; UI PASS-S; Supabase `range/count` NOT RUN | `adminReportsQuery.test.ts` |
| 31 | Dashboard soil box (demo, real/no data) | `/dashboard?mode=demo`, `/dashboard` | Load at 390/1440 | EC đất + Nhiệt độ đất; no Tín hiệu/Pin; "chưa có ngưỡng" until thresholds exist; no zeros without data | PASS-B (Playwright + screenshots) | With live data and a configured threshold: **NOT RUN** |
| 32 | Storage CORS for direct upload | Supabase project | Preflight `PUT` from production origin | Allowed | PASS (read-only OPTIONS) | bucket + migration 026 existence **NOT verified** |
| 27 | Real Supabase Storage accepts signed PUT from production origin (CORS, bucket, migration 026, size cap) | Production/staging | Submit a real 15 MB video | Object lands; row recorded; admin sees it | **NOT RUN, BLOCKED** | See "To run on your machine" |

## Commands executed in this audit

| Command | Result |
|---|---|
| `tsc --noEmit` on `apps/web` (both tsconfigs) | Pass |
| ESLint on every changed file | Clean |
| `tsc --noEmit -p apps/web/tsconfig.json` after all changes (re-run, Linux VM, repo's own TypeScript) | Pass, no output |
| ESLint (repo config) on all changed `.ts/.tsx` | Clean after fixing one `react/no-unescaped-entities` |
| Full `apps/web` `test` file list + `liveReadings.test.ts` via compiler-based loader (not `tsx`) | 359 tests: 351 pass; 7 fail = `remoteConfiguration` needs OpenSSL-built `remote_config_host` (not buildable on the VM); 1 fail was my `adminReportsQuery` bug, fixed and re-run green (25/25 on the 4 new/changed security-data suites) |
| `npm ci` (cloud copy, after egress was opened) | 691 packages |
| `npm run test -w @eco-sense/web` (project `tsx` runner) | **356/356 pass (21 Oct, after migration-035 tests added; earlier 352/352)** (the earlier compiler-loader run reported 359; the difference was not reconciled) — twice, before and after the soil-box change |
| `npm run check -w @eco-sense/web` / `npm run lint -w @eco-sense/web` | Clean |
| `npm run build -w @eco-sense/web` | Succeeds, 22 static pages |
| `npm run qa:public-browser` (Chromium 390 + 1440 against `next start`) | **19/19 pass**; screenshots in `docs/qa/screenshots/` (12 files) |
| `qa:vertical-slice` (edge ingestion, simulator, mock ingest) | **Not run** |

## To run on your machine (in order)

```
npm install
npm run lint -w @eco-sense/web
npm run test:web
npm run build -w @eco-sense/web
npm run start -w @eco-sense/web       # in one terminal
npm run qa:public-browser             # in another; writes docs/qa/screenshots/*
```

Then, against **staging or a throwaway report in production**: confirm migration 026 is applied and bucket `report-evidence` exists; check Storage CORS allows `PUT` from the site origin; submit a real ~15 MB phone video and confirm it appears in `/admin`.

## Local-staging rows (21 Oct 2026, isolated stack, synthetic data)

| Flow | Evidence | Result |
|---|---|---|
| Video/report upload: signed URL -> Storage PUT -> finalize, limits, partial failure | `scripts/staging/report-upload.e2e.mjs`, real Storage + Postgres | 21/21 |
| Admin authorization + all admin flows, DB-verified | `scripts/staging/admin-e2e.cjs`, Playwright | 32/32 |
| RLS policies | `infra/supabase/tests/rls.test.mjs` | 15/15 |
| Edge ingest: valid, missing salinity stays NULL, partial rows, bad token/device/contract/range, soil, public projection | `scripts/staging/edge-ingest.e2e.mjs`, real Edge Runtime | 12/12 |
| Migration 035 preflight/apply/idempotency/rollback | `local-stack/verify-035.sh` on schema clone | pass |
| Migration 036 / config-write stall | stale save over HTTP + Admin suite | fixed, 32/32 |
| Accessibility (axe, VI/EN, desktop/mobile, 7 pages) | `scripts/a11y-i18n-pwa-qa.cjs` | 0 violations |
| PWA install + offline (CORRECTED) | `scripts/staging/offline-sw.e2e.cjs` (kills a real `next start`) | 9/9: SW controls; visited pages render; unvisited routes show `/offline` (HTTP 200); no `/admin` or `/api` in any cache. The earlier "offline verified" rows used Playwright `setOffline`, which does NOT affect service-worker fetches, and are withdrawn. |
| Public flows in browser | `scripts/public-flows-browser-qa.cjs` | 18/19 (Realtime WebSocket absent locally) |
| Observatory integrity with fixtures: no rows, 6 h-old partial row, empty projection | ad-hoc fixture run | missing shown as "—/Chưa có dữ liệu", never 0; "n/3 sending" falls with stale data; weather cells carry the external marker |
| Theme (Light/Dark/System) + language (explicit > browser > vi) in a real browser | `scripts/staging/theme-lang.e2e.cjs` (dev server) | 21/21 |
| Dashboard axe (VI/EN, 390 and 1440 px) after the soil-card/hero/theme changes | `a11y-i18n-pwa-qa.cjs` + targeted run | 0 violations (Leaflet attribution links now underlined) |
| Dev soil fixture isolation | `tests/devSoilFixture.test.ts` | 8/8 (off by default; never under production/Vercel; STATION_02 only; real data wins) |
| Soil EC / soil temperature cards use the shared metric cell; md layout contract | `tests/observatoryComposition.test.ts` | pass |
| Unit tests / tsc / lint | `npm test`, `npm run check`, `next lint` | 368/368, clean |
| ESP32 compile, hardware behaviour, production smoke test | - | NOT verified here |

