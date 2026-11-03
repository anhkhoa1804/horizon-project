# Remote configuration v1 — implementation and validation

Updated 6 October 2026. **Software simulation is not hardware validation.**

## Architecture and sources of truth

`Admin (authenticated) → server action → store_remote_config RPC → device_runtime_configs + audit_events → GET /api/public/gateway/configs → GATEWAY_01 → HC1 SET → station validation/NVS/effective state → HC1 ACK/APPLIED/REJECTED → durable gateway receipt queue → POST /api/public/gateway/configs/events → record_remote_config_event RPC → Admin readback`.

The runtime table owns desired configuration. The station's validated NVS `effective` frame owns its effective settings and applied revision after boot. The server separately records the station-attested applied revision/configuration; it never derives application from a desired row. Firmware revision-zero values are explicit bootstrap settings, never APPLIED. GATEWAY_01 is the relay; STATION_03 is its legacy inventory/map location and is never a configuration target.

The audit found that the former active station receiver was empty, sampling was constant, configuration had no persistent revision, legacy JSON used a different field vocabulary, and gateway polling was disabled. Those paths are replaced by the protocol below. Polling remains disabled deliberately as a field interlock.

## Canonical contract

Machine authority: `contracts/remote-config.v1.schema.json`. The generator produces `config_contract.generated.h`; `--check` catches drift. Golden fixtures exercise independently computed CRC/HMAC values against TypeScript and compiled production C++.

| Field | Meaning and bounds |
| --- | --- |
| contract_version | Integer 1; incompatible versions rejected |
| config_revision | Monotonic integer 1–4294967295; timestamp is not identity |
| station_id | STATION_01 or STATION_02 only |
| sample_interval_seconds | 5–86400 seconds; minimum elapsed awake time before the next collection |
| sleep_interval_seconds | 0–86400 seconds; sleep after an acknowledged telemetry summary and configuration listen window; zero keeps the station awake |
| mode | normal, rain_saver, maintenance |

No extra keys, omitted values, numeric strings, fractional intervals or implicit default substitutions. Canonical JSON field order follows this table. `normal` collects the existing eight raw samples. `rain_saver` collects the existing minimum of three valid-sample opportunities to reduce collection work; it is not a rain detector. `maintenance` collects normally and suppresses deep sleep. Radio, sensor-read and retry work can lengthen an actual cycle; sample interval is not a guaranteed wall-clock sensor frequency. Local summary windows and telemetry wire fields remain unchanged.

Admin supplies the expected stored revision. The atomic RPC allocates the next revision only for a settings change; an identical submission preserves revision. A stale expected revision returns conflict. Revision exhaustion rejects further writes rather than wrapping. The configuration write and STORED audit record share one transaction; audit failure rolls back the configuration. Station semantics: same revision/same full payload re-emits ACK/APPLIED without another NVS write; same revision/different payload is rejected; older is rejected stale; newer is validated, persisted and made effective. A storage failure emits ACK then REJECTED/persistence and keeps the previous effective state.

## Wire protocol

Newline-delimited ASCII, less than 192 bytes excluding newline:

`HC1|1|TYPE|S1-or-S2|revision|sample_seconds|sleep_seconds|mode|reason|CRC4|HMAC64`

TYPE: SET, ACK, REJECTED, APPLIED. All messages repeat the full settings. CRC16-CCITT-FALSE (polynomial 0x1021, initial 0xFFFF), four uppercase hex characters over everything before CRC. HMAC-SHA256 uppercase hex over `body|CRC`, with a unique station key of at least 32 ASCII characters. `ok` is mandatory for SET/ACK/APPLIED; REJECTED reasons are stale, conflict, persistence, unsupported, invalid. Malformed, unauthenticated, wrong-station and incompatible-version frames fail closed without a reply. Valid-but-stale/conflicting/persistence-failed SETs produce signed rejection.

The parser is bounded, rejects noncanonical numeric spellings and verifies CRC and MAC before mutation. Configuration inter-byte timeout is 1500 ms. Telemetry remains S1/S2 with its existing A1/A2 packet-sequence ACKs. The active telemetry ACK wait and ordinary station loop share the same bounded UART parser; queued A1/A2 acknowledgements remain available to the telemetry waiter. Both paths dispatch HC1 frames; configuration revisions never share telemetry ACK identity. Stations listen for configuration for 2500 ms after a successful telemetry exchange before entering sleep.

## State and evidence

