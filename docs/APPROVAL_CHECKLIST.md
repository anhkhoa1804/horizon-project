# Consolidated approval checklist (everything that still needs YOU)

Nothing below has been done. Each item is outside the authorization given for safe, reversible, non-production work.
Reply with the item ids you approve (e.g. "approve M1, M2, D1"). Items are listed in the order I recommend.

## A. Things only you can run (read-only, no approval risk)
| Id | Action | Why | How |
|---|---|---|---|
| R1 | Run the read-only SQL for I-23 and 035 preflight in the Supabase SQL editor (`begin read only; ... rollback;`) | Explains the salinity-zero runs; gives the 035 baseline. I cannot read production data. | `docs/READONLY_PRODUCTION_QUERIES.sql` Q1-Q5, P1-P3, S1-S4. Paste results back (they contain no secrets). |
| R2 | Compile-only firmware build on your machine | The ESP32 toolchain could not be downloaded in my sandbox | `npm run firmware:build:station1`, then `firmware:build:gateway` and `firmware:build:station2`; send the last 20 lines of each. Flashes nothing. |

## B. Production database (needs explicit approval)
| Id | Action | Preconditions | Rollback |
|---|---|---|---|
| M1 | Apply migration **035** (mirror EC/temperature to public water columns) | R1 done and P3 = false; optional table export first | `local-iso/035_rollback.sql` (trigger+function; copied values stay, they are correct). Runbook: `docs/MIGRATION_035_RUNBOOK.md`, with a rolled-back dry run first. |
| M2 | Apply migration **036** - runbook `docs/MIGRATION_036_RUNBOOK.md` (stale-revision conflict code P0409; fixes the config-write stall) | `034` is already applied in production (check `select to_regproc('public.store_remote_config')`) | Re-create the two functions from migration 034 (restores 40001). Safe to apply on any PostgREST version. |

## C. Production deployment
| Id | Action | Contains |
|---|---|---|
| D1 | Deploy the web app to production | direct-to-Storage upload, admin export fix, login throttling, I-19/I-20, a11y fixes, SW fix (`/admin` never cached), explicit SW registration, EN home translation, zoom no longer locked. Deploy **after M2** so config conflicts map correctly (the web code accepts both codes, so order is not critical). |
| D2 | Post-deploy smoke test with ONE disposable synthetic report (small video) in production, then you delete it | The only production write in the plan; proves Vercel + Supabase Free-plan Storage + phone network end to end. |
| D3 | Supabase Free-plan Storage headroom decision | Run S3; Free plan cap is 1 GB. At 20 MiB per video that is ~45 reports. If headroom is short the options are a retention rule or a paid plan - decided by you, not requested now. |

## D. Hardware
| Id | Action | Preconditions |
|---|---|---|
| F1 | Bench test of the patched STATION_01 firmware on a spare board (register OK -> value matches the probe display; RS-485 unplugged -> packet carries `x`, ingest stores NULL) | R2 passed |
| F2 | Flash STATION_01 only (not operational nodes until F1 passes) | F1 + a copy of the currently flashed binary for rollback |
| F3 | Re-check I-23 with Q5 a day after flashing | F2 |

## E. Not requested
Credential rotation, destructive Git operations, production data edits, anything touching other stations. Not needed for the audit.
