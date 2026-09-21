# Gateway Supabase Ingest

This is the production path for gateway telemetry:

```text
ESP32 gateway -> Supabase Edge Function edge-ingest -> Supabase tables -> frontend

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

The legacy `horizon-frogsleap.vercel.app` hostname is not used by firmware.
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

## Payload Shape

The gateway sends a wrapper object, not the station payload directly:

```json
{
  "gateway_id": "GATEWAY",
  "firmware_version": "gateway-lora-wifi-0.8.2-rx-priority-preserve-http-fix",
  "sequence": 123,
  "uptime_ms": 456789,
  "transport": "lora_uart_to_4g",
  "raw_station_payload": {
    "type": "station_summary",
    "station_id": "STATION_01",
    "message_id": "STATION_01-1",
    "summary_minutes": 5
  }
}
```

`edge-ingest` unwraps `raw_station_payload`, normalizes it, and stores the
original station object in the database `raw_station_payload` column.

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

These fields from `raw_station_payload` are stored in
`environmental_readings`:

```text
station_id
firmware_version
message_id
sequence
summary_minutes
sensor_height_cm
distance_cm
water_level_cm
ec_ms_cm
ec_us_cm
temperature_c
tds_ppm
salinity_ppt -> salinity
salinity_ppm
raw_station_payload
```

Battery fields:

```text
battery_percent -> station_health_logs.battery_percent
battery_voltage_v -> station_health_logs.battery_voltage, only when positive
```

If `battery_voltage_v` is `0`, the zero value is preserved inside
`raw_station_payload`, but it is not treated as a valid battery voltage reading.

## STATION_02 Soil Data

These fields from `raw_station_payload` are stored in `soil_readings`:

```text
station_id
firmware_version
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
raw_station_payload
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
