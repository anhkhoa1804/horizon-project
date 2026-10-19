# Firmware specification — active QoS1 builds

## Active targets

STATION_01 reads water probes; STATION_02 reads soil and ambient probes. Both aggregate and transmit bounded CRC16 S1/S2 frames, retaining pending telemetry until A1/A2 packet acknowledgement. GATEWAY_01 translates these to the existing TelemetryPayloadV1 for edge-ingest via authenticated cellular HTTPS and network receipt time. Older JSON receive branches are transitional; legacy JSON configuration cannot apply settings.

## Configuration

See the authoritative [remote configuration v1 specification](../../../docs/REMOTE_CONFIGURATION.md) for schema, HC1 messages, modes, revision rules, native Preferences persistence, receipt queue, source-of-truth policy and hardware validation limits. Station sampling/sleep bootstrap is revision zero and must not appear as applied remote state. Configuration is handled during active UART processing and telemetry ACK waits, with a final 2500 ms listen window before sleep. The gateway configuration poll interlock remains false.

## Build

`npm run firmware:build:gateway`, `npm run firmware:build:station1`, and
`npm run firmware:build:station2` (or `npm run firmware:build:targets`).

Explicit build_entries select one physical target each. Platform
`espressif32@6.12.0` selects Arduino framework 2.0.17, `esp32dev`, and
ArduinoJson 7.4.2. CI pins PlatformIO Core 6.1.18 and caches downloaded
packages by the firmware configuration. No OTA implementation or hardware
validation is implied by these builds.

## Provisioning and field checks

Use the untracked example-based station/gateway secret headers; never commit real keys. Follow [DEPLOYMENT_CREDENTIAL_CONTRACT.md](../../../docs/DEPLOYMENT_CREDENTIAL_CONTRACT.md) and [FIELD_RELEASE_CHECKLIST.md](FIELD_RELEASE_CHECKLIST.md). Validate real sensor calibration, RF delivery, modem behavior, flash persistence, deep-sleep timing and power consumption on hardware before release.
