# HORIZON API contracts

## Canonical field ingestion

```text
STATION_01 / STATION_02 → LoRa QoS1 CRC frame → GATEWAY_01
→ TelemetryPayloadV1 → 4G HTTPS → Supabase edge-ingest
→ typed telemetry tables → public read repository → Observatory
```

This is the only production telemetry write path. `/api/public/gateway` is
retired and must not accept writes, persist raw gateway envelopes, or expose
raw telemetry.

## Current pilot authentication

The relay uses `x-gateway-token`, sent only by `GATEWAY_01` from
`gateway_secrets.h`. The token authenticates the relay; `payload.device_id`
identifies STATION_01 or STATION_02. No service-role credential, anon key, or
production token is committed to firmware.

The observed `MISSING_FIELD` HTTP 400 proves a 4G request reached the Edge
Function application handler; the failure was the old body shape, not DNS,
PDP, TLS, or HTTP connectivity. The deployment's Supabase JWT setting remains
**NOT VERIFIED** until checked in deployed function configuration. Do not add
platform transport headers based on a documentation assumption.


## TelemetryPayloadV1

Required fields are top-level. The edge function does not unwrap or promote a
`station_summary` or `raw_station_payload` into a valid reading.

```json
{
  "contract_version": "v1",
  "device_id": "STATION_01",
  "message_id": "STATION_01-1700000000-7",
  "timestamp": 1700000000,
  "reading_kind": "water",
  "salinity": 0.055,
  "water_level": 121.4,
  "ec_ms_cm": 0.106,
  "ec_us_cm": 106,
  "temperature_c": 29.5,
  "tds_ppm": 53,
  "fault_flags": 0,
  "sensor_status": { "ec_probe": "ok", "ultrasonic": "ok" },
  "firmware_version": "simple-qos1-wire",
  "sequence": 7,
  "summary_minutes": 5,
  "raw_station_payload": {
    "wire_protocol": "S1|...|CRC16",
    "gateway_id": "GATEWAY_01",
    "timestamp_semantics": "gateway_network_receipt_time"
  }
}
```

STATION_02 uses `reading_kind: "soil"` with a `soil` object. Individual
unavailable soil sensors remain `null`; they are never zero-filled.

`timestamp` is gateway network receipt UTC from `AT+CCLK?`, not station
measurement time and never uptime or `summary_minutes`. If the network clock
is unavailable, the gateway holds the batch instead of posting a false time.
`raw_station_payload` is audit context only and cannot substitute for required
fields.

## Runtime configuration

`GET /api/public/gateway/configs` returns safe defaults only when Supabase is
reachable and no station-specific row exists. Missing Supabase or a failed
query returns `503 {"ok":false,"error":"configuration_unavailable"}`.
Firmware polling remains disabled until its authenticated device path is field
verified; storing a configuration is not evidence it reached a device.

## Public reports

Normal report submissions persist durably. A report row can succeed while an
evidence upload fails; the response carries `mediaFailures` and the UI renders
partial success. Demo persistence is available only from a non-production
process with an explicit demo request or local demo flag.
