# HORIZON — audit issue list

**Audit date:** 19 October 2026 · baseline `b591c02` + uncommitted working tree  
Status key: **FIXED** (changed + verified at the level stated) · **OPEN** (found, not changed) · **UNVERIFIED** (could not be tested here)  
Evidence key: **S** static reading · **U** unit/integration test executed · **P** platform documentation · **B** real browser (none this audit)

## Audit limits

Updated 20 October 2026 after network egress was opened. What is now real, and what still is not:

- **Real project scripts now run** in the cloud copy (`npm ci`, then): `npm run test -w @eco-sense/web` = **352/352 pass** (project `tsx` runner, including the firmware-host pretest and the 7 `remoteConfiguration` tests); `npm run check -w @eco-sense/web` (both `tsc` configs) clean; `npm run lint -w @eco-sense/web` clean; `npm run build -w @eco-sense/web` succeeds; `next start` serves the build; `npm run qa:public-browser` = **19/19** (Chromium, 390 and 1440 px). Environment note: the sandbox's proxy lists `registry.npmjs.org` in `no_proxy`, so npm needs `env -u no_proxy -u NO_PROXY` and `NODE_USE_ENV_PROXY=1`; this is a sandbox quirk, not a repo defect.
- **What the browser tests are.** The page and every client decision run for real. The `/api/public/reports`, signed-Storage and `/media` calls are **intercepted** in the report flows, so they prove browser behaviour given server answers, not Supabase acceptance. No Supabase credentials were configured for the server, so the dashboard ran in "no data" (real) and `?mode=demo` states only.
- **Not run:** a real report/upload against Supabase (creating rows in the project you named needs your explicit go-ahead; it may be production), authenticated Admin in a browser (no admin password was provided), PWA/offline, screen-reader testing, automated axe scan, other browsers.
- **Verified against Supabase (read-only, no writes):** an `OPTIONS` preflight for a Storage signed-upload `PUT` from `https://horizon.frogsleap.com.vn` returns `access-control-allow-origin: *` and allows `content-type, x-upsert, apikey, authorization`, so CORS does not block the direct upload. This does **not** show the bucket exists or that migration 026 is applied. The anon read of `observatory_live_readings` (the same call the public site makes) returned a live STATION_01 row stamped the same minute.

## P0 — breaks a core journey

### I-01 · Videos (and most multi-photo reports) cannot be uploaded in production — FIXED (code + tests), UNVERIFIED end-to-end
- **Symptom:** a reporter attaches a video, presses send, and either gets "could not send" or loses the whole report.
- **Root cause (S + P):** `report-form.tsx` posted every attachment inside one `multipart/form-data` request to `/api/public/reports`, a Vercel function. Vercel rejects function request bodies over **4.5 MB** before application code runs (`FUNCTION_PAYLOAD_TOO_LARGE`; vendor guidance: upload large files directly to storage). The product limit for video is 20 MB and for photos 8 MB each, so almost every real phone video, and any two full-resolution photos, exceeded the platform limit. The form also treated a non-JSON platform error page as a generic failure, so the reporter saw no reason and the typed text was kept only by luck. `vercel.json` and `docs/PRODUCTION_READINESS.md` confirm Vercel is the host.
- **Contributing cause (S):** MIME validation used `File.type` only. Browsers leave it empty for `.heic` and often for `.mov`, and Android pickers can report `application/octet-stream`; those valid files were refused as "unsupported". `accept` lists had MIME types only.
- **Contributing cause (S):** one XHR with a 120 s timeout carried every byte; on a weak 4G link a 20 MB file exceeds that.
- **Fix:** the report POST is now a small JSON request that *declares* the evidence. The server validates the declaration **before** writing the row, writes the report, and returns one signed Storage upload URL per file plus an HMAC upload ticket. The browser PUTs each file straight to Storage (XHR, real byte progress, 10-minute timeout), then calls `/api/public/reports/[id]/media` to **finalize**. Finalize lists the folder in Storage and writes a `report_media` row only for an object that exists with an allowed type and size; anything else is deleted and refused. Retry (`resign`) reuses the same report. Client validation reports a specific reason (type / size / empty / duplicate) and accepts extension-only files. `accept` includes extensions; previews use `playsInline`.
- **Truthfulness:** the success screen lists each file as *Đã lưu* or *Chưa tải lên*, and shows "n/total". A report saved without its video is shown as partial success with a retry button and is never labelled complete.
- **Evidence:** `reportEvidence.test.ts` (15) and `reportDirectUpload.integration.test.ts` (10) — executed, pass. The latter drives the real route handlers with a fake Supabase REST/Storage and asserts: no `report_media` row before the object exists; idempotent finalize; wrong-ticket / foreign-path / replay rejection; no overwrite of recorded evidence; invalid files rejected before the report row exists; report kept when signing fails.
- **Not proven:** that the real Storage service accepts the signed PUT from the production origin (CORS), that bucket `report-evidence` and migration 026 exist in production, and that the plan's global upload limit is ≥ 20 MB. See I-14.

