# Firmware ↔ Gateway ↔ Backend Contract

Field-by-field, read directly from `firmware/esp32-node/src/*.ino` and
`services/edge-ingestion/src/{types,canonical,ingest}.ts`. Two contract
layers exist and must not be confused: the **station→gateway** layer
(raw, unsigned JSON over LoRa UART — an internal implementation detail)
and the **gateway→backend** layer (`TelemetryPayloadV1`, signed — the
actual, versioned wire contract). Only the second is a "contract" in the
sense of something firmware and backend must agree on precisely; the
first is free to change without touching the backend as long as the
gateway's parsing keeps up.

## Station 1 → Gateway (internal, unsigned)

Raw JSON line, one object per `\n`-terminated LoRa transmission
(`trạm 1.ino`, `buildPayload()`):

```
station_id, firmware_version, message_id, uptime_ms, sensor_height_cm,
distance_cm, water_level_cm, ec_us_cm, salinity_ppt,
ultrasonic_status, ec_status
```

## Station 2 → Gateway (internal, unsigned)

```
station_id, firmware_version, message_id, uptime_ms,
air_temp_c(+_status), air_humidity_pct(+_status),
soil_temp_c(+_status), soil_moisture_pct(+_status),
soil_ec_us_cm(+_status), soil_ec_ms_cm, soil_ph(+_status),
crop, advice
```

## Gateway → Backend (`TelemetryPayloadV1`, contract_version `"v1"`) — the real contract

### Water (`reading_kind` absent or `"water"`)

| Firmware field (Station 1) | Gateway relay field | Backend field (`types.ts`) | Unit | Required | Status |
|---|---|---|---|---|---|
| `water_level_cm` | `water_level` | `TelemetryPayloadV1.water_level` | cm | yes (water) | ✅ implemented, real sensor |
| `salinity_ppt` | `salinity` | `TelemetryPayloadV1.salinity` | ‰ | yes (water) | Implemented in current Station 01 firmware; distinct from water EC |
| `ec_status` | mapped via `mapSensorStatus()` → `ok`\|`warn`\|`fault` | `sensor_status.ec_probe` | enum | yes (water) | ✅ implemented (status always reachable even though the underlying value is stubbed) |
| `ultrasonic_status` | mapped | `sensor_status.ultrasonic` | enum | yes (water) | ✅ implemented |
| `station_id` (used as source, not sent as-is) | first field of canonical string / `device_id` in body | `device_id` | string | yes | ✅ |
| `message_id` | passed through | `message_id` | string | yes | ✅ — idempotency key, DB-unique-constraint-backed |
| *(none — station has no clock)* | gateway's synced epoch (`AT+CCLK?`) | `timestamp` | unix seconds | yes | ⚠️ depends entirely on gateway's cellular time sync succeeding; see Timestamp Source below |
| *(none)* | always `0` unless `ec_status`/`ultrasonic_status` is `fault` | `fault_flags` | int | yes | ✅ |
| *(none — gateway can't measure a relayed station's battery)* | omitted | `battery_voltage` | V | **optional** | ✅ correctly omitted, not fabricated |
| *(none)* | omitted | `signal_strength_dbm` | dBm | **optional** | ✅ correctly omitted |
| `firmware_version` | passed through | `firmware_version` | string | yes | ✅ |
| *(none)* | `GATEWAY_DEVICE_SECRET`-derived | `x-signature` header | hex | yes | ✅ HMAC-SHA256 over the 12-field canonical string |

### Soil (`reading_kind: "soil"`)

