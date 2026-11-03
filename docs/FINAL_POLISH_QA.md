# Final polish verification — 6 October 2026

## Scope

Restrained Impeccable refinement of the existing product. Desktop composition and bento remain intact. Mobile gains a shared floating navigation dock, deliberate form/media layouts, aligned widths and supplied theme backgrounds. The report keeps the owner's previously requested continuous single-page form, including station selection, observation, description and evidence.

## Checks

- `npm run check -w @eco-sense/web`: passed.
- `npm run lint -w @eco-sense/web`: passed, no warnings/errors from lint. Next reports its existing next-lint deprecation notice.
- `npm run build -w @eco-sense/web`: passed, production build.
- `git diff --check`: passed.
- Focused Node tests: 59 passed, zero failed. Runtime validation, idempotent comparison, fail-closed gateway auth, no fabricated application state, public realtime projection, independent station updates, partial measurements, threshold semantics and evidence rules are covered. An existing mock was updated to support the repository's pagination method.

## Real browser checks

Headless Edge against the production localhost build at 390, 430, 768, 1280 and 1440 pixels:

| Route | Checked |
|---|---|
| `/` | Two-line Vietnamese hero, responsive scene, chapter/media widths, three-node image alignment |
| `/dashboard` | Rendered bento, chart/map containment, history layout, source captions, live subscription |
| `/report` | Continuous form, selected station, photo previews, audio preview, removal, evidence controls |
| `/admin/login` | Mobile dock, separate bad-password alert, real invalid and valid sign-in |
| `/admin` | Authenticated UI, responsive runtime forms, ingestion metadata, stored/unset states |

No page-level horizontal overflow was found on the 25 route/width combinations; no browser page errors were observed. Mobile dock targets measured 54px tall and the dock hides from 768px upward. Text content is 980px and media content 1160px at wide desktop widths, plus their shared gutters. All four supplied background scenes were visually inspected; portrait/landscape and light/dark switching were verified. Unauthorized admin navigation redirects to login.

Evidence QA uses local files without submitting a report: multiple photos display previews; a valid in-memory WAV displays audio controls; removal reduces the attachment count. File-type/size/bucket rules are also tested. Camera/microphone hardware recording and a full submitted upload were not exercised; existing capabilities were preserved.

## Realtime evidence boundary

The browser received an actual successful Supabase public-channel subscription acknowledgement. Isolated projected water and soil INSERT messages were then delivered **only to the test browser websocket**, resulting in visible water and soil value changes with zero page reloads. These fixtures never entered Supabase, ingestion endpoints or production history. No genuine new hardware event arrived during that brief observation window. Unit tests cover the mapping and timestamp/partial-packet behavior, and migration source checks cover both raw-table triggers. This verifies client update behavior and actual connection, not a newly witnessed physical station sample.

## Gateway / control evidence boundary

Local endpoint responses: absent token 401, incorrect token 401, valid gateway token 200, `Cache-Control: no-store, private`, zero actual stored config rows, `application_verified: false`, successful retrieval audit. No desired hardware configuration was inserted merely to demonstrate a save, and no device was commanded or flashed. Validating an HTTP read is not end-to-end hardware application.

See [REMOTE_CONTROL_AUDIT.md](REMOTE_CONTROL_AUDIT.md) for the parameter-by-parameter chain, source ownership, offline/rejection behavior, unavailable config ACK and hardware work required before enabling polling. Local endpoint hardening requires deployment to take effect remotely.

Browser screenshots and secret-bearing authenticated session state are held outside the repository in the local Codex temporary QA directory. Session state and environment credentials are not committed. This pass has not been pushed or deployed.

## Remote-control follow-up

The stored-intent-only observations above are historical. Remote configuration v1 is now implemented and software tested; see [REMOTE_CONFIGURATION_QA.md](REMOTE_CONFIGURATION_QA.md). Migration 034 was applied to the configured Supabase database on 7 October 2026. Hardware remains unverified and polling remains disabled. See [ADMIN_DATA_FLOW_AUDIT.md](ADMIN_DATA_FLOW_AUDIT.md) for the current full-system findings.