| State | Evidence / interpretation |
| --- | --- |
| UNSET | No versioned desired row; form values are suggestions |
| STORED | Successful atomic intent/audit transaction |
| RETRIEVED | Authenticated GET records retrieval before returning actual intent |
| SENT | Gateway reports the signed SET after actual UART write/flush; this does not prove RF reception |
| ACKNOWLEDGED | Authenticated station ACK; processing accepted, persistence not yet proved |
| APPLIED | Authenticated station APPLIED, emitted after persistent write/readback and effective-state assignment; station attestation, not independent field verification |
| REJECTED | Authenticated station rejection and reason |
| FAILED | Explicit server/operator failure evidence through the private RPC; not inferred from silence |
| STALE | Admin-derived view of nonterminal intent with no recorded progress for 24 hours; desired revision remains unchanged |

Current desired state and last station-applied revision/configuration are separate. Delayed evidence for a recorded older revision remains auditable but cannot downgrade current intent. APPLIED followed by reordered ACK stays APPLIED. Evidence is idempotent per station/revision/state; the first occurrence is retained. This is a configuration audit trail, not a complete packet capture. FAILED is reserved for explicit private failure recording; transport failures retain retryable intent and become STALE rather than invented station failure. The UI never converts typed validation, database or audit errors into success redirects.

## Gateway and persistence

GET and receipt forwarding use the existing cellular HTTP stack with `x-gateway-token`, JSON content type, and exact URLs below. Poll interval is 15 minutes. Delivery retries the same revision every 30 seconds until matching APPLIED or a terminal rejection. Persistence rejection remains retryable. Two-second separation between station downlinks reserves a receipt window. After a telemetry ACK the gateway prioritizes a due configuration for that station while its listen window is open. Configuration HTTP requests are deferred while telemetry is pending, while modem HTTP is active, or until radio input has been quiet for five seconds. Receipt HTTP retries every 30 seconds; timeout/non-2xx retains evidence.

Gateway holds at most 16 receipt records, stored atomically as one NVS blob; validates loaded frames and bounds before forwarding. Duplicate pending records do not consume slots. New downlinks pause near capacity to reserve ACK/APPLIED space. Queue removal requires both a successful 2xx response and durable queue update. Gateway caches signed applied/terminal-rejected revisions in NVS; reboot reloads them, and the next successful GET reconciles desired state. A permanent authorization or historical revision error deliberately retains evidence; repair token/key/backend history before retrying. No unauthenticated queue-clearing endpoint exists.

Station uses native ESP32 Preferences, one `horizon-config/effective` key. Write plus readback must agree before effective state changes. Boot loads only a valid authenticated SET for its own identity. The host storage shim tests the production adapters' persistence logic and restart behavior; actual flash atomicity, power-loss behavior and wear remain hardware validation items. Preferences is documented by [Espressif](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/preferences.html). JSON parsing uses [ArduinoJson 7](https://arduinojson.org/v7/api/json/deserializejson/).

## API

- `GET /api/public/gateway/configs`: required x-gateway-token; actual stored canonical rows plus matching signed `frames`, `contract_version:1`, `gateway_id:GATEWAY_01`, `hardware_verified:false`. Empty database returns empty arrays. No default config is returned. Cache-Control: no-store, private.
- `POST /api/public/gateway/configs/events`: application/json, at most 512 bytes; exact fields contract_version, gateway_id, state, frame. SET→SENT, ACK→ACKNOWLEDGED, APPLIED→APPLIED, REJECTED→REJECTED. Version, identity, CRC/MAC, state/type and historical full payload must agree.
- Errors: 401 invalid/missing gateway token; 403 wrong relay identity; 503 absent server/database/key configuration; 404 station has no desired row; 409 unknown or mismatched revision; 422 invalid contract/evidence/state; 413 oversized receipt; 415 wrong media type; 405 unsupported method; 500 database/audit failure. Requests outside these routes retain Next's 404 behavior. Authentication scope is the configured single gateway; no second gateway scope is invented.
- No browser key, anonymous database client or authenticated nonservice role can write runtime configuration/evidence. Route handlers use the server-only service client. HMAC keys are read only from server environment; never NEXT_PUBLIC variables. Audit stores configuration and signed evidence, not the keys or bearer token.

## Alerts and firmware constants

| Input | Actual consumer / authority |
| --- | --- |
| device_runtime_configs | Only versioned remotely executable settings listed above |
| alert_configs | Stored operator intent; no execution engine or firmware consumer is wired to these rows |
| crop_thresholds | Agronomic reference data, never device commands |
| threshold registry | Public web interpretation rules, subject to documented provenance/confidence |
| WATER_RED_DISTANCE_CM=50, WATER_CRITICAL_DISTANCE_CM=5 | Gateway-local engineering lamps/buzzer; do not claim agronomic danger thresholds |
| SOIL_PH_HIGH_THRESHOLD=7 | Existing local pilot indicator; not a remotely controlled or validated crop rule |
| battery 2.5–18 V validity bounds | Engineering fault rejection, not environmental thresholds |
| minimum raw sample count, UART framing/timeout, retry/summary constants | Firmware implementation parameters, not remote operational settings |

