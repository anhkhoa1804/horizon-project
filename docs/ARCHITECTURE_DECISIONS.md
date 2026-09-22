# HORIZON Architecture Decisions

This is the authoritative record of *why* the system is wired the way it is.
Where this document and another doc disagree, this document wins — the
others describe surface behavior; this one explains the reasoning and
supersedes any conflicting claim in `ARCHITECTURE.md`, `API_CONTRACTS.md`,
or `AUTHORIZATION_MODEL.md`.

Written after a full source-level audit (not from the pre-existing docs,
which were found to describe a system that didn't match what the code
actually did — see the "what changed" note at the end of each section).

---

## 1. Ingestion data flow

### Decision: one canonical path — gateway relays a token-authenticated contract

```
ESP32 station (Trạm 1 / Trạm 2)
  → raw sensor JSON over LoRa UART (unchanged, no crypto, no clock needed)
Gateway (GATEWAY_01)
  → reshapes into TelemetryPayloadV1, stamps real network time (AT+CCLK?),
    adds x-contract-version: v1 and its configured x-gateway-token
  → HTTPS POST to the Supabase Edge Function (edge-ingest)
edge-ingest (services/edge-ingestion)
  → validates gateway token, replay window, value ranges, sensor faults,
    idempotency
  → environmental_readings / station_health_logs / environmental_events
repositories (apps/web/lib/repositories)
  → anon-key client, RLS-scoped
dashboard / station pages
```

**What was canonical before this decision, and is now removed:** `POST
/api/public/gateway` (Next.js route) → `gateway_observations` (JSONB dump).
Nothing real ever depended on it — its target URL was a `https://
example.com` placeholder, confirmed by reading the firmware that posted to
it. It existed in parallel with the documented, tested, actually-secure
`edge-ingest` contract, which had zero producer. Two ingestion paths for one
product is not a transitional state worth preserving; it's the exact
"which one is real" confusion this decision exists to end.

**What was kept, not because it's used today, but because deleting captured
data is a separate decision from deleting a code path:** the
`gateway_observations` table. Migration 018 marks it deprecated via a
`COMMENT ON TABLE`. No code writes to it anymore.

**What was kept, unrelated to the ingestion duplication:** `GET
/api/public/gateway/configs` — a read-only polling endpoint for sample/sleep
interval config, not part of the two-ingestion-paths problem.

### Why the gateway signs, not each station

The alternative — each station holds its own secret and signs its own
payload — was seriously considered and rejected for one concrete reason:
**stations have no way to know real wall-clock time**, and the signed
canonical string includes `timestamp`, which is also what the backend's
replay-window check uses. A station with no RTC and no network of its own
cannot produce a timestamp the backend will accept more than a few minutes
after boot. Options considered:

1. *Give stations a clock via periodic LoRa time-sync from the gateway,
   keep per-station signing.* Real, but adds a new message type and clock-
   drift-tracking logic to every station, for a security property (blast
   radius if the gateway is compromised) that doesn't matter much at this
   scale — one gateway, a handful of stations, physically co-located.
2. **Gateway token relay (chosen).** The gateway already has real network
   time (cellular) and is the only networked device. It supplies the
   configured `x-gateway-token`; stations remain simple LoRa-only sources
   with no clock or network credential. `payload.device_id` remains the
   attributed station identity and is independently checked as active.

The pilot deliberately has no direct-station fallback. Adding one later
requires a separately scoped authentication design rather than silently
reusing a retired HMAC path.

### Why battery_voltage / signal_strength_dbm became optional

The original contract required both as non-null numbers. Two honest
problems: a LoRa-only station has no cellular modem, so "signal strength"
in the cellular sense doesn't apply to it — and even if it meant LoRa RSSI
instead, the current gateway firmware talks to the SX1278 module in raw
UART transparent mode with no register access to read RSSI, so there's no
honest value to report without different hardware/library, which I can't
verify from here. Separately, a relaying gateway has no way to measure a
*remote* station's battery voltage. Given the Phase A principle (never
fabricate a measurement), the only honest options were: block all station
data forever on a field nobody can honestly populate, or make the field
optional. Chose optional. `station_health_logs.battery_voltage` /
`signal_strength_dbm` are now nullable (migration 018); a health log row is
only written when at least one is actually present.

---

## 2. Authentication & authorization

### Decision: hybrid, but not the "everything is service-role, RLS is
decorative" hybrid that existed before

Three distinct identities, three distinct enforcement mechanisms:

