# HORIZON final software release-gate audit

**Audit date:** 7 October 2026  
**Scope:** repository diff, current software suites, isolated database/browser tests, CI configuration, fail-closed deployment diagnostics, and read-only production inspection. No production writes were made. No physical hardware or CI runner was available to this audit.

## A. SOFTWARE VERIFIED

- The S1/S2 golden-path integration compiles and calls the shared production C++ parser and Gateway mapping. It verifies CRC, exact field shape, finite numeric values, station identity, stable message identity, sensor faults, water/soil mapping, EC and temperature projections, provenance, duplicate idempotency, retry after a failed database insert, and actual `ReadingRepository` readback after Edge ingestion into isolated PGlite. A source assertion fails if the Gateway sketch stops including/calling those shared functions or restores the old inline CRC parser. JavaScript/TypeScript does not reimplement this parser.
- All nine production Admin mutation functions are exercised through Supabase SDK requests against isolated PGlite. Each asserts persisted state, audit result, the Admin reader's readback, database failure, audit failure, and missing-row or invalid-input handling where relevant. The two report actions now use the same extracted report-row reader as the Admin page. The authenticated page wrappers still call `requireAdmin()`; all nine forms were not submitted in a browser.
- Admin freshness no longer treats historical `gateway_observations` or station health timestamps as current measurement/gateway freshness. The panel distinguishes data freshness, and alert configuration is described as stored operator intent only.
- CI YAML parses successfully. The workflow pins PlatformIO Core 6.1.18; `platformio.ini` pins `espressif32@6.12.0`, ArduinoJson 7.4.2, and C++17; separate commands target `gateway`, `station1`, and `station2`. Packages are cached; no production secret is needed to compile. The commands fail the job on target failure.
- Credential diagnostics identify required sources and source mismatches without outputting credential values. The detailed matrix is in [DEPLOYMENT_CREDENTIAL_CONTRACT.md](DEPLOYMENT_CREDENTIAL_CONTRACT.md). Public clients receive only the anon/publishable key; service-role and device credentials remain server/device-side.
- The remote-configuration software tests preserve `STORED`, `SENT`, `ACKNOWLEDGED`, `APPLIED`, `REJECTED`, `FAILED`, and `STALE`. Telemetry ACK is not configuration ACK. `APPLIED` remains station attestation only. `CONFIG_POLL_ENABLED` remains false.

## B. SOFTWARE VERIFIED IN ISOLATION

- `npm run test:web`: **304 passed, 0 failed, 0 skipped**. This includes the 11 telemetry/Admin mutation integration cases and the 13 remote-configuration tests.
- `npm run test:remote-config`: **13 passed, 0 failed**; these are included in the 304 web tests and are not added again to the distinct total.
- `npm run test:remote-config:browser`: passed with installed Microsoft Edge, isolated PostgreSQL/PGlite, the real Next server action/routes, compiled production Gateway/Station handlers, and Admin readback. Browser errors: 0; tested widths: 390 and 1440; production configuration writes: 0. This demonstrates an isolated station attestation flow, not hardware application.
- `npm run test:all -w @eco-sense/edge-ingestion`: **37 passed, 0 failed**. The optional live Supabase Edge integration was skipped and is not counted.
- `node --test firmware/esp32-node/tests/*.mjs`: **11 passed, 0 failed**.
- `node --test infra/supabase/tests/environmental_partial_readings.test.mjs`: **2 passed, 0 failed**.
- `npm run test:deploy-credentials`: **4 passed, 0 failed**.
- Distinct automated cases across the non-overlapping suites: **358 passed, 0 failed**. Browser QA is reported separately, not counted as an automated case total.
- `npm run check -w @eco-sense/web`, `npm run lint -w @eco-sense/web`, `npm run check -w @eco-sense/edge-ingestion`, `npm run build:edge`, and the serialized `npm run build -w @eco-sense/web` passed. CI-equivalent validation commands for edge typecheck/build and credential diagnostics passed locally.
- The telemetry/Admin target was also run by itself after the report-reader extraction: **11 passed, 0 failed**; those cases are included in `test:web`.
- `node --test infra/supabase/tests/credential-audit.test.mjs` is the 4-test credential suite above. `npm run db:validate-migrations` passed for 36 local migration files, while reporting historical duplicate prefixes 024 and 025; deterministic filename order is preserved. `git diff --check` passed.

## C. PARTIAL / NOT END-TO-END

