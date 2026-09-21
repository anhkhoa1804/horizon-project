# Firmware → Gateway → Backend Contract

This is the active field contract for the Con Ho pilot. For the hop-by-hop
field map and a copyable payload, see `GATEWAY_FIELD_CONTRACT.md`.

## Active path

`STATION_01` (water) and `STATION_02` (soil) send CRC16-protected compact
LoRa lines to `GATEWAY_01`. The gateway converts each accepted line directly
to a top-level `TelemetryPayloadV1` and sends it to the Supabase
`edge-ingest` function. There is no `gateway_id`/`raw_station_payload`
envelope and no public raw-telemetry API route.

The active devices are:

| Device | Reading kind | Role |
|---|---|---|
| `STATION_01` | `water` | Water-level and water-quality source |
| `STATION_02` | `soil` | Soil and ambient source |
| `GATEWAY_01` | — | LoRa receiver, cellular time source, bearer-authenticated relay |

`STATION_03` is the canonical Observatory location for the gateway; it is
not a telemetry-producing water station.

## Required payload shape

Every uploaded payload has `contract_version: "v1"`, `device_id`,
`message_id`, `timestamp`, `firmware_version`, `fault_flags`, `sequence`,
and `summary_minutes` at the top level. Water payloads additionally carry
`water_level`, `salinity`, and `sensor_status`; soil payloads carry `soil`
with at least one finite measurement. The gateway records its identity and
the timestamp meaning only inside `raw_station_payload` as audit metadata.

The gateway builds `message_id` as
`{STATION_ID}-{gateway_receipt_epoch}-{station_sequence}`. Replayed LoRa
frames retain the same value and are idempotently ignored by the database;
a station sequence reset cannot collide with a reading from a different
receipt epoch.

## Time semantics

Station `summary_minutes` is a local summary interval, never a Unix time.
The gateway queries cellular network time with `AT+CCLK?`, converts it to
UTC, and sets `timestamp` to the gateway receipt time. It queues rather
than uploads when time cannot be synchronized. `millis()` and boot uptime
are never serialized as measurement timestamps.

## Authentication

The deployed pilot model sends the configured gateway bearer in
`x-gateway-token`. It does not use request-body HMAC signatures. The
gateway's bearer must be provisioned in its firmware configuration and the
Supabase Function's JWT gateway setting must accept that model. The source
implementation is covered by tests; deployed JWT configuration and a
physical 4G upload are **NOT VERIFIED**.

## Failure behavior

- Invalid CRC, unknown station, or invalid payload: no upload.
- Unsynchronized network time: queue and retry after a later modem session.
- HTTP failure: preserve the pending canonical payload and retry.
- Sensor fault: represented by the contract's fault/null semantics; no
  fabricated readings are emitted.

Legacy JSON envelopes may still be parsed for serial-transition diagnostics,
but they are deliberately not forwarded to `edge-ingest`.