### I-02 · Field Notes cards were not links — FIXED (S + build-level checks; not clicked in a browser)
- `PostCard` rendered an `<article>` with image, hover zoom and no anchor. The route `/posts/[slug]` existed and all six posts render (executed: every body renders, no unrendered Markdown tokens, path traversal returns null, each post has three related posts).
- **Fix:** each card is one `<Link href="/posts/{slug}">` (single tab stop, title is the accessible name, visible focus ring). Status labels ("draft") are now localised instead of showing raw enum values. The post page's status note uses the same dictionary.
- The carousel took only the five newest posts and the standalone list was retired with `/about`, so the oldest post had no entry point; the homepage now lists every note.
- **Reproduced on production (read-only DOM inspection, 19 Oct 2026):** `#ghi-chep` contains 5 `<article>` elements and 0 links; the page has 0 `a[href^="/posts/"]`; status shows raw `DRAFT`. `/report` file inputs accept MIME types only (`video/mp4,video/webm,video/quicktime`, no extensions). Production runs the pre-fix build.
- Browser-level proof of the fix is in `scripts/public-flows-browser-qa.cjs` (not run).

### I-03 · Admin CSV export always failed — FIXED (U)
- **Root cause (S, cross-checked against migrations 006/019/024/031):** the soil export selected `soil_ec` (column is `soil_ec_ms_cm`); the water export selected `air_temp_c` and `air_humidity_pct` (they are on `soil_readings`). PostgREST rejects the select, so both exports returned 502 → a raw JSON page in the middle of the console.
- **Also fixed:** `to` date excluded the whole last day (`lte 2026-10-19` = midnight UTC) — now an inclusive Vietnam-calendar day; malformed dates return a readable message; a failed export from the form redirects back to the console with an error instead of replacing it with JSON; dataset labels name the station.
- **Evidence:** `adminExportColumns.test.ts` parses the migrations and fails if an export column does not exist. Not run against a database.

### I-04 · Admin could never resolve a report — FIXED (S; mutation itself U)
- `resolveReport` and `mutateResolveReport` existed and are tested, but the report queue rendered only "mark viewed". Status therefore stopped at `reviewing`.
- **Fix:** "Đánh dấu đã xử lý" button; badges follow the real `status` (Mới / Đã xem / Đã xử lý); unread count uses the same definition; media items show a download/open link (iPhone `.mov` plays only in Safari), size formatted in MB, and an explicit message when a signed URL could not be created. **Not clicked in a browser** (needs an authenticated session).

## P1 — misleading or fragile

### I-05 · Double-submit could create duplicate reports — FIXED (S; browser script written)
State (`submitting`) was read from a closure, so two taps in one frame both passed the guard. A `useRef` latch now blocks the second call. `public-flows-browser-qa.cjs` has a double-click case.

### I-06 · Homepage STATION_01 card implied EC = salinity — FIXED (S)
Listed only "Độ mặn". `SENSOR_CAPABILITY_MATRIX.md` keeps level, EC, water temperature and salinity as separate fields. The card now lists all four.

### I-07 · Video embeds had no keyboard/screen-reader path and ignored reduced motion — FIXED (S)
The poster was `aria-hidden` with nothing focusable, so the film started only by scrolling past it. Now a real button ("Phát video: …"), no autoplay under `prefers-reduced-motion`, poster failure falls back to a plain panel, and a "Xem trên YouTube" link covers blocked embeds. Playback itself was not tested.

