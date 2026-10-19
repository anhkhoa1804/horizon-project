# HORIZON hardware validation gate

Remote configuration MUST remain disabled (`CONFIG_POLL_ENABLED=false`) until the complete real-device control loop has passed the bench gate in item 20. A host simulation, browser test, CI build, database state, or station-reported `APPLIED` receipt alone is not hardware verification.

## 1. Preconditions before connecting hardware

Use the exact production-intended board revisions, wiring, firmware commit, and a current schematic/pin map. Inspect for shorts and power polarity; use a current-limited bench supply and a fire-safe, supervised workspace. Keep external actuators disconnected. Record firmware build identity and confirm the gateway poll interlock is false.

## 2. Required real credentials and where they must be provisioned

Provision random unique deployment values of at least 32 characters through the secret manager/web server runtime, Supabase Edge Function secret store, and ignored Gateway/Station headers as specified in `DEPLOYMENT_CREDENTIAL_CONTRACT.md`. Gateway token copies and each station's HMAC copies must match exactly. Never place values in Git, serial logs, screenshots, browser code, or this evidence pack. Do not use fixtures or placeholders.

## 3. Gateway bench test

With a current-limited supply and no actuator load, verify boot identity, modem/SIM/network initialization, LoRa UART/radio setup, safe reset state, HTTPS capability, and watchdog servicing. Capture boot and version logs with credential values redacted.

## 4. Station 01 bench test

Verify the board identity, sensor and radio wiring, supply/battery measurement, sampling, bounded receive window, acknowledgement timeout/retry, persistence, sleep entry, and wake path. Compare raw sensor output with a calibrated reference instrument.

## 5. Station 02 bench test

Verify the soil/air sensor wiring and each reported quantity independently, including EC units and fault/null behavior. Compare readings with reference instruments. Verify radio, acknowledgement/retry, persistence, sleep, and wake behavior separately from Station 01.

## 6. LoRa uplink verification

For both stations, capture an uplink at the gateway and match station identity, sequence/message ID, field order, CRC result, timestamp meaning, and fault flags. Confirm bad CRC and wrong identity are rejected, and a lost ACK causes a retry without a second persisted measurement.

## 7. Gateway → Edge HTTPS verification

Using the provisioned device and hosted credentials, confirm TLS certificate validation, authenticated request, correct contract version, payload mapping, accepted response, and database provenance. Confirm an invalid token is rejected and no credentials appear in logs. Run only against the designated validation deployment or an approved isolated endpoint.

## 8. Remote-config GET verification

Keep polling disabled while first testing the authenticated GET manually from the gateway's real network path. Verify the signed intent, station identity, schema/version, revision, and empty/unset behavior. Confirm unauthenticated access fails and no station key is returned in the response.

## 9. Gateway → station CONFIG_SET verification

Only under the controlled bench approval in item 20, use one non-actuating configuration change. Verify the gateway queues and sends the matching station's authenticated `SET` during its receive window, with exact values and revision. Confirm a wrong station/key, malformed frame, or unsupported revision is rejected.

## 10. ACK verification

Capture a station `ACK` for the exact revision and payload. Verify the backend records `ACKNOWLEDGED` only after gateway forwarding and that a telemetry ACK cannot create configuration evidence. Test a lost ACK and duplicate ACK without revision downgrade or false success.

## 11. APPLIED verification

After station persistence and effective setting readback, capture `APPLIED` for the same revision and values. Verify Admin/database readback and the signed evidence chain. Label it station attestation; independently inspect station storage and observed runtime behavior before calling it hardware verified.

## 12. Restart/power-cycle persistence test

Cut and restore station and gateway power at controlled points before SET, during persistence, after ACK, and after APPLIED. Confirm no partial state is reported as applied, the last valid revision survives restart, and reconnect/replay cannot roll state backward.

## 13. Duplicate/lost-message test

Drop uplinks, telemetry ACKs, config SETs, config ACKs, APPLIED receipts, HTTPS responses, and receipt forwarding in turn. Replay duplicates and reorder messages. Verify bounded retries, idempotent storage, eventual recovery, no duplicate readings, and no false `APPLIED` state.

## 14. Sleep/wakeup test

Measure current draw and timing across repeated station sampling, receive-window, deep-sleep, wake, and retry cycles. Verify the intended configuration receive opportunity and RTC/NVS state survive. Compare measured power and wake timing to the documented budget.

## 15. Watchdog/reboot test

Induce controlled modem, radio, sensor, and network stalls. Verify watchdog recovery, bounded boot loops, safe output reset, durable queue behavior, and recovery without duplicate or fabricated telemetry/configuration evidence.

## 16. Sensor-read verification

Record raw and normalized measurements beside calibrated references across the expected operating range. Check units, offsets, plausible boundaries, noise, warm-up, missing probes, disconnected probes, and fault reporting for every channel. Do not infer agronomic thresholds from this hardware test.

## 17. Relay/GPIO verification

Keep pumps, valves, and other hazardous loads physically disconnected. With an isolated indicator or meter, confirm reset/boot output levels, polarity, pin mapping, and the documented warning outputs under safe test inputs. Confirm no unplanned pulse or actuation during boot, brownout, watchdog, sleep, or configuration changes. This gate adds no automatic irrigation behavior.

## 18. Field soak test

Only after bench sign-off, mount the equipment safely at the intended site. Run a supervised soak covering representative weather, radio range/interference, cellular outages, power variation, and sensor conditions. Compare local logs to Edge/database rows and investigate every gap, duplicate, reset, and outlier before release.

## 19. Evidence that must be captured

Store the commit/build identifiers, board and sensor revisions, wiring/pin map, redacted credential-source checklist, supply/current traces, reference-instrument comparisons, serial/radio/HTTPS captures, backend and Admin readback, restart/fault-injection matrix, photos of safe disconnected-load setup, field-soak timeline, anomalies, operator, and sign-off. Preserve enough timestamped evidence for independent reproduction.

Claim levels are separate: **SOFTWARE VERIFIED** requires passing source-level checks and named test results; **SOFTWARE VERIFIED IN ISOLATION** additionally requires reproducible isolated DB/browser/host tests and must identify its shims; **HARDWARE BENCH VERIFIED** requires the real boards, sensors, radio, modem, persistence, and controlled failure tests in items 3–17 with captured evidence; **HARDWARE FIELD VERIFIED** requires signed bench evidence plus the completed field soak in item 18, reconciled backend data, and resolved anomalies. No level inherits proof from the one before it automatically.

## 20. Exact conditions for changing `CONFIG_POLL_ENABLED=false` to true

Keep the production/release value false while preparing the bench. To exercise CONFIG_SET, use a separately identified bench-only firmware build under direct operator control, with actuator loads disconnected; this temporary bench build is not a production enablement. Keep the release candidate interlock false until the bench build proves the complete real-device loop.

Change the reviewed production value to true only after the matching real deployment credentials are provisioned and verified without disclosure; all three firmware targets compile in CI; Gateway and both stations pass the complete real-device loop from authenticated GET through matching `SET`, station persistence, `ACK`, `APPLIED`, and Admin readback; loss, duplicate, mismatch, restart, sleep/wakeup, watchdog, sensor, and safe GPIO cases pass; relay/actuator loads remain isolated during this gate; backend and firmware evidence is reconciled; and the hardware bench report is signed by the responsible operator. Then make a reviewed, versioned release change and enable polling only for the approved controlled rollout. Any missing or ambiguous evidence keeps the production value false. This item does not authorize automatic irrigation or remove the separate field-soak release gate.
