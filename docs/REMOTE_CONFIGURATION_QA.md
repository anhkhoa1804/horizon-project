# Remote configuration software verification — 6 October 2026

## Result

The code now implements the complete versioned runtime-configuration chain. **SOFTWARE VERIFIED for the checks below. HARDWARE NOT VERIFIED.** No ESP32 was flashed or physically tested. No desired configuration, simulated ACK/APPLIED or telemetry was written to production. Remote polling remains disabled. Migration 034 and matching deployment keys still need provisioning before release.

## Changes

| Area | Files / implementation |
| --- | --- |
| Canonical contract | contracts/remote-config.v1.schema.json; contracts/fixtures/remote-config.v1.json; scripts/generate-remote-config.mjs; generated firmware contract header |
| Backend | apps/web/lib/gateway/remoteProtocol.ts, remoteConfigService.ts, remoteConfigStore.ts; authenticated configs GET and new configs/events POST routes |
| Database | infra/supabase/migrations/034_remote_configuration_v1.sql; desired/applied revisions, evidence timestamps/reasons, atomic intent/audit and receipt RPCs, private permissions, legacy STATION_03 excluded |
| Admin | apps/web/app/admin/page.tsx; components/admin/runtime-config-form.tsx; typed errors/results, optimistic revisions, honest state/readback, migration/read-failure message, failed-input preservation |
| Stations | src/trạm 1.ino, src/trạm 2.ino; shared remote_config.h and station_config_arduino.h; active bounded parser, distinct telemetry/config ACKs, native Preferences persistence, effective sample/sleep/mode getters |
| Gateway | gateway.ino; shared/gateway_config_arduino.h; strict JSON/version/frame validation, retries, target listen-window delivery, durable receipt queue and reconnect forwarding, cached terminal revisions |
| Build / provisioning | platformio.ini; build_entries; tools/prepare_sources.py; separate station_01/station_02 secret examples and gateway key examples; gitignore and server-only env examples |
| Tests / tooling | remoteConfiguration.test.ts; two compiled native hosts and host UART/Preferences/mbedTLS shims; build-remote-config-host.mjs; browser QA/preload; package scripts and dev dependencies |
| Documentation | REMOTE_CONFIGURATION.md; architecture/API/firmware/field contracts; firmware specification and field checklist; corrected historical control/identity/capability claims |

Prior visual/background/realtime changes in the working tree were preserved. Regression expectations were updated for the user's existing 19-row mobile/8-row tablet Bento layout and header typography. The daily-soil test double now implements the production query's range method. Language guards document the existing bilingual/place-name and authenticated operator-only components. The telemetry edge bundle was regenerated from its existing source.

## Protocol and state changes

HC1 v1 SET, ACK, REJECTED and APPLIED frames contain station, full settings and uint32 revision. CRC16-CCITT-FALSE plus station-specific HMAC-SHA256 protect canonical bounded frames. A1/A2 telemetry sequence acknowledgements remain separate and available through the shared UART parser.

Desired writes and STORED evidence are atomic. Applied revision/configuration are independent of desired revision. Duplicate/reordered/older evidence cannot downgrade current intent. APPLIED is emitted after station persistence/readback and effective-state assignment, then verified against signed evidence and historical intent on the backend; it is a station attestation, not independent physical verification. The full state vocabulary and reserved FAILED semantics are documented in REMOTE_CONFIGURATION.md.

## Executed checks