| Identity | Mechanism | Enforcement boundary |
|---|---|---|
| Public / anonymous visitor | none | Postgres `anon` role grants + RLS (migration 018) |
| Admin (single shared operator) | custom HMAC-signed cookie, password login | Application-layer `requireAdmin()`; DB access via service-role |
| Device (gateway relay) | `x-gateway-token` + `x-contract-version: v1` | `services/edge-ingestion` token + replay + station-registration checks |
| Farmer / station-scoped human | **not built** — see below | Would be Supabase Auth + RLS's `has_station_access()` |

**Public reads now go through the anon-key client, not service-role**
(`lib/supabase/anon.ts`, `lib/publicRead.ts`). This was the single most
consequential fix in this pass. Before: every "public" page used the
service-role client, which bypasses RLS entirely — meaning the well-
designed `has_station_access()`/`is_admin()` policies in migration 009
were never evaluated for the majority of the app's read traffic, and a bug
in a public repository query had no structural ceiling on what it could
leak (it could `select("*")` on `devices` and nothing would stop it, only
code review). Migration 018 grants `anon` SELECT on exactly five tables
(`stations`, `environmental_readings`, `environmental_events`,
`station_health_logs`, `crop_thresholds`) with permissive `using (true)`
policies — the same tables the product's own philosophy already treats as
public. Everything else — `devices`, `ingestion_audit_logs`, `users`,
`station_assignments`, `damage_logs`, `firmware_updates`,
`admin_allowed_emails`, `gateway_observations` — has no anon grant, so it's
now *structurally* unreachable from a public request, not just
conventionally avoided.

**Admin deliberately stays on the custom password session, not Supabase
Auth.** This was a live option (a magic-link scaffold already exists,
unwired, at `app/auth/callback/route.ts`) and was rejected for this pass for
two reasons: (1) it can't be tested here — this environment has no way to
verify email delivery for a magic link, and replacing a working login with
an unverified one is a regression risk with no way to catch it before it
ships; (2) it's not actually buying anything. Admin is a single shared
operator role that is supposed to see and manage everything — using
service-role directly for an already-full-access role produces the
identical authorization *outcome* as wiring it through `auth.uid()` +
`is_admin()` + RLS would, just with one fewer layer. RLS earns its keep
when different users need different rows; a single trusted admin doesn't
create that need. What Phase A already fixed here stands: no insecure
password/secret default, constant-time comparisons, real session expiry.

**`middleware.ts` now does a real (if partial) check.** It used to be a
literal no-op — `/admin` was reachable at the edge with zero auth check,
and only got rejected after the full page render started, inside
`requireAdmin()`. It's still true that only `requireAdmin()` (page-level)
verifies the cookie's HMAC signature and expiry — that logic needs
`node:crypto`, which isn't available in the Edge Runtime middleware runs
in by default, and standing up Next.js's Node-runtime-middleware option
wasn't something to gamble on unverified. So the middleware does the
cheap, structurally-safe part: reject any request to `/admin/*` that
doesn't even have a plausibly-shaped session cookie, before it reaches the
database or the full render path. Defense in depth, not defense instead-of.

**Farmer / station-scoped access is designed, not built.** `RepositoryScope`
already supports `role: "farmer"` with a `stationIds` list; migration 009's
`has_station_access()` and `station_assignments` table already implement
the DB-side half correctly. What's missing is entirely UI/product layer: a
sign-up or invite flow, a station-assignment admin screen, and a
`getSessionContext()`-equivalent that constructs a farmer scope from a real
Supabase Auth session. None of that was built in this pass, on purpose —
per the explicit brief, this pass is architecture, not UI, and building
backend plumbing with zero caller would just be new dead code of exactly
the kind this audit keeps finding and removing. When farmer-facing UI is
scoped, the auth model it should sit on is: real Supabase Auth session →
anon-key-but-authenticated client (not service-role) → RLS does the
row-scoping via `has_station_access()`, already correctly written and
waiting.

---

## 3. Device authentication (detail)

- **Mechanism:** configured `x-gateway-token` and `x-contract-version: v1`.
  The gateway is the sole authenticated relay; stations are attributed by
  the top-level `payload.device_id` only.
- **Replay protection:** ±300s window on the gateway receipt `timestamp`.
- **Idempotency:** `environmental_readings.message_id` unique constraint,
  unchanged. Stations now include a boot-randomized nonce in their
  `message_id` (`trạm 1.ino` / `trạm 2.ino`) specifically because the
  sequence counter is `RTC_DATA_ATTR` — it survives deep sleep but resets
  to 0 after a true power loss, which without the nonce would produce a
  repeat `message_id` that the unique constraint would silently treat as a
  duplicate of the *original* reading rather than storing the new one.