Legacy JSON configuration functions are inert/deprecated and cannot apply settings. No crop or alert table is silently connected to the new protocol.

## Build, provision and release

1. Apply migrations through 034 in the target database using the existing migration runner. Migration 034 extends the existing table, creates atomic private RPCs and evidence constraints, and revokes anonymous/authenticated access. This work did not apply 034 to production.
2. Generate two unique random ASCII keys ≥32 characters. Provision server-only REMOTE_CONFIG_STATION_01_KEY / REMOTE_CONFIG_STATION_02_KEY; matching values in untracked gateway_secrets.h; each station's own value in untracked station_01_config_secrets.h or station_02_config_secrets.h. PlatformIO's station-specific build macro selects only that station's header, so building both targets cannot silently give station 2 station 1's key. Never use the committed synthetic fixture key.
3. Set the gateway token and HTTPS URLs for the same deployment. Existing TLS verification is retained. Build separately with `pio run -d firmware/esp32-node -e station1`, `-e station2`, `-e gateway`. All environments use the pinned ESP32 platform and explicit C++17 entry points. The prebuild script generates ignored ASCII station headers from the original Vietnamese filenames for the Windows Xtensa compiler; source files remain the authority.
4. Keep CONFIG_POLL_ENABLED=false. On a controlled bench, flash matching identities/keys, enable the interlock in a dedicated field build, then validate the complete SET/ACK/APPLIED path, lost receipts, reboot/deep sleep and network recovery before field release.
5. Do not wipe station revision storage or roll desired revisions back independently. If device NVS has a newer revision than the database, recover audited desired history and advance beyond it. Key rotation requires coordinated re-provisioning because persisted authenticated frames are keyed.

## Reproducible software tests

`npm run test:remote-config` checks generated contract drift, builds two native C++ hosts with warnings as errors, and runs PostgreSQL/protocol/API/integration tests. Requires Node 22+, C++17 compiler and OpenSSL development libraries; CXX may select a compiler. ArduinoJson 7.4.2 amalgamated test dependency is downloaded from the official release with a pinned SHA-256. Production firmware uses its pinned PlatformIO dependency.

The tests import production TypeScript services, use the actual Supabase SDK over local HTTP, execute real migration/RPC SQL in PGlite (embedded PostgreSQL), compile the actual station core and gateway Arduino adapter, and use test-only UART/Preferences/mbedTLS host shims. The local HTTP database facade implements the exercised PostgREST calls; it is not a deployed Supabase/PostgREST validation. Neither simulated configuration nor telemetry is inserted into production.

Coverage includes canonical bounds/version/fields, golden fixtures, corrupt CRC/MAC, station/key identity, no-op/conflicting/older/newer/maximum revisions, duplicate SET/ACK/APPLIED, lost receipts, reordered receipts, all modes, persistence failures, simulated reboot, empty database, migration validation, anonymous/authenticated denial, optimistic conflicts, atomic audit rollback, HTTP auth/content/status failures, retry after outage, durable gateway queue rollback, and Admin-state readback. Browser QA (`npm run test:remote-config:browser`) exercises authenticated real Next server actions and route handlers with isolated PostgreSQL transport redirection. Its preload blocks other production Supabase mutations and never ships in the app. It verifies rollback feedback, input preservation and mobile/desktop readback. The local .env.local supplies Admin sign-in; gateway token and station keys are explicit synthetic overrides for that process. Install a Playwright Chromium browser (`npx playwright install chromium`) or set HORIZON_BROWSER_EXECUTABLE to an existing browser. See REMOTE_CONFIGURATION_QA.md for actual commands/results and remaining release blockers.

## Verification boundary

**SOFTWARE VERIFIED** only for executed tests and successful compiler checks recorded in QA.

**HARDWARE NOT VERIFIED:** actual LoRa RF, UART/module fragmentation/duplex timing, modem HTTPREAD/HTTPS behavior and cellular auth, ESP32 flash/NVS during power loss, deep-sleep wake timing, real watchdog/reboot persistence, physical sensor interaction, interference/range and power budget. No physical ESP32 was available. Station-attested APPLIED in a future deployment does not itself establish an independently verified physical result.