| Firmware field (Station 2) | Gateway relay field | Backend field | Unit | Required | Status |
|---|---|---|---|---|---|
| `air_temp_c` | `soil.air_temp_c` | `SoilMeasurements.air_temp_c` | °C | no (nullable) | ✅ implemented (SHT30) |
| `air_humidity_pct` | `soil.air_humidity_pct` | `air_humidity_pct` | % | no | ✅ implemented (SHT30) |
| `soil_temp_c` (from THEC register 1) | `soil.soil_temp_c` | `soil_temp_c` | °C | no | ✅ implemented (Modbus) |
| `soil_moisture_pct` (THEC register 0) | `soil.soil_moisture_pct` | `soil_moisture_pct` | % | no | ✅ implemented (Modbus) |
| `soil_ec_ms_cm` (THEC register 2, converted uS/cm→mS/cm) | `soil.soil_ec_ms_cm` | `soil_ec_ms_cm` | mS/cm | no | ✅ implemented (Modbus) |
| `soil_ph` (pH sensor register 0) | `soil.soil_ph` | `soil_ph` | pH | no | ✅ implemented (Modbus) |
| *(none)* | always `0` (soil doesn't use the water fault model) | `fault_flags` | int | yes | ✅ each sensor reports its own null instead |
| `station_id`, `message_id`, `firmware_version` | passed through | same as water | — | yes | ✅ |
| *(none)* | gateway's synced epoch | `timestamp` | unix seconds | yes | ⚠️ same dependency as water |

At least one of the six soil fields must be non-null or the backend
rejects the whole payload (`hasRequiredFields`, `ingest.ts:38-47`) — an
entirely-null reading carries no information.

## Canonical string formats (must match byte-for-byte between gateway and backend, or signatures never verify)

**Water** (`buildCanonicalString`, both `gateway.ino:436-470` and
`canonical.ts:14-32` — read side by side and confirmed identical):
`device_id|message_id|timestamp|salinity|water_level|fault_flags|
ec_status|ultrasonic_status||{battery blank}|{signal blank}|
firmware_version|contract_version`

**Soil** (`buildSoilCanonicalString`, `gateway.ino:534-573` and
`canonical.ts:43-63`, also confirmed identical): `device_id|message_id|
timestamp|soil|air_temp_c|air_humidity_pct|soil_temp_c|
soil_moisture_pct|soil_ec_ms_cm|soil_ph|fault_flags|firmware_version|
contract_version`

Number formatting matters for signature agreement: both sides format
integers without a decimal point and trim trailing zeros from
non-integers (`fmtNumber()` in both `gateway.ino:419-434` and
`canonical.ts:3-5`) — verified equivalent behavior by reading both
implementations, not assumed from naming alone.

## Timestamp source

Neither station has a clock. The **gateway** is the sole timestamp
authority for both the canonical-string signature and the stored
`timestamp` column — it syncs via `AT+CCLK?` against the cellular
network every 15 minutes and computes `epochAtSync + (millis() -
millisAtSync)/1000` between syncs. If the gateway has never
successfully synced, `relayReading()`/`relaySoilReading()` refuse to
send at all and queue instead (gateway.ino:904-910, 928-934) — a
reading is never sent with a fabricated or zero timestamp. This is a
real, correctly-designed dependency: **if the gateway's modem can't
reach the cellular network, no data flows at all, for either station**,
regardless of whether the stations themselves are working perfectly.

## Sequence number / idempotency

`message_id = "{STATION_ID}-{bootNonce:hex}-{sequence}"`. `sequence`
persists across deep sleep (RTC memory) but resets to 0 on power loss;
`bootNonce` is re-randomized every boot specifically to prevent that
reset from producing a `message_id` collision with a prior boot's
readings, which the backend's unique constraint would otherwise treat
as an ignorable duplicate of *different* data. Verified this reasoning
directly in the firmware's own comment (trạm 1.ino:97-103) and confirmed
the backend behavior it's designed around (`environmental_readings.
message_id unique`, migration 006; `soil_readings.message_id unique`,
migration 019).

## What's optional vs. required, summarized

**Required for every payload:** `contract_version`, `device_id`,
`message_id`, `timestamp`, `firmware_version`, `fault_flags`, plus (kind-
dependent) either the water fields or at least one soil field.

**Always optional, never fabricated when absent:** `battery_voltage`,
`signal_strength_dbm` (gateway can't measure these for a relayed
station — correctly omitted, not zeroed), and `calibration`.
Station 01 does produce water `temperature_c` in the current gateway
envelope; migration 024 stores it as `water_temp_c` through the web ingest
path. The older signed-v1 DTO does not yet carry water EC/temperature.

## Compatibility verdict

The repository now has two explicit ingestion boundaries. The signed-v1 Edge
contract remains byte-consistent for its salinity + water-level pair and soil
object. The current gateway HTTP envelope is retained verbatim, then unwrapped
into the typed water/soil tables; this is the path evidenced by live
`gateway_observations`. Neither path proves physical installation or field
calibration on its own.
