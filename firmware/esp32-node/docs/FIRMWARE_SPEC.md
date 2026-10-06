# Firmware specification — active QoS1 builds

## Active targets

STATION_01 reads water probes; STATION_02 reads soil and ambient probes. Both aggregate and transmit bounded CRC16 S1/S2 frames, retaining pending telemetry until A1/A2 packet acknowledgement. GATEWAY_01 translates these to the existing TelemetryPayloadV1 for edge-ingest via authenticated cellular HTTPS and network receipt time. Older JSON receive branches are transitional; legacy JSON configuration cannot apply settings.

## Configuration

See the authoritative [remote configuration v1 specification](../../../docs/REMOTE_CONFIGURATION.md) for schema, HC1 messages, modes, revision rules, native Preferences persistence, receipt queue, source-of-truth policy and hardware validation limits. Station sampling/sleep bootstrap is revision zero and must not appear as applied remote state. Configuration is handled during active UART processing and telemetry ACK waits, with a final 2500 ms listen window before sleep. The gateway configuration poll interlock remains false.

## Build

`pio run -d firmware/esp32-node -e station1 -e station2 -e gateway`

Explicit build_entries select one physical target each. Platform espressif32@6.12.0, Arduino framework, esp32dev board, ArduinoJson@7.4.2. No OTA implementation or hardware validation is implied by these builds.

## Provisioning and field checks

Use the untracked example-based station/gateway secret headers; never commit real keys. Follow [FIELD_RELEASE_CHECKLIST.md](FIELD_RELEASE_CHECKLIST.md). Validate real sensor calibration, RF delivery, modem behavior, flash persistence, deep-sleep timing and power consumption on hardware before release.
