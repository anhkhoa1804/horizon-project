# HORIZON field release checklist

Use one completed copy per physical device. Do not substitute simulator output
for a field result. Never place a device secret or gateway token in this log.

## Provision and flash

1. Build the correct station firmware.
2. Create a unique device secret in the production registry.
3. Put the device secret and gateway ingest token in the untracked provisioning
   source used for the physical unit.
4. Flash the station or gateway and record its firmware version.
5. Verify serial boot and the assigned station/device identifier.

## Radio and cellular path

6. Verify the station-to-gateway LoRa exchange.
7. Verify gateway modem boot and SIM registration.
8. Verify APN and PDP context.
9. Verify DNS resolution for the configured hostname.
10. Verify TCP/TLS without weakening certificate validation.
11. Verify the edge-ingest response and the final `+HTTPACTION` diagnostic.

## Data path and product checks

12. Verify Supabase persistence and message-id deduplication.
13. Verify the recorded timestamp in Vietnam time context.
14. Verify the public Observatory renders the real station reading.
15. Verify authenticated Admin shows the same station state.
16. Record sensor calibration, location, installation geometry, and any
    site-specific threshold validation.

## Release decision

Do not mark runtime configuration as applied until an authenticated station APPLIED frame confirms persistence and effective runtime settings. A config ACK alone is insufficient. Do not use firmware relay/buzzer constants as public
scientific thresholds without a separate field-impact review.

## Remote configuration bench validation (not completed in software QA)

- Apply migration 034 and provision matching per-station HMAC keys and gateway token/URLs.
- Keep polling disabled in general builds until a controlled bench build is authorized.
- Capture SET, ACK and APPLIED of one revision; compare station NVS, effective intervals/mode and Admin readback.
- Reboot, power-cycle and deep-sleep each station; verify effective settings/revision survive.
- Drop ACK/APPLIED, duplicate commands, test stale/conflicting revision and interrupted persistence.
- Disconnect cellular service and restart gateway; verify receipt queue survives and forwarding resumes without losing telemetry.
- Measure radio/control timing, modem HTTPREAD framing, power budget and sensor behavior before enabling field polling.