- **Token rotation:** provision a new `GATEWAY_INGEST_TOKEN` into the Edge
  Function and gateway together. This is an operator action and is not
  performed by this repository.
- **Gateway vs. direct-connect:** the current contract is gateway-only.

---

## 4. Ingestion reliability

- **Out-of-order / stale observations:** rejected outright if outside the
  ±300s window — there is no "accept but flag as late" path. This was an
  existing, deliberate design choice, not changed here.
- **Malformed payload:** rejected with `MISSING_FIELD` before any DB write.
  Unchanged.
- **Sensor fault:** rejected with `SENSOR_FAULT` (422), recorded as an
  `environmental_events` row, **not** stored as an environmental reading.
  This means a station reporting a genuine hardware fault (e.g. Trạm 1's
  EC probe when it explicitly reports a fault) produces zero rows in
  `environmental_readings` until the sensor works — this is correct, not a
  bug: a "fault" reading with an invented numeric value would be exactly
  the fabrication Phase A eliminated everywhere else.
- **Partial sensor readings:** `battery_voltage` / `signal_strength_dbm`
  are optional (section 1); `salinity` / `water_level` are not — a reading
  without a real water-level or salinity number isn't a reading.
- **Offline gateway buffering:** `gateway.ino` now queues failed relay
  attempts to `/gateway_pending.jsonl` on SD, storing the station's *raw*
  fields rather than a pre-signed payload — because a signature more than
  ~5 minutes old will always fail the replay check regardless of retry
  count, so retries re-stamp the current time and re-sign from scratch
  rather than replaying stale bytes. `retryPendingQueue()` (new) actually
  resends every 20s; the previous version logged "manual replay is
  required" and never did anything automatic.
- **HTTP response semantics:** unchanged — `retryable: true` only on
  `INTERNAL_ERROR`; everything else is a definitive accept/reject.

---

## 5. Database model

No table was restructured. Two targeted changes, both in migration 018:

- **`devices.kind`** (`'station' | 'gateway'`, default `'station'`) — makes
  the auth-model distinction from section 1 representable in the schema
  instead of only living in application logic and comments.
- **`station_health_logs.battery_voltage` / `.signal_strength_dbm`** — now
  nullable, matching the contract change in section 1.

Not changed, and why: `environmental_readings` / `environmental_events` /
`devices` / `station_assignments` / `users` are correctly modeled already —
the problem was always *access* (service-role bypassing RLS), never
*shape*. `gateway_observations` is deprecated (comment only, not dropped —
dropping captured historical data is a separate call from deprecating a
write path). Trạm 2's soil/pH/humidity fields still have no canonical
columns anywhere — that's a real gap, but designing that schema needs
domain input on what a "soil reading" entity should look like long-term,
not a mechanical migration; flagged as a P1 for a future pass rather than
guessed at here.

---

## 6. Public vs. authenticated vs. privileged

| | Tables/operations | Client |
|---|---|---|
| **Public** | stations, environmental_readings, environmental_events, station_health_logs, crop_thresholds — full historical read | anon key, RLS-scoped |
| **Authenticated (admin today; farmer when built)** | damage_logs (own), station_assignments (own), users (own) | would be authenticated Supabase session + RLS |
| **Privileged** | devices, ingestion_audit_logs, admin_allowed_emails, firmware_updates, all writes to stations/thresholds/configs | service-role, server-only, behind `requireAdmin()` |

No secret or privileged operation is reachable through `/api/public/*` —
verified by re-reading every route under that path after this pass
(`api/public/gateway/configs` read-only non-sensitive; `api/public/reports`
rate-limited, writes only its own table).

---

## 7. Telemetry field mapping — Trạm 1 (water) and Trạm 2 (soil)

Full trace, station field → LoRa/gateway field → contract field → DB column
→ frontend field. Built by reading the actual firmware and backend source,
not inferred.

### Trạm 1 (water)

