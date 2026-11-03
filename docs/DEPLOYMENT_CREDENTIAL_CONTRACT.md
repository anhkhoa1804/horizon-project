# HORIZON deployment credential contract

Keep deployment values in their owning secret stores and ignored local
headers. No active device credential belongs in Git or in a browser bundle.
`npm run verify:deploy` reports presence/mismatch without printing values.

## Credential matrix

| Credential | Consumer | Provisioning source | Required format | What verifier can prove | Present in this checkout / hosted environment | Browser safe? |
|---|---|---|---|---|---|---|
| `GATEWAY_INGEST_TOKEN` | Edge `edge-ingest`; web gateway config GET/events; Gateway `x-gateway-token` | Web server runtime; Supabase Edge Function secret; `gateway_secrets.h` macro `GATEWAY_INGEST_TOKEN_VALUE` | Same random value at all three runtime/device sources; at least 32 non-placeholder characters | Checks local runtime/header presence and exact match; checks hosted Edge secret name only, never its value | Runtime and ignored Gateway header are absent/placeholder in this checkout. Hosted Edge secret name exists; hosted value cannot be inspected or matched. | No. Server/device only. |
| `REMOTE_CONFIG_STATION_01_KEY` | Web config signing/validation; Gateway station-01 HMAC; Station 01 config receiver | Web server runtime; `gateway_secrets.h` macro `REMOTE_CONFIG_STATION_01_KEY_VALUE`; `station_01_config_secrets.h` macro `REMOTE_CONFIG_KEY_VALUE` | One unique random value across these three sources; at least 32 non-placeholder characters | Checks local runtime and both ignored headers for presence and exact match | Missing/placeholder in current checkout. No hosted web runtime value has been verified by this local check. | No. Server/device only. |
| `REMOTE_CONFIG_STATION_02_KEY` | Web config signing/validation; Gateway station-02 HMAC; Station 02 config receiver | Web server runtime; `gateway_secrets.h` macro `REMOTE_CONFIG_STATION_02_KEY_VALUE`; `station_02_config_secrets.h` macro `REMOTE_CONFIG_KEY_VALUE` | One unique random value across these three sources; at least 32 non-placeholder characters | Checks local runtime and both ignored headers for presence and exact match | Missing/placeholder in current checkout. No hosted web runtime value has been verified by this local check. | No. Server/device only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service client and Edge ingestion database access | Secret manager/runtime environment | Supabase service-role JWT or `sb_secret_` key; must grant service access | Checks presence and key kind, not its authority or deployed equality | Configured locally for read-only diagnostics; hosted value is not inspected here. | **Never.** A service key bypasses RLS. |
| `DATABASE_URL` / `DATABASE_POOLER_URL` | Server-side migration/deploy diagnostics | Secret manager/local ignored env file | Valid PostgreSQL connection URL, private network/credential | Checks presence and can connect to configured DB; does not establish that production users/devices are safe | Configured locally and database is reachable. Hosted runtime copy is not checked. | **Never.** |
| `SUPABASE_ANON_KEY` | Browser Supabase client under table RLS | Public app runtime (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and server env alias | Publishable key or legacy JWT with `anon` role | Checks key class/role, not the deployed RLS policy correctness | Configured locally. Hosted public value is not verified by this deploy check. | Yes, only with correct RLS and restricted grants. |
| Legacy `devices.device_secret` | No active consumer; retained schema field only | Existing database rows, originally populated by public seed fixtures | Must not be used as active auth; public seed placeholders must be removed/rotated operationally | Finds known repository placeholders by device ID without returning values | Four hosted rows currently contain repository placeholders (`GATEWAY_01`, `STATION_01`–`03`). | No. Do not promote it to an auth mechanism. |

## Provisioning and release checks

- Web runtime station keys are server-only. Do not use `NEXT_PUBLIC_` names.
- Set `GATEWAY_INGEST_TOKEN` as an Edge Function secret for `edge-ingest`.
  Supabase's secret inventory exposes the name, not the configured value.
- Create ignored firmware headers from the empty committed templates. Never
  check in the real header or use the synthetic keys in test fixtures.
- Gateway telemetry uses the gateway token; configuration uses the two
  station-specific HMAC keys. Telemetry acknowledgement is not a configuration
  acknowledgement. `APPLIED` remains station attestation only.
- `npm run test:deploy-credentials` tests missing/placeholder/mismatch checks
  and confirms diagnostics do not disclose supplied values. `npm run
  verify:deploy` is fail-closed if any required copy is absent, mismatched, or
  cannot be checked.

**Credential presence is not equivalent to credential match.** A successful
name inventory does not prove the hosted Edge value equals the value flashed
onto the gateway. No secret values are included in this document or verifier
output. A local comparison cannot prove what is physically flashed on a board.