### I-08 · Service-role key read in a second module — FIXED (U)
First draft of the upload ticket read `SUPABASE_SERVICE_ROLE_KEY` directly. The repo's own `secretBoundary.test.ts` failed it. The key is now read only in `lib/supabase/service.ts`, which exports `deriveServiceSecret(label)`; the ticket uses an HMAC-derived key. Rotating the service key invalidates outstanding tickets.

### I-09 · Live-reading quality defaulted to "valid" with no fault evidence — FIXED (U)
- **Root cause:** `liveReadings.ts` used `fault_flags ?? 0`; a realtime packet with neither fault flags nor probe statuses became quality `valid`. `qualityFor` in `stationProfile.ts` also returned `"valid"` for a missing reading and for any non-water profile.
- **Fix:** one rule, `waterQuality()` / `soilQuality`: `error` on any positive fault evidence (`fault_flags>0`, probe `fault`); `valid` **only** when a numeric `fault_flags` was actually reported; `estimated` when a probe status is `unknown`; otherwise **`null` (no quality claim, chip hidden)**. `qualityFor(…, null)` is now `null`. A later packet without fault evidence clears a previous `valid` instead of inheriting it. Availability, quality, sensor health and severity remain separate axes; the measured values are still displayed.
- **Evidence:** `tests/dataIntegrity.test.ts` (9 tests, pass); `tests/stationDetailSoil.test.ts` expectation changed from `"valid"` to `null` for a missing soil reading (documented in the test). Rendering not checked.

### I-10 · Map marker at (0, 0) when a station snapshot is missing — FIXED (U)
- **Root cause:** `buildObservatory.ts` set `lat/lng` to `snapshot?.station.lat ?? 0`. The map itself already used `lib/geo.ts`, so no marker was drawn at 0,0 today, but the view model carried the fabricated coordinate.
- **Fix:** real stations take the surveyed `STATION_COORDS` (never from a database row); anything unknown is `null` (`lat/lng: number | null`); demo stations are `null`.
- **Evidence:** `tests/dataIntegrity.test.ts` builds the real view model with no Supabase configured and asserts no `0` coordinate; asserts demo stations are unplaced; asserts the surveyed table is in the Mekong delta.

### I-11 · Admin sign-in: lock-out and allowlist disclosure — FIXED (U for logic, S for the server action); not exercised in a browser
- **Lock-out:** the throttle was keyed by email only, so five wrong guesses from *anyone* locked the real administrator out for 15 minutes. Now keyed per caller+email (5/15 min), per caller across emails (20/15 min), and per email across all callers with a high ceiling (40/15 min) that only caps distributed guessing. Throttling is checked before credentials.
- **Disclosure:** a non-allowlisted email used to get a different message from a wrong password. The action now checks the allowlist and password together and answers `bad-password` ("Email hoặc mật khẩu … chưa đúng") for either. The `unauthorized` message remains only for an already-signed-in session whose email was later removed.
- **Evidence:** `loginRateLimit.test.ts` (4 new), `loginDisclosure.test.ts` (3, source-level because a server action cannot be invoked outside Next).
- **Still true:** the throttle is in-memory and per serverless instance (best-effort, as documented); logout only clears the cookie (stateless session, 12 h, allowlist re-checked on use); one shared password for all administrators.

## P2 — structure, documentation, debt

### I-12 · Admin is one ~740-line page with ten anchors — OPEN
The sidebar/anchor navigation exists and works by design (`OperationsNavigation`), but the page loads every panel's data on every request (8 queries + signed URLs for up to 20 reports). Splitting routes was deliberately not done. A cheaper first step is to cap signed-URL generation to unviewed reports.

### I-13 · Admin report queue limited to the latest 20 — FIXED (U for query parsing; UI S only)
`damage_logs` is now read a page at a time (20) with a status filter (Tất cả / Mới / Đã xem / Đã xử lý), prev/next links, a total count, and a **distinct error state**: a failed read used to render "Chưa có báo cáo nào" (an outage looked like an empty queue). Known gap: the "unread" count beside the queue is for the current page only.

### I-14 · Orphan Storage objects — OPEN
An object uploaded but never finalized (tab closed mid-way) remains in `report-evidence` with no `report_media` row. Harmless to the UI; needs a periodic cleanup of objects older than the ticket lifetime that have no row.

### I-15 · README migration count stale — OPEN (docs)
README says 27 migrations; the directory has 36 files (duplicate 024/025 prefixes are historical).