| Station field | Gateway extraction | Contract field | DB column | Frontend |
|---|---|---|---|---|
| `station_id` | `extractStringField("station_id")` | `device_id` | `environmental_readings.station_id` | `station.id` |
| `message_id` | `extractStringField("message_id")` | `message_id` | `environmental_readings.message_id` (idempotency key) | not displayed |
| *(none — station has no clock)* | gateway's `AT+CCLK?` network time | `timestamp` | `environmental_readings.timestamp` | `formatTimestamp()` |
| `water_level_cm` | `extractNumberField("water_level_cm")` | `water_level` | `environmental_readings.water_level` | `formatWaterValue()` / "Mực nước" |
| `salinity_ppt` | `extractNumberField("salinity_ppt")` | `salinity` | `environmental_readings.salinity` | `formatSalinityValue()` / "Độ mặn" |
| `ultrasonic_status` | `extractStringField` + `mapSensorStatus()` → 3-value enum | `sensor_status.ultrasonic` | `environmental_readings.ultrasonic_status` | `sensorStatusLabel()` |
| `ec_status` | mapped to the three-value status enum | `sensor_status.ec_probe` | valid readings persist; explicit faults are rejected | Observatory quality state |
| `distance_cm`, `sensor_height_cm`, `ec_us_cm` | not extracted by the gateway at all | — | — | **NOT MODELED** — raw diagnostic values; `water_level_cm` is already the derived value the product needs, no evidence more granularity is wanted |
| *(never sent — no ADC battery read, no cellular modem)* | — | `battery_voltage`, `signal_strength_dbm` (optional) | not written (no health row when both absent) | "Chưa có dữ liệu" (honest, Phase A) |
| `firmware_version` | `extractStringField("firmware_version")` | `firmware_version` | **NOT MODELED for this path** — `environmental_readings` has no firmware_version column, and since no health row is written (no battery/signal), it's currently discarded after signing. Low-priority: cosmetic/diagnostic only, no product impact. | N/A |

### Trạm 2 (soil) — as of this pass

| Station field | Gateway extraction | Contract field | DB column | Frontend |
|---|---|---|---|---|
| `station_id` | `extractStringField("station_id")` | `device_id` | `soil_readings.station_id` | wired to repository + Observatory |
| `message_id` | `extractStringField("message_id")` | `message_id` | `soil_readings.message_id` | — |
| *(none)* | gateway's network time | `timestamp` | `soil_readings.timestamp` | — |
| `air_temp_c` / `_status` | `extractNumberField("air_temp_c")` (status not forwarded — see below) | `soil.air_temp_c` | `soil_readings.air_temp_c` | wired |
| `air_humidity_pct` | `extractNumberField` | `soil.air_humidity_pct` | `soil_readings.air_humidity_pct` | wired |
| `soil_temp_c` | `extractNumberField` | `soil.soil_temp_c` | `soil_readings.soil_temp_c` | wired |
| `soil_moisture_pct` | `extractNumberField` | `soil.soil_moisture_pct` | `soil_readings.soil_moisture_pct` | wired |
| `soil_ec_us_cm` (raw) | not extracted — gateway uses the station's own derived `soil_ec_ms_cm` instead | — | **NOT MODELED** (raw value; the derived one is what's stored, matching Trạm 1's water_level_cm precedent of storing the derived value) | — |
| `soil_ec_ms_cm` (derived) | `extractNumberField` | `soil.soil_ec_ms_cm` | `soil_readings.soil_ec_ms_cm` | wired |
| `soil_ph` | `extractNumberField` | `soil.soil_ph` | `soil_readings.soil_ph` | wired |
| `crop` (always `"grapefruit"` today) | not extracted | — | **NOT MODELED** — static per-deployment metadata, not a per-reading measurement; belongs on `stations` (a station-level column) if/when multi-crop support matters, not on every reading |
| `advice` (computed recommendation string) | not extracted | — | **NOT MODELED, deliberately** — this is a firmware-computed, un-audited text string with no versioned thresholds behind it; storing it as if it were data would let stale firmware logic silently become "the official advice" in the DB. The dashboard already computes its own advice from `crop_thresholds` (see `daily-comparison-chart.tsx`'s standards table) — that's the source of truth, not a device-generated string. |
| individual `_status` fields (`air_temp_c_status`, `soil_ph_status`, etc.) | not extracted | — | **NOT MODELED as status enums** — soil validation uses null-per-field instead (see §8); a sensor that faults sends `null` for its value rather than a separate status flag, which the gateway already does no translation for (see `numberOrNull()` in the station firmware) |
| *(never sent)* | — | `battery_voltage`, `signal_strength_dbm` (optional) | not written | "Chưa có dữ liệu" |

**Critical finding from this trace:** before this pass, the gateway's
`handleStationPayload` used ONE extraction path hardcoded to Trạm 1's field
names (`salinity_ppt`, `water_level_cm`, `ec_status`, `ultrasonic_status`)
for every station it relayed, including Trạm 2. Since none of those field
names exist in Trạm 2's payload, every relayed Trạm 2 reading would
resolve to `salinity: null, water_level: null` — which the backend's
`hasRequiredFields()` check rejects outright (`MISSING_FIELD`, 400) before
even reaching fault-handling logic. **Trạm 2 could not successfully store
a single reading through the canonical pipeline.** Fixed in this pass —
see §8.

## 8. Data model decision: Trạm 2's soil measurements

Evaluated against the brief's four options:

- **C (sensor/metric registry)** — rejected. A formal metric catalog is
  enterprise-scale complexity for a system with exactly two station kinds.
  Nothing in the product scope suggests HORIZON is about to support an
  open-ended set of sensor types.
- **B (generic typed measurement / EAV model)** — rejected for the same
  reason. A `(reading_id, metric_name, value, unit)` table trades schema
  rigidity for query complexity, and for six well-known, stable fields it
  adds indirection without benefit — the repository and frontend code would
  need to pivot generic rows into typed objects instead of reading typed
  columns directly.
- **D (defer)** — rejected as insufficient on its own. Deferring the full
  soil *product experience* (dashboard cards, charts) is still correct —
  see below — but deferring the *data capture* indefinitely means real
  measurements a real sensor is already producing keep getting silently
  discarded. That's the same category of problem Phase A spent most of its
  effort eliminating, just from the ingestion side instead of the display
  side.
- **A (add proper columns) — chosen**, via a new `soil_readings` table
  (migration 019) rather than widening `environmental_readings`. Reasons:
  - `environmental_readings.salinity`/`.water_level` are `NOT NULL` today —
    a real guarantee for the water path. Making them nullable to
    accommodate soil-only rows would weaken that guarantee for no reason,
    and mix two unrelated row shapes in one table — the exact modeling
    smell migrations 010/011 already worked to eliminate (the old
    `environmental_data`/`gateway_observations` mess).
  - Each of Trạm 2's six sensors faults independently (its own
    `_status` per field). Environmental_readings' model — reject the
    *entire* reading if *any* tracked sensor faults — would mean a broken
    pH probe blocks otherwise-good soil EC data. `soil_readings` instead
    makes every measurement column individually nullable: a per-field
    `null` means "this sensor didn't report," never a substituted number,
    consistent with the Phase A principle applied everywhere else.
  - Mirrors `environmental_readings`' proven shape (message_id unique
    key, station_id FK, timestamp, created_at) — same RLS/anon-grant
    pattern, same repository conventions, low-risk because it's not a new
    architecture, just the established one applied to a second kind.

