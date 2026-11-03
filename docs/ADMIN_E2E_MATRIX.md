# Admin functional + authorization matrix (verified on isolated local staging)

**Environment:** local Supabase-compatible stack (`docs/LOCAL_STAGING.md`): real Postgres 15 with migrations 001–035,
real PostgREST, real Storage, real Edge Runtime; web app = `next build` production output on 127.0.0.1:3100.
**Method:** Playwright drives a real browser through the real Next.js server actions; every mutation is then
confirmed by reading the **database**, not the UI. Synthetic data only. Production was not contacted.
**Result:** `scripts/staging/admin-e2e.cjs` — **32/32 passed** (`admin-e2e.result.json`), screenshots in
`docs/qa/screenshots/admin-local/`.

## Authorization boundary (no / forged session)

| # | Scenario | Expected | Result |
|---|---|---|---|
| A1 | `/admin` without a session | redirect to `/admin/login` | PASS |
| A2 | `/admin/export` without a session | refused, no CSV data | PASS (307 → login via middleware; the route's own 401 is the second line of defence) |
| A3 | garbage cookie | refused on `/admin` and `/admin/export` | PASS |
| A3 | right payload, **wrong signature** | refused | PASS |
| A3 | correctly signed but **expired** | refused | PASS |
| A3 | correctly signed, email **not on the allow-list** | refused | PASS |
| A3 | unsigned payload only | refused | PASS |
| A4 | wrong password vs. non-listed email with the right password | **identical** response (no account enumeration) | PASS |
| A5 | 6th failed login, same client + email | `rate-limited`; the correct password from the throttled key does not get in either | PASS |
| A6 | another client, same account | not locked out by a stranger's failures | PASS |
| A7 | `redirectTo=https://evil…` | stays on this host | PASS |
| B17 | stale tab: session cleared, then a write is submitted | refused, **nothing written** | PASS |
| B18 | admin revoked from the DB allow-list while signed in | next request is refused | PASS |
| B19 | sign out | session unusable; export refused | PASS |

## Functional flows (each verified in Postgres)

| # | Flow | Verified in DB | Result |
|---|---|---|---|
| B1/B2 | Console renders; a station with no recent row is **not** shown as healthy | no "3/3 sending" | PASS |
| B3 | CSV export (environmental) | header matches schema; row count == DB count; empty range = header only; `data.export` audit row written | PASS |
| B4 | CSV: malformed range → 400; SQL-looking station value does not widen scope; soil dataset | — | PASS |
| B5 | Evidence: admin page renders a **signed** URL for the uploaded video and the URL serves the file | bytes served | PASS |
| B6 | Mark report viewed | `status=reviewing`, `viewed_at` set, audit actor = admin | PASS |
| B7 | Resolve report | `status=resolved` | PASS |
| B8 | Action on a non-existent report id | no row changed; `error=` shown | PASS |
| B9 | Alert threshold save (+ repeat save) | one `alert_configs` row (upsert, no duplicate) | PASS |
| B10 | Inverted thresholds | refused, nothing stored | PASS |
| B11 | Maintenance log | row, operator = admin | PASS |
| B12 | Calibration record; non-numeric reference refused | row / no row | PASS |
| B13 | Soil water model (FC/PWP/MAD); invalid model does not overwrite the valid one | values unchanged | PASS |
| B14 | Water-level context | row | PASS |
| B15 | Allow-list add → that admin can sign in → revoke → locked out; env-root admin cannot be revoked | row states | PASS |
| B16 | Remote config: save stores a new revision in state `STORED`, `applied_revision` stays empty; a **stale form from a second tab** is rejected and changes nothing | revision/values unchanged | PASS |
| B20 | No uncaught page/React errors | — | PASS |
| B21 | Audit trail: one entry per write, with actor, no secrets | 11 distinct action types | PASS |

## What this does and does not establish

- Establishes: the admin authorization boundary, validation, optimistic-lock and audit behaviour work on the real
  stack with the repository's own migrations.
- B16 proves a configuration is **stored** with the correct delivery state. It does **not** and cannot show that a
  device received or applied it — no device was contacted, and `applied_revision` correctly stays empty.
- The Admin uses one **shared password** plus an email allow-list (documented in `docs/AUTHORIZATION_MODEL.md`).
  Individual accountability therefore rests on the allow-listed email typed at login, not on separate credentials.
  Operator/researcher roles remain unimplemented (known, documented, not a regression).
- Not covered: real Supabase **cloud** Auth/SMTP behaviour (the Admin does not use it), and a production smoke test.

## Defect found by this audit (fixed)

Early runs stalled the database when a stale config save reached the RPC. Root cause (reproduced): the RPC raised
SQLSTATE 40001 and PostgREST 12.2.3 re-ran it in a loop while the advisory lock was held, queuing all later config
writes and exhausting the pool. Fixed by migration 036 (`P0409`); see AUDIT_ISSUES I-25. A second finding from the same
runs: the service worker cached `/admin` (I-26), which produced a hydration error (B20); fixed. Final run 32/32.