| Command / check | Result |
| --- | --- |
| npm run check | Web, test and edge TypeScript passed |
| npm run lint | Passed, no ESLint warnings/errors |
| npm run test:web | **288 tests passed**, zero failed; includes the new remote suite |
| npm run test:remote-config | **13 tests passed**, zero failed; production C++ hosts compiled with -Wall -Wextra -Werror |
| npm run test:remote-config:browser | Passed: real authenticated Next server action and GET/POST routes, Supabase SDK, real PostgreSQL functions, compiled gateway/station handlers, APPLIED Admin readback |
| npm run test:all | **37 ingestion contract tests passed**; live Edge integration suite skipped because live integration configuration was unavailable |
| partial_water_readings.test.ts | **3 tests passed** |
| node --test firmware/esp32-node/tests/*.mjs | **11 existing firmware regressions passed** |
| environmental_partial_readings.test.mjs | **2 migration regressions passed** |
| npm run test:rls | Live production RLS suite skipped because DATABASE_URL was unavailable; isolated new-RPC/table permission tests executed and passed |
| npm run db:validate-migrations | Passed: 36 migration filenames; historical duplicate 024/025 prefixes reported, deterministic order preserved |
| npm run build:edge | Passed |
| npm run build -w @eco-sense/web | Passed; both configuration routes included |
| PlatformIO station1 / station2 / gateway | **All three ESP32 targets compiled successfully** using pinned platform/ArduinoJson and explicit C++17 entry points |
| git diff --check | Passed |

No skipped live test is counted as deployed-service verification. PGlite executes real PostgreSQL SQL/RPCs in isolated memory. The HTTP facade supports the exercised Supabase SDK/PostgREST requests; it is not a deployed PostgREST/Supabase validation. Native shims replace physical transport/storage while importing the production configuration handlers.

## New failure and contract coverage

- Canonical version, exact fields/enums, deterministic serialization, interval/revision bounds and independent cross-language golden CRC/HMAC fixtures.
- Same revision/same payload, conflicting payload, older/newer/maximum revisions; concurrent Admin writes allocate one successor.
- Duplicate SET/ACK/APPLIED, lost receipts, reordered receipt delivery, stale readback and no-op intent.
- Real station core plus Arduino persistence adapter: bootstrap, simulated restart, NVS failure, mode/sample/sleep application, wrong identity/key and integrity rejection.
- Production gateway JSON parser/UART handler: matching canonical payload, unsupported version, wrong identity, duplicate target, mismatched settings and empty desired state.
- Actual gateway queue: bounded capacity, deduplication, restart restoration, corrupt storage rejection, persistence-failed removal rollback and retry clock wraparound.
- Actual PostgreSQL migration and RPCs: invalid contracts, private permissions, revision conflict, atomic desired/audit rollback, receipt-audit rollback and historical evidence reconciliation.
- HTTP gateway auth/configuration absence, malformed payload/integrity/state, media type/size, missing station/history, database outage and reconnect after simulated 401/403/404/409/422/500 transport failures.

## Browser evidence

The isolated browser test starts a separate Next process on localhost:4180. A test-only fetch preload redirects runtime/audit requests to an in-memory PostgreSQL HTTP facade, strips production API credentials from those requests and refuses other production Supabase mutations. It is not imported by deployment code.

The real Admin form saved revision 1. An injected audit trigger failure left revision/settings unchanged and displayed typed rollback feedback; the edited input remained intact. Retrying stored revision 2. The real Next gateway GET returned that signed intent, the compiled production gateway accepted it, the compiled station returned ACK/APPLIED, the real Next receipt POST persisted the evidence, and the actual Admin page read back APPLIED revision 2 with its hardware-verification limitation.

Two station forms were present. Admin had no page-level horizontal overflow at 390px or 1440px and no browser page errors. Browser fixture configuration and station application existed only in the isolated test process/database. No hardware, production device or production database was used to demonstrate application.

## Remaining release requirements

1. Apply migration **034** through the migration runner in the target database. It was tested in isolation and has **not** been applied to production. Until deployed, Admin explicitly reports an unavailable runtime schema/read instead of silently presenting a working control form.
2. Provision matching unique ≥32-character station keys on the server, the gateway, and each station's separately selected secret header. Current example values are empty and fail closed. Do not provision the committed synthetic test key.
3. Confirm deployed HTTPS endpoints, gateway token, Supabase service credentials and function/database permissions in the actual deployment. Live Edge/PostgREST/RLS behavior was not established by isolated tests.
4. Validate the real board/pin map, radio/module framing and duplex timing, cellular HTTPREAD/HTTPS behavior, NVS power-loss behavior, watchdog/reboot/deep-sleep persistence, sensor behavior, interference/range and power budget. Then enable polling only in a controlled validated release.

No software-path blocker remains in the executed isolated chain. Deployment provisioning and physical validation remain explicit requirements; production readiness on real equipment is not claimed.