**Wire contract change:** `TelemetryPayloadV1` gained an optional
`reading_kind?: "water" | "soil"` discriminator (absent = "water", so every
existing caller — tests, `scripts/simulator.ts`, `scripts/mock_ingest.ts` —
is completely unaffected) and an optional `soil?: SoilMeasurements` object.
Soil payloads sign a **separate** canonical string
(`buildSoilCanonicalString`, not an extension of the water one) — see
`canonical.ts`'s comment for why: extending the water format would risk
the already-proven 12-field format for zero benefit, since nothing has
ever successfully used the soil path anyway (confirmed above).

**Explicitly deferred, and why that's still the right call:** the
frontend read path for `soil_readings` (station-detail cards, dashboard
charts). Per this task's own brief, frontend implementation is out of
scope until the redesign phase (§9/Phase 8-9 below). The existing
station-detail UI already honestly shows "Chưa có dữ liệu" for Trạm 2
(Phase A) — that remains accurate (not a regression) until the redesign
phase wires up a real read path against the now-populated table.

## 9. What this pass explicitly did not build, and why

- **Farmer-facing sign-up/login UI** — no UI redesign this pass (explicit
  brief constraint); would be new code with no caller today.
- **Physical/site validation of Station 01 EC and salinity** — the firmware
  path exists, but field calibration evidence remains a separate requirement.
- **LoRa RSSI reporting** — needs to know which LoRa transparent-mode
  firmware the SX1278 module runs; guessing would mean fabricating a
  plausible-looking number, which is the one thing this whole effort is
  about not doing.
- **Automated device-secret rotation** — manual rotation via the `devices`
  table is adequate at current scale; building rotation tooling for ~6
  devices is speculative complexity.
- **Compiling the firmware** — no PlatformIO/ESP32 toolchain is installed
  in this environment (confirmed: `pio`, `platformio` both absent). Every
  firmware change was hand-reviewed against known-correct Arduino/ESP32/
  mbedtls API signatures, not compiled. Treat it as reviewed, not verified.
- **Applying migration 018 against a live database** — Docker is installed
  but its daemon isn't running (confirmed via `docker ps` connection
  failure), and this sandbox has no network path to a hosted Supabase
  project. The migration was validated by careful manual SQL review against
  the exact syntax patterns already proven to work in migrations 006/009 of
  this same repo, not by executing it.
