# Migration 035 runbook — mirror `ec_ms_cm`/`temperature_c` into the public water columns (fixes I-18)

**Status:** written, reviewed, and rehearsed on isolated databases. **NOT applied to production.**
Applying it to production requires your explicit approval (see `docs/APPROVAL_CHECKLIST.md`, items M1-M2: 035 then 036).

## What it does / does not do
- Adds a BEFORE INSERT/UPDATE trigger that copies `ec_ms_cm → water_ec_ms_cm` and `temperature_c → water_temp_c`
  **only when the target is NULL and the source has a value**; backfills existing rows by the same rule.
- Never touches `salinity`, never converts or derives anything (no EC→salinity), never overwrites a non-null value,
  deletes and drops nothing, idempotent.
- Effect: the public Observatory (which reads `water_ec_ms_cm`/`water_temp_c`) shows the EC and temperature the probe
  actually reported, instead of "missing", for rows written by older ingest builds.

## Evidence already collected (no production contact)
| Environment | Result |
|---|---|
| Vanilla Postgres 16 with a Supabase shim, representative seed (`infra/supabase/local-iso/035_apply_and_verify.sh`) | all checks as expected, `SALINITY UNCHANGED: yes` |
| **Real `supabase/postgres:15.8.1.085` image**, schema cloned from migrations 001–035 (`local-stack/verify-035.sh`, output `local-iso/035_verify_output_supabase_image.txt`) | identical results: 91 rows needing EC / 90 needing temp → 0 remaining; salinity checksum identical before/after; already-mirrored row untouched; all-null row stays null; EC-only row copies EC and leaves temperature null; new old-style insert is mirrored; re-apply is a no-op; rollback removes trigger+function |
| Unit test `apps/web/tests/waterColumnMirror.test.ts` | 4/4 |
| Full chain 001→035 applied to the local Supabase stack with RLS (15) / upload (21) / admin (32) suites green on top | passes |

## Procedure for production (after approval)

All SQL runs in the Supabase SQL editor for the production project. Use a **read-only** transaction for every read step.

1. **Preflight (read-only)** — `docs/READONLY_PRODUCTION_QUERIES.sql`, section "Migration 035 preflight":
   - P1 counts what *would* be mirrored (expected: a large number of rows needing EC and temperature).
   - P2 records the salinity checksum: write down `n`, `sum_salinity`, `n_nonnull_salinity`.
   - P3 must return `false` (035 not yet applied).
   - Optional safety: Supabase dashboard → Database → Backups (Free plan has no PITR; export the table first if you want a
     restore point: `pg_dump` of `environmental_readings` with the connection string, run on your own machine).
2. **Dry run inside production, rolled back** (needs the same approval as the apply; it takes a short table lock):
   ```sql
   begin;
   -- paste the full contents of infra/supabase/migrations/035_mirror_water_ec_temperature.sql here
   select count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null) as still_needs_ec from public.environmental_readings;  -- expect 0
   select count(*), coalesce(sum(salinity),0), count(salinity) from public.environmental_readings;                                         -- must equal P2
   rollback;     -- <- dry run: nothing persists
   ```
3. **Apply** — the same block with `commit;` instead of `rollback;`. Single transaction: any error leaves production unchanged.
4. **Postflight (read-only)** — repeat P1 (expect 0/0 remaining) and P2 (must be identical); open the public Observatory and confirm
   the water card now shows EC/temperature with the station's real timestamps (no "missing" for fields the probe reported).
   Check that the *latest-only* Observatory row refreshed (it is refreshed by the existing 033 projection trigger).
5. **Rollback (only if needed)**: `infra/supabase/local-iso/035_rollback.sql` drops the trigger and function. The copied values are
   *retained* on purpose: they equal the source columns, so they are correct data, not a side effect to undo.
   If you also want the copies removed you must restore from your pre-apply export; nothing else is required.

## Stop conditions (NO-GO)
- P3 returns `true` (already applied) → stop, investigate.
- Dry run changes the salinity checksum → stop (must never happen; 035 does not write `salinity`).
- Any error in the transaction → it rolls back automatically; report the message.

## Why this is low-risk
Single statement set, transactional, no deletes/drops, touches two nullable columns only when empty, verified on two
independent Postgres builds, and the rollback is trigger+function removal.
