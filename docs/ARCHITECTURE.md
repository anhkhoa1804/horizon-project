# Architecture

**The single entry point for HORIZON's architecture.** For the deeper
reasoning behind each decision — alternatives considered and why they
lost — see [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) and
[`ARCHITECTURE_DECISION_RECORD.md`](ARCHITECTURE_DECISION_RECORD.md),
which this document summarizes and which are authoritative where the two
disagree. For the firmware↔backend wire contract in full field-by-field
detail, see [`FIRMWARE_BACKEND_CONTRACT.md`](FIRMWARE_BACKEND_CONTRACT.md).
For the auth model, see [`AUTH_ARCHITECTURE.md`](AUTH_ARCHITECTURE.md).

Last reconciled against source (firmware, migrations, seed data, and a live
Supabase project) 2026-09-18. Every claim below was verified by reading the
cited file directly, not carried forward from prior documentation.

## What is HORIZON?

A small-scale (pilot) environmental monitoring platform for Cồn Hô, a
farming community on an island in Vĩnh Long, Vietnam. Field stations measure
water level, salinity, and soil conditions; a gateway relays their readings
over the internet; a Supabase backend stores and validates the data; a
Next.js app serves a public dashboard, per-station pages, a community
field-report flow, and an admin console. It is not built to manage an
arbitrary or large fleet of devices — see **Station topology** below.

## Station topology — CURRENT: exactly 3 physical nodes

**HORIZON is a 3-station pilot, not a 5-station deployment.** This is
verified at the firmware level, not inferred from the database:

- `firmware/esp32-node/platformio.ini` defines exactly three PlatformIO
  build environments — `env:station1` (STATION_01, water sensor),
  `env:station2` (STATION_02, soil sensor), `env:gateway` (GATEWAY_01, the
  relay device). There is no `env:station3`, `env:station4`, or
  `env:station5` anywhere in the firmware — no hardware target exists for a
  4th or 5th sensor node.
- The `stations` database table additionally carries a **STATION_03** row
  ("Trạm 3 - Gateway" in the UI), which represents the gateway's own public-
  facing map location — the product intentionally shows the gateway as a
  third visible "touchpoint" (see homepage: "Trạm 1 - Dữ liệu nước / Trạm 2
  - Dữ liệu đất / Gateway - Gửi tin về bà con"), not a fourth firmware
  target. So "3 stations" means 3 physical devices — 2 sensor nodes + 1
  gateway — represented as 3 rows.
- `apps/web/app/admin/page.tsx`'s `managedStationIds` (the set of stations
  the admin runtime-config UI manages) and `apps/web/app/api/public/
  gateway/configs/route.ts`'s `defaultConfigs` are both hardcoded to exactly
  `STATION_01`, `STATION_02`, `STATION_03` — **this is correct and
  intentional**, not a bug or an oversight.

**STATION_04 and STATION_05 are retired fixtures, not operational stations.**
They were removed from the pilot seed, simulator and production-shaped
cleanup path in migration 027. Older audit records may mention “Brackish
Edge” and “Mangrove Spur”; those references are historical evidence, not a
current topology. The development seed still uses public placeholders for
the canonical nodes only, and physical devices require unique provisioned
secrets.

