# edge-ingest Deployment Readiness

Assessed by reading `services/edge-ingestion/src/{ingest,httpHandler,edgeEntry,supabaseDb,config,canonical}.ts`,
`infra/supabase/functions/edge-ingest/index.ts`, `infra/supabase/deploy.ps1`,
`infra/supabase/config.toml`, and running the full mocked contract test
suite — Phase F, 2026-08-13, updated on 2026-09-18. The Function is now
deployed and its live HTTP boundary has been exercised; physical gateway
adoption remains unverified.

**Update (Phase G):** two real correctness fixes landed in `ingest.ts`
since this doc was first written: a failure isolation fix (a health/event
insert failure after a successful reading insert no longer causes a
retryable error that permanently skips those side effects on retry) and
`x-contract-version` header/payload cross-validation. Both are covered by
new regression tests; the contract test count is now 23/23, all mocked,
zero network calls. Also corrected: `.github/workflows/release-deploy.yml`
already automates the deployment steps below on a version-tag push — the
blocker is configuring that workflow's GitHub secrets and pushing a tag,
not writing or running a deploy script by hand.

| Requirement | Status | Evidence |
|---|---|---|
| Bundle (`infra/supabase/functions/edge-ingest/bundle.mjs`) matches current source | **READY** | Rebuilt via `npm run build:edge` this session; the previous checked-in bundle was one commit stale (reflected this phase's own `config.ts` dead-code removal) — now current. No CI check keeps this true automatically (`IMPLEMENTATION_ROADMAP.md` P1, still open). |
| Required env vars/secrets identified | **READY** | Hard-required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional, defaulted if absent: `MAX_TIMESTAMP_DRIFT_SECONDS` (300), `DEFAULT_CONTRACT_VERSION` ("v1"), `LOW_BATTERY_VOLTAGE` (3.6), `LOW_SIGNAL_STRENGTH_DBM` (-95). Site-specific salinity thresholds are intentionally absent; alerting must use the threshold registry. |
| Gateway authentication | **READY (SOURCE)** | The pilot gateway sends the configured bearer in `Authorization` and `x-gateway-token`; it does not sign request bodies with HMAC. `httpHandler.ts` passes the canonical top-level `TelemetryPayloadV1` unchanged to ingestion. The deployed Supabase JWT gateway setting remains **NOT VERIFIED** after this change. |
| Station/device validation | **READY (SOURCE)** | Payload identity is the canonical `device_id` (`STATION_01` water or `STATION_02` soil); the gateway is `GATEWAY_01`. The contract suite rejects malformed and legacy-enveloped payloads before writes. |
| Duplicate `message_id` handled correctly | **READY** | `supabaseDb.ts`'s `insertEnvironmental`/`insertSoilReading` map a `409`/`23505` (unique-constraint violation) response to `"duplicate_ignored"`, not an error. Test: "ignores duplicate message_id." This exact path was also exercised against the real live database in the prior integration phase (`integration-duplicate-*` audit rows exist in `ingestion_audit_logs`). |
| Invalid telemetry rejected correctly | **READY** | Missing fields, wrong contract version, bad signature, unregistered device, timestamp outside drift window (header and payload independently checked), out-of-range values, and sensor faults are all rejected with a specific `error_code` and a non-2xx status (`httpHandler.ts`'s `statusByCode` map) before any DB write. All covered by passing tests. |
| Soil and water payloads follow the documented contract | **READY** | `hasRequiredFields()`/`isFaulty()`/range checks branch on `reading_kind` exactly as `FIRMWARE_BACKEND_CONTRACT.md` describes: water requires salinity+water_level+both sensor statuses and is rejected whole-payload on any fault; soil requires ≥1 of 6 sensor fields to be a finite number and never uses the water fault model (each sensor independently nulls out). Dedicated 6-test suite passing, including "rejects a soil payload signed with the water canonical string" (cross-format signature confusion) and "soil values out of physical range are rejected." |
| Actually deployed to the live Supabase project | **VERIFIED LIVE** | `LIVE_SUPABASE_INTEGRATION=1 npm run test:integration` passed 4/4 on 2026-09-18 against the real `edge-ingest` URL. |
| Deployed function responds correctly at a real URL | **VERIFIED LIVE** | The live suite accepted valid signed telemetry, idempotently ignored a duplicate, and rejected stale and future replay attempts. This validates the deployed Deno/runtime boundary for those cases. |
| Gateway firmware's `AT+CCLK?`/multi-header `AT+HTTPPARA`/mbedtls-on-hardware assumptions | **NEEDS LIVE VERIFICATION** | Firmware has never been compiled or run on physical hardware (no PlatformIO/ESP32 toolchain available in any session, no SIM module to test against) — unchanged from prior phases. |

## Bottom line

The deployed ingestion boundary is live-tested: its signed acceptance,
duplicate handling and replay rejection all passed against the real Supabase
Function on 2026-09-18. The remaining readiness blocker is physical-gateway
adoption and verification of the SIM/firmware behaviour, not deployment of
the Function itself.