- **ESP32 target compilation: NOT VERIFIED IN THIS ENVIRONMENT.** `npm run firmware:build:targets` stopped because `pio` is not installed or on PATH. The temporary local PlatformIO downloads/install were removed after inspection. No framework/toolchain version was changed to force a local build.
- **CI firmware build: CONFIGURED BUT NOT EXECUTED/VERIFIED.** YAML syntax and command/environment wiring were checked locally; no GitHub Actions run occurred. A checked-in workflow is not a build result.
- Isolated PGlite and HTTP facades exercise production functions and SQL contracts but are not the deployed Supabase/PostgREST service. Production authentication/session submission for every legacy Admin form was not browser-tested. The optional live Edge integration was skipped.
- The CI workflow has deterministic pinned PlatformIO and framework/library versions, but dependency resolution is only proven by an actual CI target run, which remains outstanding.
- `npm run verify:deploy` can check local copies against each other; hosted Edge secret inventory returns names only. **Credential presence is not equivalent to credential match.** The hosted Edge secret's value and the physical values flashed to any board were not compared.
- Live deployed RLS behavior and browser Realtime propagation were not re-tested because those checks require production test users/writes. Existing isolated permission tests and read-only production diagnostics are not a substitute.

## D. HARDWARE UNVERIFIED

- No ESP32, sensor, LoRa link, cellular modem, relay/GPIO load, flash power-loss, sleep/wakeup, watchdog, reset, current draw, physical sample, or field soak was tested. The isolated configuration host substitutes for real UART, NVS, network, and boards.
- **HARDWARE FIELD VERIFIED: NO.** `APPLIED` in a database is a signed station attestation, not independent physical verification. Production currently has no applied revision.
- The real relay outputs are not covered by this software audit. Hardware validation must keep pumps/valves disconnected and verify safe output states before any supervised, non-actuating check.
- [HARDWARE_VALIDATION_GATE.md](HARDWARE_VALIDATION_GATE.md) defines 20 hardware steps and separates SOFTWARE VERIFIED, SOFTWARE VERIFIED IN ISOLATION, HARDWARE BENCH VERIFIED, and HARDWARE FIELD VERIFIED evidence.

## E. PRODUCTION BLOCKERS

- `npm run verify:deploy` **fails closed**. Read-only diagnostics show the database reachable and all 37 recorded migrations applied, and show hosted Supabase Edge secret name `GATEWAY_INGEST_TOKEN` present. The gateway token and Station 01/02 HMAC copies are absent or placeholder in local runtime/ignored firmware headers. Four `devices.device_secret` rows still match public repository seed placeholders (`GATEWAY_01`, `STATION_01`, `STATION_02`, `STATION_03`). No values were printed.
- Read-only production data: 12 water readings, latest `2026-10-04T05:24:55Z`; 0 soil readings; 13 health rows, latest `2026-09-29T09:46:23Z`. The 432 `gateway_observations` rows are historical (latest `2026-09-17T04:26:01Z`) and no current writer was found; they are not presented as current gateway health. Realtime connectivity does not establish measurement freshness.
- Production runtime rows: STATION_01 and STATION_02 each have revision 1 in `STORED`, with `applied_revision` null. No production runtime state or telemetry was changed during this audit.
- The working tree changes migration `022_admin_operations.sql` only to correct a table comment about alert intent. No schema migration was added or deployed by this gate. Existing production migration deployment state was inspected read-only.
- Remaining release blockers are matching real credentials, clearing legacy public placeholder rows through the approved operational process, a successful CI firmware run, and complete bench/field evidence.

## F. HARDWARE VALIDATION GATE

Use the ordered checklist in [HARDWARE_VALIDATION_GATE.md](HARDWARE_VALIDATION_GATE.md). Remote configuration MUST remain disabled until the real Gateway-to-station control loop has passed the controlled bench gate: authenticated GET, matching CONFIG_SET, persistent station application, matching ACK and APPLIED, Admin readback, retry/replay, restart, sleep/wakeup, watchdog, sensor, and safe GPIO checks. Any missing or ambiguous evidence keeps `CONFIG_POLL_ENABLED=false`. Bench verification does not establish field verification; the field soak remains separate.

**Final release boundary:** software and isolated integration behavior are verified to the suites above. CI target compilation is configured but unverified. Production telemetry is stale/incomplete and credentials do not match. Hardware bench and field validation remain outstanding.