**Is the gateway meant to support arbitrary registered stations?** No.
`ingest.ts`'s auth model *technically* allows any active, registered device
to be attributed a reading (see `ARCHITECTURE_DECISION_RECORD.md` §4), so
the ingestion contract itself is not hardcoded to 3 — but every operator-
facing surface (admin runtime config, the gateway config-polling endpoint,
the product's "three touchpoints" narrative) is explicitly scoped to the
3-station pilot. Growing beyond 3 stations is a real, supported future
path — the ingestion layer doesn't need to change — but it is not the
current state, and nothing should treat the 5 existing DB rows as if that
expansion already happened.

## Is GCP required?

**GCP is not required for the current HORIZON architecture.** A repository-
wide search found zero code, configuration, or firmware that depends on any
Google Cloud product. GCP appears exactly twice in the whole repository,
both times as a hypothetical checklist column in
`IMPLEMENTATION_ROADMAP.md` ("Hardware? | Live Supabase? | GCP?"), answered
"No" for every real item except one aside about CI hosting — now resolved:
CI runs on GitHub Actions' own `ubuntu-latest` runners
(`.github/workflows/*.yml`), not GCP-hosted infrastructure. Every function
GCP could plausibly provide — Postgres hosting, an HTTPS ingestion
endpoint, authentication, static/PWA hosting, CI — is already provided by
Supabase (Postgres + Edge Functions + Auth), Next.js's own deployment
model, and GitHub Actions. Do not introduce GCP without a concrete, named
technical requirement that these cannot satisfy; none has been found.

## System summary

HORIZON (originally built as "Eco-Sense Cồn Hô" — that name persists in some
technical identifiers, e.g. npm workspace scopes, which are not renamed
without a deliberate migration) is a serverless environmental monitoring
platform. Field stations collect water, soil, and local air readings over
LoRa. The current gateway sends an authenticated envelope to the Next.js
gateway endpoint; the raw envelope is retained and its nested station payload
is promoted into typed PostgreSQL time-series tables. A separately maintained
HMAC-signed Edge Function contract remains available for compatible clients.

## Core data flow

1. ESP32 station takes a reading and sends JSON over LoRa UART to the gateway.
2. The gateway wraps the station payload with gateway identity, sequence,
   firmware and transport metadata.
3. The current gateway POSTs that envelope to `/api/public/gateway`, protected
   by `GATEWAY_INGEST_TOKEN`; the endpoint fails closed when unconfigured.
4. `gateway_observations` retains the untouched envelope as the audit source.
5. The nested Station 01 or Station 02 payload is also written to
   `environmental_readings` or `soil_readings`. Null fields stay null; EC,
   salinity, TDS and soil quantities are never substituted for one another.
6. Public Next.js pages read typed data from Supabase using an anon-key client
   scoped by RLS; admin pages use service-role only behind an authenticated
   admin session.
7. The signed `edge-ingest` contract is a second supported ingestion boundary,
   with HMAC, timestamp, range, registration and idempotency validation.

A device with its own connectivity can also self-authenticate directly
(`x-device-id` header equal to `payload.device_id`, signed with its own
secret) — the gateway-relay and direct-connect paths are the same contract.

## Deployment status: CURRENT vs FUTURE

**CURRENT (verified live):**
- Supabase project `edhcnccvbwuffiwzywfm` is provisioned and reachable.
- All 27 tracked migration files are applied to it (001–025 plus additive
  024/025 gateway and timezone follow-ups); RLS-scoped public reads work
  end-to-end against real data on every public route.
- The web application reads real data from Supabase in production (typed
  repository layer, anon-key client for public pages, service-role for
  admin). The retained gateway history currently promotes to typed Station 01
  water rows and Station 02 soil rows; EC and water temperature have real
  series sources.
- The deployed signed `edge-ingest` Function was exercised against the live
  project on 2026-09-18: valid signed telemetry was accepted, a duplicate was
  idempotently ignored, and stale/future replay attempts were rejected.
- `readWaterEc()` reads the configured EC, water-temperature, TDS and salinity
  registers. Its values are hardware-unverified at the installation site; the
  code no longer estimates salinity from EC when the salinity register is
  absent.
- Three GitHub Actions workflows exist and are well-formed:
  `.github/workflows/ci-validate.yml` (typecheck/lint/test/build on every
  PR and push to main), `ci-live-smoke.yml` (weekly cron + manual dispatch,
  live integration + RLS tests, gated behind `secrets.DATABASE_URL`),
  `release-deploy.yml` (tag-triggered: applies migrations, pushes edge
  secrets, deploys `edge-ingest`, runs post-deploy integration tests). An
  earlier version of this document, and `ARCHITECTURE_DECISION_RECORD.md`
  #10, both claimed "no CI/CD pipeline was found" — that was simply wrong;
  none of the prior phases that made this claim checked `.github/workflows/`.

**FUTURE / NOT YET VERIFIED:**
- Physical installation geometry, field calibration and long-duration device
  acknowledgement have not been independently verified from repository data.
- The live-tested signed Edge Function is an available ingestion boundary, but
  the installed gateway has not yet been independently shown to use it on
  physical hardware. The current token-authenticated gateway HTTP path remains
  the one evidenced by retained field observations.
- Water-salinity display units require datasheet and field-calibration
  confirmation before any salinity threshold can become operational.

## System boundaries

| Layer | Responsibility |
|-------|----------------|
| Firmware | Collect readings, sign payloads, retry safely, preserve power. |
| Edge ingestion | Authenticate devices, validate contracts, reject unsafe data, record audits. |
| Database | Store readings, health logs, events, devices, reports, roles, and thresholds. |
| Public app | Explain environmental state without login. |
| Admin app | Manage stations, thresholds, reports, alerts, and operations. |
| Documentation | Preserve product philosophy and implementation expectations. |

## Data domains and source of truth

Core entities, as actually named in the schema (`infra/supabase/migrations`),
with each concept's authoritative source:

| Concept | Source of truth |
|---|---|
| Station registry | `public.stations` (Postgres) — id, name, lat/lng, status |
| Device/credential registry | `public.devices` — `kind` column: `'gateway'` devices authenticate ingestion requests; `'station'` devices are attributed via the payload but may hold no secret of their own |
| Water telemetry | `public.environmental_readings` — `message_id` unique, the idempotency key |
| Soil telemetry | `public.soil_readings` — same shape, every measurement independently nullable |
| Device health | `public.station_health_logs` — battery/signal, nullable (not fabricated when unmeasurable) |
| Threshold-crossing alerts | `public.environmental_events` |
| Ingestion audit trail | `public.ingestion_audit_logs` (best-effort, never blocks the ingest response) |
| Community reports | `public.damage_logs` |
| Gateway runtime config (3-station pilot only) | `public.device_runtime_configs`, admin-editable |
| Agronomic reference thresholds | `public.crop_thresholds` |
| Admin allowlist | `public.admin_allowed_emails` |
| OTA catalog | `public.firmware_updates` — schema exists, currently unpopulated |

Other tables present in the schema: `users`, `station_assignments`
(Supabase-Auth scaffolding, built but not wired to any live UI — see
`AUTH_ARCHITECTURE.md`), `gateway_observations` (**deprecated** — superseded
by the gateway-relay path above; kept only for historical data, nothing
writes to it anymore).

The exact schema may evolve, but environmental readings, soil readings,
station health, community reports, thresholds, and audit history should
remain conceptually separate.

## Reading integrity

Environmental readings must be protected from accidental duplication and untrusted input.

Required integrity behaviors:

- `message_id` is unique and used for idempotency.
- Device must be registered and active.
- Payload must match contract version.
- HMAC signature must match canonical fields.
- Timestamp must be within replay window.
- Numeric readings must be within safe validation bounds.
- Sensor faults should create fault events and avoid treating bad readings as trustworthy.

## Sensor health model

Sensor health is not the same as environmental health.

- **Environmental health** answers whether the water condition is acceptable.
- **Sensor health** answers whether the data source is trustworthy.

The UI should never present a confident environmental interpretation when the sensor is faulty or stale. In that case, state should shift toward “sensor fault” or “offline” with clear explanation.

## Public transparency model

Public pages should expose environmental status, station freshness, charts, and community context without requiring login. Public access must not expose secrets, device credentials, private operator notes, privileged user data, or unsafe administrative controls.

## Admin operations model

Admin pages are authenticated operational surfaces, gated by a custom
password + signed-cookie session (not Supabase Auth — see
`AUTH_ARCHITECTURE.md`). **Built today**: station overview, gateway
runtime-config editing (3-station pilot scope), community-report triage,
admin allowlist management. **Not yet built**: a device/ingestion-health
view — `ingestion_audit_logs` and `environmental_events` exist and are
written to, but nothing in the admin UI surfaces them, so an operator can't
currently see "which devices failed auth" or "which stations are offline"
from the console itself.

Every sensitive admin action should be authorized, traceable, and reversible where practical.

## Reliability assumptions

The field environment may have unstable LTE, power constraints, sensor faults, high humidity, and physical device damage.

The platform should tolerate:

- delayed readings,
- duplicate telemetry,
- intermittent network failures,
- offline community reports,
- stale station state,
- partial data availability,
- sensor-specific faults.

## Security principles

- Device secrets must never be exposed to public or client-side code.
- Supabase service role keys must never be shipped to the browser.
- Public data access must be intentionally scoped.
- Admin access must use explicit roles and database policies.
- Ingestion must validate both transport-level gateway auth and device-level signatures.
- Audit logs should preserve security-relevant decisions.

## Extending the architecture

When adding a feature, define:

- which persona it serves,
- whether it is public or admin,
- what data it reads or writes,
- how stale or missing data behaves,
- what authorization policy applies,
- what audit trail is needed,
- how it appears on mobile,
- how performance is preserved.