### I-16 · Working-tree line endings are mixed CRLF/LF — OPEN
204 text files are CRLF and several are mixed (e.g. `admin/page.tsx`, `reports/route.ts`). Files changed by this audit were written back in each file's majority style. A `.gitattributes` would stop future noise.

### I-17 · Leftover audit file inside `.git` — OPEN (cleanup)
`.git/claude-audit-src.tgz` (≈ 49 MB) was created while mirroring the repo into the cloud workspace and cannot be deleted through the remote tools. Delete it manually.

## New findings from the rendered build and live read (20 Oct)

- **I-18 (TRACED; fix written, NOT applied; two data questions OPEN) · Salinity provenance and the missing public EC/temperature.** Corrected on review: salinity is **not** reconstructed from EC in this system. Verified path (static reading of the repo plus read-only live checks):
  1. **Sensor register.** `trạm 1.ino` reads `REG_SALINITY_PPM = 0x0008` (CDAB float, Modbus function 3) in `readWaterEc()`, alongside EC 0x0000, temperature 0x0004 and TDS 0x0006.
  2. **Firmware.** `salinityPpt = salinityPpm / 1000` when the register read is valid. Only if that register read **fails** does the firmware fall back to `EC × 0.64` (see I-22). A stored 0 can therefore come from a register that really returned 0, or from the fallback applied to an EC of 0 (both give 0; the packet does not say which).
  3. **Packet.** `S1|seq|min|distance|water|ec_ms|temp|tds|sal_ppt|bat_v|bat_pct|CRC`; salinity is field 9, 3 decimals, `x` when not finite.
  4. **Gateway.** `simple_telemetry.h` maps the fields to `salinity_ppt`, `ec_ms_cm`, `temperature_c`; a missing EC raises a fault flag in the current code.
  5. **Ingestion.** `ingest.ts` validates ranges; `supabaseDb.ts` writes `salinity` (ppt) and, in the working tree, both `ec_ms_cm`/`temperature_c` **and** `water_ec_ms_cm`/`water_temp_c`.
  6. **Database / public view.** `environmental_readings.salinity` (migration 031: NULL means the probe did not report) → trigger 033 → `observatory_live_readings.measurements` → Observatory "‰".
  Semantics are consistent end to end: salinity is the sensor's own value, EC is a separate value, and nothing converts one to the other in software.
  **Live observation (read-only, 21 Oct):** STATION_01 rows arrive about every 2.5 min with a numeric salinity (≈0.061 ‰) and water level, `fault_flags 0`, probe "ok", but `water_ec_ms_cm`/`water_temp_c` NULL. The current gateway and ingest would not produce that combination (missing EC would be flagged), so the most likely cause is that the deployed ingest/gateway build predates the `ec_ms_cm`/`water_ec_ms_cm` mirroring. **Not confirmed**: needs admin SQL, e.g. `select timestamp, ec_ms_cm, water_ec_ms_cm, temperature_c, water_temp_c, salinity, salinity_ppm, tds_ppm, fault_flags from environmental_readings where station_id='STATION_01' order by timestamp desc limit 50`.
  **Fix written, not applied:** `035_mirror_water_ec_temperature.sql` + `waterColumnMirror.test.ts` (4 tests). Reviewed against the real schema: source and target columns have identical types (`numeric(8,3)` / `numeric(5,1)`, so no rounding or overflow); copy only when the target is NULL and the source is not; salinity untouched; no delete/drop; the 033 projection only moves forward in time (`excluded.timestamp >= existing`), so the backfill cannot regress the public row; the one heavy step is the backfill `UPDATE` over all matching rows (about 6.5k for STATION_01) and should be run in a quiet window or batched. Note two files share the `024_` prefix (`024_horizon_platform.sql`, `024_station_summary_ingest_fields.sql`); the order is alphabetical and works, but is fragile. Needs your approval before anything is applied.
