# Release report (21 Oct 2026, local-staging checkpoint)

Scope: technical audit only. Presentations were delivered earlier (`docs/presentations/`) and are unchanged.
Evidence: **E** = executed against an isolated local stack (real Postgres, PostgREST, Storage, Edge Runtime, built from the repository migrations); production was never contacted.

## Answer to the staging question
A local Supabase-equivalent staging environment **was possible** (Docker; the Supabase CLI binary could not be downloaded, so the same images are run through `infra/supabase/local-stack`). No second cloud project and no paid upgrade are needed. See `docs/LOCAL_STAGING.md`.

## FIXED and verified (E)
- Direct-to-Storage video upload: 21/21 (real MP4, limits, partial-failure honesty, double submit).
- Admin authorization and every Admin flow, DB-verified: 32/32. RLS: 15/15. Edge ingest: 12/12.
- I-18 (migration 035 written, verified twice on isolated DBs), I-19, I-20, I-22 (firmware source, host-tested), I-25 (config-write stall, migration 036), I-26 (service worker cached /admin), I-27 (service worker never registered), I-28 (axe: 0 violations).
- `npm test` 356/356, `tsc` clean, `next lint` clean, production build succeeds.
- Observatory integrity with fixtures: no rows / stale partial row / empty projection show "—" and "no data", never 0 and never healthy; the sending count drops with stale data.

## Update 21 Oct (UI refinement + closure pass)
- **Corrected claim:** earlier "offline verified" statements were produced with Playwright `setOffline`, which does not reach service-worker fetches. A real test (server killed) showed unvisited routes failing with `ERR_FAILED`. Fixed with a custom worker (`apps/web/worker/index.js`); `offline-sw.e2e.cjs` 9/9 (I-30).
- Soil EC and soil temperature cards share one `MetricCell` with the four weather cards; no thresholds invented (neutral without a registry status; status always word + glyph, never colour alone). Status palette softened (green / neutral / amber / red, light and dark).
- Dev-only STATION_02 soil fixture behind `HORIZON_DEV_SOIL_FIXTURE=1` (default off, hard-disabled in production/Vercel, banner on the page, labelled synthetic). Never written to a database or sent through ingestion.
- Theme control Light/Dark/System (default System, explicit choice remembered); language: explicit > Accept-Language > Vietnamese; place names untranslated.
- Hero "Đây là HORIZON": white text on a dark plate, checked light/dark, VI/EN, mobile.
- Evidence: `npm test` 368/368, `tsc`/lint clean, theme-lang e2e 21/21, offline e2e 9/9, axe 0 on the dashboard. These are **local-staging results; they are not proof of production-cloud behaviour.**
- ESP32 compile-only: station1, station2 and gateway all build (PlatformIO, scratch copy; nothing flashed). Runtime/bench behaviour is still unverified.

## BLOCKED (needs you; see `docs/APPROVAL_CHECKLIST.md`)
Apply 035 and 036 to production, deploy, one disposable production report, firmware compile/bench/flash, read-only production SQL for I-23, Storage headroom decision.

## NOT verified here
ESP32 runtime and all hardware behaviour (compile-only passed); I-23 root cause; Supabase cloud specifics (Free-plan limits, hosted Auth/CDN, PostgREST version); Vercel body limits; real phone-network upload; production smoke test; Realtime (not in the local stack: public-flows QA 18/19, the only failure is that WebSocket).

## REMAINING known gaps
- I-29: EN home still shows place names and two Vietnamese-only editorial posts (content decision).
- (closed) Unvisited route opened offline now shows `/offline` (I-30).
- Soil panel age gating not examined in depth.
- Operator/researcher roles unimplemented (documented in `docs/AUTHORIZATION_MODEL.md`).

## Change log
See `CHANGELOG-audit-2026-10-21.md` and the commit series.
