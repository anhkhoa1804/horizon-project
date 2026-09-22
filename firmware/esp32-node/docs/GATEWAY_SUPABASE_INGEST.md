# Gateway Supabase Ingest

This is the production path for gateway telemetry:

```text
ESP32 gateway -> Supabase Edge Function edge-ingest -> Supabase tables -> frontend
```

## Field network diagnostics

`+HTTPACTION` is emitted by the SIMCom modem, not by Supabase. In particular,
a value such as `702` is a modem transport result, **not HTTP 702**. The
gateway now logs the transaction stage without printing credentials:

```
[MODEM] ... PDP / IP readiness
[HTTP] status=401 response_bytes=... elapsed=...
[HTTP BODY] {short, redacted response}
```

For a future field test, capture the serial sequence from modem initialization
through `HTTPACTION`. It distinguishes an AT/SIM/PDP failure from an actual
HTTP response. A missing `+HTTPACTION` is logged as an unresolved
DNS/TCP/TLS-stage timeout; a `6xx` action code is explicitly labelled as a
modem transport failure. Do not disable certificate validation to work around
it. Verify carrier DNS, PDP IP allocation, time/certificate support in the
installed modem firmware, and the HTTPS hostname before changing credentials.

The production endpoints compiled into the gateway are:

- ingest: `https://edhcnccvbwuffiwzywfm.supabase.co/functions/v1/edge-ingest`
- runtime configuration: `https://horizon.frogsleap.com.vn/api/public/gateway/configs`

```

The gateway should not post to Pipedream in production. Pipedream is only useful
for temporary packet debugging.

## Endpoint

```text
https://edhcnccvbwuffiwzywfm.supabase.co/functions/v1/edge-ingest
```

The firmware constant is `WEB_SERVER_URL` in `src/gateway/gateway.ino`.

## Auth

The gateway sends:

```http
x-gateway-token: <token from gateway_secrets.h>
```

`gateway_secrets.h` is not committed. Create it from
`src/gateway/gateway_secrets.example.h`, then set:

```cpp
#define GATEWAY_INGEST_TOKEN_VALUE "the-same-value-as-supabase-secret"
```

The value must match the Supabase Edge Function secret
`GATEWAY_INGEST_TOKEN`. If it does not match, the Edge Function rejects the
packet and inserts nothing.

Every POST also includes `x-contract-version: v1`; the header must agree with
the body `contract_version`. A payload missing either required body fields or a
valid gateway token receives a terminal 4xx response and is not written.

## Payload shape and time

The gateway sends a top-level `TelemetryPayloadV1`, never the retired gateway
envelope. `device_id` is the relayed station (`STATION_01` or `STATION_02`),
not `GATEWAY_01`. `GATEWAY_01` is recorded only in the private
`raw_station_payload.gateway_id` relay-provenance object.

```json
{
  "contract_version": "v1",
  "reading_kind": "water",
  "device_id": "STATION_01",
  "firmware_version": "simple-qos1-wire",
  "message_id": "STATION_01-42-5C0F62A1E941907D",
  "timestamp": 1735689600,
  "fault_flags": 0,
  "sequence": 42,
  "sensor_status": { "ec_probe": "ok", "ultrasonic": "ok" },
  "raw_station_payload": {
    "wire_protocol": "S1|...|CRC16",
    "gateway_id": "GATEWAY_01",
    "timestamp_semantics": "gateway_network_receipt_time"
  }
}
```

`timestamp` is the UTC time when the gateway receives cellular network time
immediately before posting; it is not station measurement time and is never
derived from `millis()`/uptime. The gateway retains a staged LoRa frame on a
transport failure. Its message ID is a stable station/sequence/frame hash, so
a retry after a lost HTTP response is idempotent without inventing a timestamp.

For `STATION_01`, `fault_flags` bit 0 is EC probe unavailable and bit 1 is
ultrasonic unavailable; the matching `sensor_status` value is `fault`. For
`STATION_02`, bits 0–7 respectively represent unavailable air temperature,
air humidity, soil temperature, moisture, soil EC, salinity, TDS, and pH.
Station 02 keeps unaffected measurements and sends missing ones as JSON `null`.

## Timezone

Telemetry timestamp columns use PostgreSQL `timestamptz`. That type stores the
absolute moment, not a timezone label. Migration
`infra/supabase/migrations/025_vietnam_timezone_views.sql` sets the database
default timezone to `Asia/Ho_Chi_Minh` and adds read views for inspection:

```text
environmental_readings_vn
soil_readings_vn
station_health_logs_vn
environmental_events_vn
ingestion_audit_logs_vn
```

Use the `timestamp_vn` and `created_at_vn` columns in those views when checking
or deleting data by Vietnam wall-clock time. Keep application inserts pointed at
the original tables.

## STATION_01 Water Data

These typed top-level fields are stored in `environmental_readings`:

```text
station_id
message_id
sequence
summary_minutes
sensor_height_cm
distance_cm
water_level
ec_ms_cm
ec_us_cm
temperature_c
tds_ppm
salinity -> salinity
salinity_ppm
fault_flags
ec_probe_status
ultrasonic_status
timestamp
```

Battery fields:

```text
battery_percent -> station_health_logs.battery_percent
battery_voltage -> station_health_logs.battery_voltage
```

An unavailable station battery is `null`, not a gateway battery or a fabricated
zero. Gateway signal/battery is never attributed to a LoRa station.

## STATION_02 Soil Data

These typed top-level fields are stored in `soil_readings`:

```text
station_id
message_id
sequence
summary_minutes
crop
soil_temp_c
soil_moisture_pct
soil_ec_ms_cm
soil_ec_us_cm
soil_salinity
soil_tds
soil_ph
fault_flags
timestamp
```

Battery fields use the same `station_health_logs` behavior as STATION_01.

## Deploy Checklist

1. Run migrations:

   ```text
   infra/supabase/migrations/024_station_summary_ingest_fields.sql
   infra/supabase/migrations/025_vietnam_timezone_views.sql
   ```

2. Build the Edge Function bundle:

   ```powershell
   npm.cmd run build:edge
   ```

3. Deploy from `infra/supabase`:

   ```powershell
   npx.cmd supabase functions deploy edge-ingest --project-ref edhcnccvbwuffiwzywfm --no-verify-jwt
   ```

4. Set the Supabase secret:

   ```powershell
   npx.cmd supabase secrets set GATEWAY_INGEST_TOKEN="..." --project-ref edhcnccvbwuffiwzywfm
   ```

5. Put the same token in `gateway_secrets.h`, then flash the gateway.
6. Verify new rows in `environmental_readings`, `soil_readings`, and
   `station_health_logs`.