- **I-23 (OPEN, evidence needed) · Salinity 0.000 in long runs.** 322 of the last 1,000 STATION_01 readings (about 2 days, long daytime runs) store salinity exactly 0 while flagged healthy. The packet does not say whether the 0 was a register value or the I-22 fallback applied to EC 0; both imply EC ≈ 0. Plausible causes (not distinguished yet): probe not immersed at low water, or a probe/register behaviour at very low conductivity. Raw EC/TDS/level for those rows are hidden from the public API, so this needs the admin query above. Until resolved, the public chart should not treat these as confirmed zero salinity.
- **I-22 (FIXED at source; host-tested; NOT compiled for ESP32, NOT flashed) · Firmware `EC × 0.64` salinity fallback.** Removed; a failed register read now sends `x` (NULL). `docs/FIRMWARE_I22_READINESS.md`; flashing needs approval (checklist F1-F3).
- **I-19 (FIXED, verified in dev build 21 Oct) · Placeholder art in public Field Notes.** All six post covers now use real project photographs; a browser check of `/`, a post page and `/observe` found no "PLACEHOLDER" text, no placeholder image sources and no broken images (demo-mode dev build, not production). The SVG placeholder files remain in `public/assets` but are unreferenced by posts.
- **I-20 (FIXED in code; unit-level only) · Empty weather cells** now print the "Chưa có dữ liệu" line under the dash, as the HORIZON cells do (`ContextValue` in `observatory-canvas.tsx`). Not re-screenshotted against production.
- **I-21 (CHANGED on request) · "Tín hiệu" box.** Gateway signal and battery (reported by no current firmware, so permanently empty) were replaced by **soil EC and soil temperature**. Colour/threshold: wired to the threshold registry (`soil_ec_bulk`, `soil_temp`; only `OPERATIONAL`/`SITE_VALIDATED` rows count). **No rows exist for either quantity** and `SCIENTIFIC_REFERENCES.md` says why (bulk EC is not ECe; no sourced probe-depth temperature alarm), so both read "chưa có ngưỡng" and the box stays neutral. Colour will appear as soon as thresholds are entered. Network "n/3 đang gửi dữ liệu" is kept as a caption. Rendered in demo and no-data states; not rendered with live data.

## Findings and fixes from the isolated local-staging pass (21 Oct 2026)

Environment: real Postgres 15 / PostgREST / Storage / Edge Runtime from repository migrations 001-036 (`docs/LOCAL_STAGING.md`). Production not contacted. Evidence level **E** = executed against that stack.

