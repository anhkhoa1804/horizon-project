# Gateway field contract

## Canonical active packet path

| Hop | Exact representation |
| --- | --- |
| Station 1 → gateway | `S1|seq|min|distance|water|ec_ms|temp|tds|sal_ppt|bat_v|bat_pct|CRC16` |
| Station 2 → gateway | `S2|seq|min|airT|airH|soilT|moist|ec_ms|sal|tds|ph|bat_v|bat_pct|CRC16` |
| Gateway acceptance | UART stream parser finds `S1|`/`S2|`, checks field count and CRC16, ACKs the same sequence. |
| Gateway → Edge | One top-level `TelemetryPayloadV1` per accepted packet, with `x-contract-version: v1` and authenticated by `x-gateway-token`. |

The older JSON receive branch is transition-only: it may ACK an already
deployed bench frame but never forwards it to `edge-ingest`.

## Time and identity

- Relay identity: `GATEWAY_01`.
- Attribution: `device_id` stays `STATION_01` or `STATION_02`.
- `summary_minutes` is a station aggregate window, not epoch time.
- `timestamp` is network-synchronized gateway receipt UTC (`AT+CCLK?`).
- If clock synchronization fails, no upload is attempted; the batch is held
  for retry rather than inventing a timestamp.

## Local hardware indicators

`WATER_RED_DISTANCE_CM`, `WATER_CRITICAL_DISTANCE_CM`, and
`SOIL_PH_HIGH_THRESHOLD` drive local lamps/buzzer only. They are engineering
relay behaviour, not Observatory environmental severity, and do not write
scientific alert events. Threshold-registry rows remain the operational source
of truth for public interpretation.
