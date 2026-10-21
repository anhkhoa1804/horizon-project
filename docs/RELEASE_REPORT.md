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

## BLOCKED (needs you; see `docs/APPROVAL_CHECKLIST.md`)
Apply 035 and 036 to production, deploy, one disposable production report, firmware compile/bench/flash, read-only production SQL for I-23, Storage headroom decision.

## NOT verified here
ESP32 compile and all hardware behaviour; I-23 root cause; Supabase cloud specifics (Free-plan limits, hosted Auth/CDN, PostgREST version); Vercel body limits; real phone-network upload; production smoke test; Realtime (not in the local stack: public-flows QA 18/19, the only failure is that WebSocket).

## REMAINING known gaps
- I-29: EN home still shows place names and two Vietnamese-only editorial posts (content decision).
- Unvisited route opened offline shows 404 instead of `/offline`.
- Soil panel age gating not examined in depth.
- Operator/researcher roles unimplemented (documented in `docs/AUTHORIZATION_MODEL.md`).

## Change log
See `CHANGELOG-audit-2026-10-21.md` and the commit series.
