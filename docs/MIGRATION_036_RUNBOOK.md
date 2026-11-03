# Migration 036 runbook — stale-revision conflict uses SQLSTATE `P0409` (fixes I-25)

**Status:** written and verified on the isolated local stack (Admin E2E 32/32 incl. stale-form-from-a-second-tab). **NOT applied to production.** Needs explicit approval (`docs/APPROVAL_CHECKLIST.md`, M2).

## Order and independence
- Apply **after 034** (it re-creates two functions defined there). **035 and 036 are independent**; recommended order 035 → 036 only so that the runbooks stay linear. Each is a single transaction.
- Idempotent: `create or replace function` for `store_remote_config` and `record_remote_config_event`; no tables, rows, grants or data are touched.

## Preflight (read-only)
`select to_regproc('public.store_remote_config'), to_regproc('public.record_remote_config_event');` → both non-null (034 applied).
Optional: `select pg_get_functiondef('public.store_remote_config'::regproc);` and save it (this is your rollback text).

## Postflight (read-only)
`select pg_get_functiondef('public.store_remote_config'::regproc) like '%P0409%';` → `true` (same for `record_remote_config_event`).

## Compatibility
- Web layer maps BOTH `40001` (old database) and `P0409` (new) to a conflict, so web and database can be deployed in either order.
- Behaviour unchanged except the error code of a stale revision: it now returns immediately instead of being retried in a loop by PostgREST 12.2.3 while the station advisory lock is held.

## Rollback
Re-run the saved pre-apply function definitions (or the 034 definitions). This restores the stall defect, so roll back only if 036 itself errors; nothing else depends on it.

## Stop conditions
Preflight returns null (034 missing) → stop. Any error → the transaction rolls back; report the message.