- **I-25 (FIXED, E) · Config-write stall: PostgREST loops forever on SQLSTATE 40001.** `store_remote_config` / `record_remote_config_event` signalled a stale revision with 40001. On PostgREST 12.2.3 that makes the call re-run in a loop *while holding the per-station advisory lock*; later writes queue behind it, the pool is exhausted (`PGRST003`) and the Admin stalls until PostgREST is restarted. Reproduced with one stale `p_expected_revision` over HTTP; a custom code returns at once. Fix: migration `036_revision_conflict_sqlstate.sql` (code `P0409`, otherwise identical) + web mapping accepts 40001 and P0409. After the fix: stale save returns immediately, Admin suite 32/32, no pile-up. Not verified: the PostgREST version on the Supabase cloud project (the fix is harmless either way). This replaces the earlier "not reproduced" note.
- **I-26 (FIXED, E) · Service worker cached authenticated `/admin` pages.** Default next-pwa rules cache every same-origin page (NetworkFirst, 24 h), so operator HTML/RSC stayed in the browser cache after sign-out and could hydrate stale (React #418 seen on `/admin` in the Admin E2E). `/admin/**` and `/api/**` are now NetworkOnly. Admin E2E B20 (no page errors) passes again.
- **I-27 (FIXED, E) · PWA service worker was never registered.** Generated but not registered under the App Router; then its install failed on a 404 precache entry. Explicit registration added; precache restricted to the app shell. Verified in a real browser: registered, controlling, visited pages and `/offline` render offline.
- **I-28 (FIXED, E) · Accessibility.** axe (28 page/locale/viewport combinations): 0 violations of any impact after fixing nested-interactive, aria-prohibited-attr, scrollable-region-focusable, `meta-viewport` (zoom was disabled via `maximumScale=1`, WCAG 1.4.4) and the `/offline` landmark.
- **I-29 (PARTLY FIXED) · EN home still showed Vietnamese.** Chapter text, workflow, application profiles and the Field Notes reading-time label now translate. Remaining Vietnamese on the EN home is place names (Cồn Hô, Vĩnh Long), the two Vietnamese-only field-note articles and their hero labels (disclosed editorial drafts) - a content decision, not code.
- **I-18 (FIXED in repo, E; NOT applied to production)** migration 035 verified on two isolated Postgres builds. **I-23 (OPEN)** root cause needs the read-only production SQL in `docs/READONLY_PRODUCTION_QUERIES.sql` (Q1-Q5): I cannot see production data from here.
- **Offline fallback (see I-30, now FIXED):** an unvisited route opened offline showed a failed load instead of `/offline`; the local stack has no Realtime service, so the public flows browser QA records a failed WebSocket (18/19; every functional check passes).

## Not audited (still)

Observatory rendering, map interaction, chart rendering, units and labels, time-range behaviour, stale/offline/partial/faulty display, demo-mode isolation in the browser, external-weather labelling, PWA/offline, language and theme toggles, mobile navigation, anchor scrolling, gallery loading, and the UX polish pass (Phase D). Source for these exists with a large test suite (`observatoryComposition`, `signalGroups`, `metricStatus`, `partialWaterReadings`, `telemetryReadback`), and the previous release-gate audit (`ADMIN_DATA_FLOW_AUDIT.md`) reports them passing — but this audit did not re-run them.


## Update 21 Oct (second pass)
- **I-18 trace confirmed from source.** Sensor register `REG_SALINITY_PPM` (0x0008) is read by `readWaterEc()`; ppm/1000 becomes `salinity_ppt` in the packet. Only when that register read fails does firmware fall back to EC×0.64 (I-22). Gateway, ingest, database and view carry the value unchanged; nothing converts EC to salinity downstream.
- **Migration 035 reviewed against the real schema** (types match, copy only into NULL, projection trigger only moves forward in time so a backfill cannot overwrite newer public rows). Not applied; needs approval.
- **Native checks after the latest changes:** `npm test` 356/356 pass (352 + 4 new), `tsc --noEmit` clean, `next lint` clean. Production build not re-run in this pass.
- **Repository reconciliation (cloud vs D:\horizon-project):** text files differ from the device only by CRLF line endings except 7 text files and 12 screenshots the cloud changed after the last sync and 3 files not yet delivered; no newer local work found on the device. Screenshot PNGs are compared by decoded pixels, not file bytes (the app re-encodes images on write).


## Update 21 Oct (third pass: UI refinement and closure)
- **I-30 (FIXED, E) · Offline fallback for unvisited routes; earlier offline evidence withdrawn.** Playwright `setOffline` does not affect service-worker fetches, so previous "offline verified" and "404 for unvisited routes" observations were artifacts. With the server really stopped, unvisited routes failed outright (`ERR_FAILED`). Fix: `apps/web/worker/index.js` (network-first navigations, cache `horizon-pages-v1`, only 200 non-redirected `text/html`, falls back to a cached copy then the precached `/offline`; excludes `/admin`, `/api`, non-GET). `scripts/staging/offline-sw.e2e.cjs` 9/9, including no `/admin`/`/api` entries in any cache.
- **I-31 (CHANGED, E) · Soil EC / soil temperature cards.** Now the same component as the weather cards (`MetricCell`); the long explanatory "soil signals" box is removed. No soil EC/temperature thresholds were invented; a metric without a registry status stays neutral and never reads as safe.
- **I-32 (ADDED, E) · Dev-only soil fixture.** `HORIZON_DEV_SOIL_FIXTURE=1`, default off, disabled when `NODE_ENV=production` or `VERCEL`/`VERCEL_ENV` is set, STATION_02 only, never overrides real values, banner `data-dev-fixture-banner`, provenance "demo". Tests: `devSoilFixture.test.ts` 8/8. Real data takes over automatically when it arrives.
- **I-33 (ADDED, E) · Theme and language preference.** Light/Dark/System radiogroup; language negotiation (cookie > Accept-Language > `vi`). `theme-lang.e2e.cjs` 21/21.
- **I-34 (FIXED, E) · Hero text colour** and **a11y:** Leaflet attribution links relied on colour alone (axe `link-in-text-block`, intermittent); now underlined. Dashboard axe 0.
- **I-23 remains OPEN** pending the read-only production SQL (`docs/READONLY_PRODUCTION_QUERIES.sql`); no historical salinity is rewritten. Migrations 035/036 remain unapplied.
