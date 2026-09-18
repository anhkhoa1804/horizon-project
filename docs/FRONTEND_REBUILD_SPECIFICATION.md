# HORIZON — Frontend Rebuild Specification

**STATUS: PRE-IMPLEMENTATION / AUDITED — PHASE 0.5 COMPLETE**

Single source of truth for the HORIZON frontend rebuild. Supersedes
`REDESIGN_SPECIFICATION.md` for all forward-looking frontend work (§0.1).
Every claim is traced to source; unverifiable claims are marked
**ASSUMPTION**. This revision closes the two items Phase 0 left open
(Magnus reference, station identity) with independent source verification.

Audit baseline: commit `9a1da0d` ("feat: finalize horizon ui redesign"),
`D:\horizon-project` working tree clean. Reference read (not modified):
`D:\pi\web` (Magnus portfolio — a workspace inside `D:\pi`, not a
standalone `D:\magnus-portfolio`).

---

## 0. Document status and supersession

`docs/REDESIGN_SPECIFICATION.md` §24 is **superseded** for the rebuild —
retained as historical record only. `docs/` holds 34 markdown files; this
document absorbs the design-decision role so no new files are needed.
Still independently authoritative: `docs/ARCHITECTURE.md` (topology),
`docs/SENSOR_CAPABILITY_MATRIX.md` (sensor→display traceability, one
correction below), `docs/TELEMETRY_STATE_MODEL.md` (freshness/quality),
`docs/FIRMWARE_BACKEND_CONTRACT.md` (wire contract).

**Correction to `SENSOR_CAPABILITY_MATRIX.md`:** it says no repository
method queries `soil_readings`. Stale — `ReadingRepository
.getLatestSoilReadingByStation()` exists
(`readingRepository.ts:122-138`), tested in
`apps/web/tests/soilReadingRepository.test.ts`.

---

## 1. Magnus reference findings

`D:\pi` is a monorepo (`workspaces: ["web"]`); the actual site is
`D:\pi\web`, Next.js 15 + React 19 + Tailwind 3 + **Framer Motion 12**.
Read in full: `package.json`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/components/home/HomeSections.tsx` (contains both `HeroSection` and
`BentoSection` — not separate files), `HomeCarousels.tsx`, `site/Header.tsx`,
`globals.css`, one full `content/garden/*.mdx` post.

| Pattern | Evidence | Classify |
|---|---|---|
| Scroll-linked parallax hero (`useScroll`+`useTransform`, text/image move at different rates while scrolling) | `HomeSections.tsx:12-20` | **DO NOT ADAPT** — decorative, no data meaning; costs scroll perf on low-end mobile |
| Infinite ambient float on hero portrait (`animate={{y:[0,-14,0]}}`, 5s loop, forever) | `HomeSections.tsx:41-47` | **DO NOT ADAPT** — pure decoration, runs even when tab is idle |
| `whileInView` entrance (fade+rise, `once: true`) | `HomeSections.tsx:85-89`, `HomeCarousels.tsx:66-69` | **ALREADY EXISTS** — HORIZON's `.animate-entrance` does this in plain CSS, no runtime needed |
| Bento grid, **personal life-status widgets**: weather, Spotify now-playing, horoscope, word-of-the-day, coding stats, random Unsplash photo | `page.tsx:76-87`, `HomeSections.tsx:56-119` | **DO NOT ADAPT** — the content itself is personal-portfolio-specific; a 3-station pilot has nothing to fill 9 heterogeneous tiles with (confirms Phase 0's bento rejection independently) |
| Sticky-release scroll pin (180vh wrapper, `sticky top-20` inner) | `HomeSections.tsx:80-82` | **DO NOT ADAPT** — scrollytelling trick for a content-rich personal page; adds nothing to an instrument page |
| Pastel bento tint system (`bento-orange`/`bento-blue`, full HSL token override per card) | `globals.css:121-149` | **DO NOT ADAPT** — directly conflicts with HORIZON's "brand color ≠ status color" rule; these cards *redefine* `--fg`/`--border` per tile, which is the opposite of a disciplined token system |
| Hover shine sweep (skewed gradient sliding across card on `:hover`) | `globals.css:85-103` | **ADAPT LATER, selectively** — cheap, tasteful, class-2 (interaction-driven); reasonable on real interactive cards (station list rows), not on data displays |
| Dot-grid body background, every page | `globals.css:53-56` | **DO NOT ADAPT** — decorative texture with no product meaning; HORIZON's `f7f6f1` flat field is the more disciplined choice |
| Dark-mode ambient purple/cyan glow blobs | `globals.css:59-65` | **DO NOT ADAPT** — exactly the class-4 decoration Phase 0 rejected, now confirmed by source |
| `.glass-panel` utility (`bg-card/60 backdrop-blur-xl`) | `globals.css:165-167` | **DO NOT ADAPT** — unused evidence of restraint even in Magnus; grep shows minimal call sites. HORIZON has stronger reasons to avoid it (map/data legibility) |
| Active-nav underline as a hand-drawn SVG squiggle | `Header.tsx:46-50` | **DO NOT ADAPT** — cute for a personal brand, wrong register for an instrument; HORIZON's existing fade-in wash already solves this more calmly |
| Horizontal snap-scroll carousel for content collections (`snap-x snap-mandatory`) | `HomeCarousels.tsx:78-82` | **ADAPT LATER** — legitimate pattern *if* HORIZON ever has a station gallery or multi-report collection; not applicable to 3 stations today (§6.5) |
| MDX + frontmatter editorial content pipeline | `content/garden/*.mdx`, `lib/mdx.tsx` | **ADAPT LATER** — the mechanism is sound for a future field-notes page; there is no content to run through it yet (Phase 0 §6.5 DEFER stands) |
| `max-w-7xl` container cap | `globals.css:74-76` | **ALREADY EXISTS** — Magnus doesn't solve the wide-viewport problem either; it compensates with `min-h-screen` sections and full-viewport-height scroll beats, not width. Confirms §12's own approach was necessary, not available off-the-shelf from this reference |

**Framer Motion decision, now source-confirmed rather than inferred:**
every Magnus animation that uses Framer Motion in ways HORIZON could use
is either (a) already achievable in HORIZON's existing CSS layer
(`whileInView` entrance) or (b) explicitly rejected above as decorative
(parallax, infinite float, scroll pin). **Framer Motion adds no capability
HORIZON's approved motion vocabulary needs.** Do not adopt it.

**Net verdict:** Magnus is a strong personal-portfolio site with the exact
qualities that make it wrong for HORIZON directly — high visual density,
personal-life widgets, decoration-forward motion, dark-first. Its
genuinely transferable lessons are structural, not visual: `whileInView`-
style once-only entrance (already have it), a horizontal carousel
mechanism (defer), an MDX content pipeline (defer), and a restrained hover
micro-interaction (adopt selectively, later).

---

## 2. Current HORIZON frontend verdict

Unchanged from Phase 0, re-confirmed against the same clean baseline.

| Route | Purpose | Data deps | Boundary | Auth | Verdict |
|---|---|---|---|---|---|
| `/` | Marketing entry | `getDashboardMetrics`, `getSnapshots`, `getDefaultSalinityThreshold` | Server + `<Suspense>`; map client | Public | REBUILD visual, KEEP wiring |
| `/dashboard` | Network overview | metrics, snapshots, alerts×4, `getDailyComparison`, `getTrend24h` | Server; charts/map client | Public | REBUILD — heaviest page (231 kB) |
| `/s/[stationId]` | Station instrument | `getById`, `getLatestByStation`, `getLatestHealthByStation`, `getTrend24h`, `getDefaultSalinityThreshold`, `getLatestSoilReadingByStation` | Server; chart client | Public | KEEP logic, REBUILD shell |
| `/report` | Field report submission | `POST /api/public/reports` | Client form | Public | KEEP behavior verbatim |
| `/about` | Project story | `getSnapshots` (map only) | Server | Public | REBUILD — mostly static |
| `/admin/login` | Auth entry | server action `loginAdmin` | Server action | Public | KEEP |
| `/admin` | Ops console | service-role reads, 4 server actions | Server | Admin | KEEP — no marketing treatment |
| `/offline`, `/not-found` | PWA/404 | none | Static | Public | KEEP |

Dead/unreachable UI (unchanged, still verified true): `soilEc` series in
`DailyComparisonChart` (`readingRepository.ts:284-294` never writes it),
`deliveryRate` series in `stationProfile.ts:66` (no backing column
anywhere).

---

## 3. Station identity — RESOLVED (was Phase 0's R-1 blocker)

**Independently re-verified from firmware, not carried forward from the
prior report.**

### 3.1 The physical topology (verified at the firmware level)

`firmware/esp32-node/platformio.ini` defines exactly three build
environments:

```
[env:station1]   → STATION_01, water sensor
[env:station2]   → STATION_02, soil sensor
[env:gateway]    → GATEWAY_01, relay device
```

No `env:station3`. **There is no third sensor node.**

### 3.2 What STATION_03 actually is — traced through the exact call chain

1. `infra/supabase/seed/pilot_seed.sql:19-22` — the `devices` table has
   **two separate rows**: `GATEWAY_01` (`station_id: null, kind: 'gateway'`)
   and `STATION_03` (`station_id: 'STATION_03', kind: 'station'`).
2. `gateway.ino:922` and `:948` — **every** signed ingest request the
   gateway sends (water-relay and soil-relay paths both) calls
   `httpPostSigned(GATEWAY_ID, ...)` where `GATEWAY_ID = "GATEWAY_01"`
   (`gateway.ino:58`). **The `STATION_03` device credential is never used
   to authenticate anything** — it is a seed-only, unexercised row.
3. `gateway.ino:782,795` — `parseAndForwardConfigs()` polls
   `/api/public/gateway/configs`, which returns rows for
   `STATION_01`/`02`/`03`. For `STATION_01`/`02` it relays the interval
   config over LoRa to the physical stations
   (`sendConfigToStation`). **For `STATION_03` specifically, it calls
   `applyGatewayConfig()` instead — configuring the gateway's own
   poll/sleep interval.**

### 3.3 Definitive answer

**None of the brief's four options (A/B/C/D) fits exactly — precision
matters more than forcing a fit:**

`STATION_03` is a **deliberate identity reuse**, not a naming accident and
not a second physical device. It is the *same physical entity* as
`GATEWAY_01` (the one gateway hardware unit), addressed under a different
ID in two different systems for two different, both-intentional reasons:

- In the `stations`/map/public-UI system, `STATION_03` ("Trạm 3 -
  Gateway") is the gateway's **public map touchpoint** — so a visitor sees
  three cards/pins ("Trạm 1 – nước", "Trạm 2 – đất", "Gateway – gửi tin"),
  matching the real 3-node story, not a phantom 4th sensor.
- In the `device_runtime_configs` system, `STATION_03` is a **configuration
  address** — it lets the existing "per-station interval" admin UI also
  configure the gateway itself, without separate plumbing.

Confirmed independently: `docs/ARCHITECTURE.md:26-48` already documents
this and states it is correct/intentional — this audit reached the same
conclusion from firmware source before reading that doc, so the two now
corroborate rather than one assuming the other.

### 3.4 STATION_04 / STATION_05

`services/edge-ingestion/scripts/simulator.ts:16` and `pilot_seed.sql:6-7`
are the only sources — a 5-station **load-test/seed fixture list** ("Brackish
Edge", "Mangrove Spur"). No firmware target, no admin config, no doc claims
these are real. They are **currently visible in the public UI only because
`StationRepository.getAll()` applies no ID filter for public/admin scope**
(`stationRepository.ts:18-26`, confirmed: `applyStationIdScope` returns
`null` for unscoped roles → no `.in()` clause → all 5 rows returned). This
is what makes the dashboard say "4/5 active" today.

### 3.5 Final identity matrix

| Physical node | DB `stations` row(s) | firmware env | `devices` credential actually used | frontend identity | kind | operational |
|---|---|---|---|---|---|---|
| Water sensor | STATION_01 | `env:station1` | STATION_01 | Trạm 1 – Gần sông | water | Sensor real; ingest structurally blocked (§4) |
| Soil sensor | STATION_02 | `env:station2` | STATION_02 | Trạm 2 – Dữ liệu đất | soil | Sensor real; no rows received yet |
| Gateway (relay) | STATION_03 (public alias) | `env:gateway` | **GATEWAY_01** (STATION_03 credential unused) | Trạm 3 – Gateway | gateway | Relays for the other two; itself unmonitored (§2.4 of Phase 0) |
| — (fixture) | STATION_04 "Brackish Edge" | none | STATION_04 (seed-only) | none | — | **Not a real node** — leaking into public UI |
| — (fixture) | STATION_05 "Mangrove Spur" | none | STATION_05 (seed-only) | none | — | **Not a real node** — leaking into public UI |

### 3.6 Recommended resolution — Option A, no schema change

**Adopt Option A: curated frontend allowlist.** Concretely: every public
read path that lists stations (`getSnapshots`, dashboard, home map) must
filter to `["STATION_01","STATION_02","STATION_03"]` before rendering —
the exact same array the admin console already hardcodes as
`managedStationIds` (`app/admin/page.tsx:27`). This is not a new pattern;
it is applying an existing, working precedent to one more call site.

Rejected: **Option B** (`stations.kind` migration) — real value (removes
the frontend `stationProfile.ts` hardcoding), but is a schema change and
therefore requires your explicit sign-off before this audit can authorize
it. Not required to start the rebuild.

**This resolves Phase 0's Gate item 11.** The rebuild can start without
any backend change: filter at the frontend boundary, ship it, revisit a
`kind` column later as a genuine improvement, not a blocker.

---

## 4. Telemetry storage verification (independently re-traced)

Previous report's claim re-verified hop-by-hop, exact lines:

| # | Hop | File:line | Result |
|---|---|---|---|
| 1 | `readWaterEc()` reads the ES-EC-WT-01 path and returns EC, temperature, TDS and salinity | `trạm 1.ino` | Implemented; field calibration is a separate requirement |
| 2 | `collectReading()` preserves the independent water quantities and status | `trạm 1.ino` | Confirmed in current source |
| 3 | Gateway maps that string | `gateway.ino:965` | Confirmed |
| 4 | `mapSensorStatus()` — not "ok"/"warn"/empty → falls through to `"fault"` | `gateway.ino:375-380` | Confirmed |
| 5 | `anyFault = ecStatus=="fault" \|\| ...` → `fault_flags = 1` | `gateway.ino:973-974` | Confirmed |
| 6 | Backend `isFaulty()`: for non-soil payloads, `fault_flags > 0` **or** `ec_probe === "fault"` → faulty | `ingest.ts:58-71` | Confirmed |
| 7 | Faulty → returns `SENSOR_FAULT` **before** any `insertEnvironmental` call — row never written | `ingest.ts:250-260` | Confirmed |
| 8 | `SENSOR_FAULT` → HTTP 422 | `httpHandler.ts:15` | Confirmed |

**Verdict, per node, independently derived:**

- **STATION_01 (water): CURRENTLY BLOCKED.** Every real reading is
  rejected whole — not because water level is broken (the A02YYUW
  ultrasonic path is real and checksum-verified), but because it's bundled
  with the permanently-faulted EC status in one all-or-nothing payload.
- **STATION_02 (soil): CAN STORE PARTIAL DATA, structurally different from
  water.** New finding this pass, not in the prior report:
  `isFaulty()` **explicitly exempts soil** — `if (readingKind(payload) ===
  "soil") return false;` (`ingest.ts:62-64`). Soil readings are never
  whole-row-rejected; each of the six sensors independently reports `null`
  on its own fault. Station 2's real gap is that **no real hardware
  payload has been received yet** (only `mock_ingest.ts`/`simulator.ts`
  synthetic data exists in the DB), not a validation block.
- **GATEWAY_01 / STATION_03 (health/connectivity): NOT IMPLEMENTED.**
  `battery_voltage`/`signal_strength_dbm` are structurally null for
  relayed stations by design (§2.4, Phase 0) — a gateway cannot measure a
  relayed station's battery, and the gateway does not report its own.

---

## 5. Backend/frontend capability matrix

Unchanged from Phase 0, re-confirmed. **A** = real backend data, **B** =
verified metadata, **C** = static editorial, **D** = unsupported.

| Capability | Support | Evidence | Class | Status |
|---|---|---|---|---|
| Latest salinity / water level | `getLatestByStation` | `readingRepository.ts:104` | A | SUPPORTED *(simulator-populated only — §4)* |
| Soil moisture/EC/pH/temp/humidity | `getLatestSoilReadingByStation` | `readingRepository.ts:122` | A | SUPPORTED *(no rows yet — §4)* |
| Air temperature/humidity | same, soil station only | `types/index.ts:28-42` | A | SUPPORTED, station-scoped |
| Battery / signal | `getLatestHealthByStation` | `readingRepository.ts:140` | A | PARTIALLY — structurally null for relayed stations |
| Station health (combined) | no combined concept exists | — | D | NOT SUPPORTED as a single metric |
| Alerts (7-day) | `AlertRepository` | `alertRepository.ts:20-53` | A | SUPPORTED |
| Thresholds | `getDefaultSalinityThreshold` | `readingRepository.ts:334` | A | SUPPORTED, **`crop_thresholds` unseeded** — returns null today, verified: no `insert into crop_thresholds` anywhere in `infra/supabase/migrations/*.sql` |
| 24h trend | `getTrend24h` | `readingRepository.ts:238` | A | SUPPORTED, salinity+water_level only |
| 7-day daily comparison | `getDailyComparison` | `readingRepository.ts:261` | A | SUPPORTED — `soilEc` column always null |
| Historical trend beyond 7d | no API | — | D | NOT SUPPORTED |
| CSV / JSON export | none | — | D | NOT SUPPORTED |
| Public REST API | none beyond the 3 routes audited | — | D | NOT SUPPORTED |
| Realtime / websocket | ISR only, `revalidate = 60` | `page.tsx:17` | D | NOT SUPPORTED |
| Publications / journal / blog | no CMS | — | D | FUTURE |
| Gallery | no storage bucket wired | — | D | FUTURE |
| Maintenance logs | no table | — | D | NOT SUPPORTED |
| Remote reboot / OTA control from frontend | firmware has an OTA *catalog* concept server-side (edge-ingestion tests reference `otaCatalog`) but **no frontend surface exists** | `services/edge-ingestion/tests/contract.test.ts:224` | D | NOT SUPPORTED in frontend; partially exists backend-side |
| Calibration controls | none | — | D | NOT SUPPORTED |
| Report submission | `POST /api/public/reports` | route.ts | A | SUPPORTED |
| Gateway device configs | `GET /api/public/gateway/configs` | route.ts | A | SUPPORTED (device-facing, not end-user) |

---

## 6. Digital Observatory spec — critique

Unchanged conclusions from Phase 0, now reinforced by real Magnus evidence
rather than assumption.

**Keep:** data-generates-visuals, absolute honesty, instrument-over-cards,
silent nav, spatial/full-bleed composition where earned, motion tied to
real state.

**Reject, with Magnus now as corroborating (not hypothetical) evidence:**

- **Dark-first** — collides with the light CartoDB map, the warm
  illustrative logo, and the status-color system. Magnus's own dark mode
  *adds* ambient glow blobs specifically because a flat dark field looks
  empty (`globals.css:59-65`) — that's a tell, not an endorsement.
- **Bento everywhere** — Magnus's bento only works because it has 9
  heterogeneous personal data sources to fill it. HORIZON has 3 stations
  and several structurally-empty fields. A bento of empty tiles reads as
  broken, not minimal.
- **Glassmorphism, gradients, glow, parallax, cursor effects** — all
  present in Magnus, all class-4 decorative, all rejected on the same
  ground: no data or interaction meaning, and now confirmed to cost real
  runtime weight (Framer Motion) for effects HORIZON's CSS layer already
  covers where they're justified.
- **River-flow animation** — no flow sensor exists. Motion asserting a
  measurement that doesn't exist is a data-honesty violation, not a taste
  call.
- **Dense telemetry canvas / terminal aesthetic everywhere** — appropriate
  for *one* register (§7), wrong as the whole product's default.

**What makes HORIZON distinctive — not "black + green + maps":** a warm,
light, real place (not a rendered dark void), rendered through real
geography with markers that only pulse when a reading is genuinely
seconds old, oversized measurements that always carry their own
provenance next to them, and exactly one river-line motif used sparingly
enough to still mean something. Remove all text and logo and this is what
should remain recognizable.

---

## 7. Final visual direction — three registers, not one theme

**Recommendation: adopt the 3-register model over a single dark theme.**
A single global theme forces the same visual voice onto marketing prose,
live measurements, and admin data-entry — three genuinely different jobs.

| Register | Pages | Character | Base |
|---|---|---|---|
| **Public / Story** | `/`, `/about` | Editorial, spacious, human, real geography | Light, warm neutral (`#f7f6f1` family) |
| **Monitoring** | `/dashboard`, `/s/[id]`, `/report` | Precise, data-dense, instrument-like | Light base retained — see §6, dark rejected; density comes from typography/rules, not a dark surface |
| **Admin** | `/admin`, `/admin/login` | Operational, compact, zero brand decoration | Light, neutral, no logo in the working console (already true) |

All three share one token system and one type scale — the register changes
density and composition, never the color language. This is a refinement
of the existing shell/status/brand separation already built, not a new
system.

---

## 8. Motion constitution

Classes: **1** data-driven, **2** interaction-driven, **3** storytelling,
**4** decorative (reject).

| Effect | Class | Verdict | Note |
|---|---|---|---|
| Station pulse | 1 | KEEP | already gated on `freshness === "live"` |
| Map interaction (hover/click) | 2 | KEEP | already real |
| Chart reveal (≤400ms, once) | 1 | KEEP | |
| Hero entrance (once) | 3 | KEEP | CSS-only, no Framer Motion needed |
| Section reveal (scroll-triggered, once) | 3 | ADOPT selectively | one per page max; CSS `@starting-style`/IntersectionObserver, not a motion library |
| Scroll-linked movement (parallax-style) | 4 | **REJECT** | Magnus evidence: decorative, costs mobile scroll perf |
| Parallax | 4 | **REJECT** | same |
| River animation | 4 | **REJECT** | no flow sensor — asserts fake data |
| Threshold-crossing emphasis | 1 | ADOPT *only once `crop_thresholds` is seeded* | currently null (§5) |
| Nav transition | 2 | KEEP | built |
| Hover glow / shine sweep | 2/4 borderline | ADOPT LATER, restrained | fine on interactive rows, not on data |
| Ambient glow | 4 | **REJECT** | |
| Grain | 4 | **REJECT** | |
| Glass blur | 4 | **REJECT** | |

**Hard rule, restated with Magnus-specific examples now attached:** no
flow sensor → no simulated river flow. No live station → no pulse (already
enforced — confirmed 0 pulses render in the current seed data). No
historical data → an honest empty chart frame, never a smoothed fake
curve.

---

## 9. Empty / data-state constitution

**Do not invent a new flat enum.** The existing two-axis model is correct
and must be preserved:

- **Freshness** (`status-indicator.tsx:24`): `live · recent · stale ·
  offline · never_connected · unavailable`
- **Quality**: `valid · estimated · error` — orthogonal; a station can be
  `offline` and `valid` simultaneously (last known good reading)
- **`stations.status`** (admin-set, separate): `active · inactive ·
  maintenance`

| Condition | Typography | Color | Animation | Chart | Map marker | CTA |
|---|---|---|---|---|---|---|
| Fresh, real value | oversized, full weight | full foreground | draw-in once | live | pulsing, status-colored | primary |
| Real value, stale/offline | full size, "Giá trị gần nhất" prefix, status directly beneath | de-emphasized foreground, **never red** for a valid stale value | none | static, honest gap | static colored | secondary |
| No value ever | moderate heading, one explanatory sentence, dashed container | muted | none | honest empty message | neutral | "learn more" |
| No coordinates | — | — | — | — | dashed placeholder, never a fake pin | — |
| Supabase unconfigured | explicit notice | — | — | hidden | hidden | — |

This is the exact model R22 already shipped for `/s/STATION_01` (stale)
and `/s/STATION_02` (no data) — the rebuild extends it, doesn't replace it.

---

## 10. Final sitemap

**Recommendation: keep current routes.** Renaming costs real continuity
(QR codes plausibly printed for field use point at `/s/STATION_01`) for a
naming preference, not a capability gain.

```
/                      Home
/dashboard             Network overview
/s/[stationId]         Station instrument
/report                Submit a field report (submission only — §5, damage_logs is service-role-only, no public archive)
/about                 The place & the project
/admin, /admin/login   Operations console
/offline               PWA fallback
```

Rejected: `/monitoring`, `/monitoring/[stationId]`, `/reports` (plural —
implies a browsable archive the backend cannot serve publicly), `/gallery`,
`/journal`.

---

## 11. Experience architecture

The proposed `observatory/ telemetry/ story/ navigation/ ui/` taxonomy is
premature — folders should follow real call-site count, not domain-name
aesthetics. Rule: a component earns a shared folder on its **third** real
call site.

| Primitive | Call sites today | Verdict |
|---|---|---|
| `MeasurementValue` | station hero, dashboard metrics | KEEP — already `ui/metric.tsx`, extend it |
| `DataStateEmpty` | station hero, chart, map, alerts | KEEP — already `ui/empty-state.tsx`, extend it |
| `StationPulseMarker` | map only | PAGE-LOCAL — already in `station-network-map.tsx` |
| `ThresholdGauge` | salinity chart only | PAGE-LOCAL |
| `HardwareHealthBar` | 0 sites with real data | REJECT |
| `LiveSparkline` | 0 sites — no continuous feed | REJECT |
| `TelemetryCanvas` | 0 sites, unclear responsibility | REJECT |
| `RiverSystemMap` | 1 site; `StationNetworkMap` already is this | REJECT — rename-only churn |
| `FieldworkJournal` | 0 sites, no content | DEFER (§1, §6.5 of Phase 0) |
| `SpatialPhotoGrid` | 0 sites, no assets | DEFER |
| `RiverFlowStory` | 0 sites, no flow data | REJECT (§6) |
| `StationSwitcher` | 3 stations | PAGE-LOCAL — a 3-item list needs no abstraction |
| `SilentHeader` | 1 shell | KEEP as existing `PublicShell` |

---

## 12. Desktop / wide-screen layout rules

Verified problem: `main` capped at `max-w-7xl` (1280px); at 1920px that's
328px dead margin per side, confirmed in the running app.

- **Reading column:** `max-w-[68ch]` — prose never widens with viewport.
- **Content grid:** `max-w-7xl` to 1536px; `max-w-[1440px]` above. Do not
  scale indefinitely — Magnus doesn't either (§1), and unbounded width
  hurts scanability more than it helps density.
- **Full-bleed layers:** `w-screen` + `left-1/2 -translate-x-1/2`,
  permitted for at most: the closing CTA band, one telemetry band, the
  dashboard map. **Maximum one full-bleed element per viewport height.**
- **Map:** full-bleed on `/dashboard`; contained on `/` and `/about`.
- **2560px+:** cap the grid, let full-bleed layers extend, center. No
  extra columns.
- **Monitoring register stays capped even wider** — an operator scanning
  a 2560px table loses more to eye travel than density gains back.

---

## 13. V1 capability scope

**This is the most load-bearing section — it is what stops the rebuild
from becoming a mock product full of unshippable features.**

### A. MUST SHIP IN FRONTEND V1
- Curated 3-station display (Option A allowlist, §3.6)
- Dominant-metric station hierarchy (already built, R17-R22 — carry forward)
- Stale-value provenance treatment (already built, R22 fix 4 — carry forward)
- Calm no-data state (already built, R22 fix 3 — carry forward)
- Real map, real coordinates, honest empty/no-coordinates state
- Report submission, unchanged behavior
- Admin console, unchanged behavior, no visual rework beyond §7's register
- 3-register visual system (§7)
- Full-bleed layout rules solving the 1920/2560 problem (§12)

### B. GOOD TO SHIP IF FRONTEND-ONLY
- Threshold visualization *once* `crop_thresholds` is seeded (frontend-only if someone else seeds the table; do not seed it yourself without sign-off — it's a data change, not code)
- Restrained hover shine on interactive list rows (§1, adopt-later item promoted)
- One `whileInView`-style section reveal per marketing page, CSS-only

### C. BLOCKED BY BACKEND/HARDWARE
- Any physical/site-validation claim for STATION_01 water/salinity until calibration evidence exists
- Station health (battery/signal) as a real metric — structurally null for relayed stations by design
- Historical range beyond 7 days
- CSV/JSON export, public REST API, realtime/websocket
- Gateway delivery-rate/uptime metric — never implemented at any layer

### D. FUTURE (do not design containers for these yet)
- Fieldwork journal / MDX content
- Photo gallery
- Publications/reports archive
- Remote OTA/reboot frontend surface
- `stations.kind` schema migration (Option B, §3.6)

---

## 14. Content audit

| Content block | Verdict | Why |
|---|---|---|
| Hero copy (`/`, `/about`) | KEEP | Already specific, not generic — describes real place/purpose |
| "Cồn Hô, Vĩnh Long" location badge | KEEP | Correct current geography (§15) |
| Homepage salinity threshold numbers | **NEEDS FACTUAL SOURCE** | Falls back to hardcoded 1.2/1.8 when `crop_thresholds` is empty (§5) — must not present as live/sourced until seeded |
| "Chưa có dữ liệu" empty states | KEEP verbatim | This is the product's honesty backbone |
| Any future "X/X stations live" phrasing | **REMOVE if it ever appears** | Contradicted by real topology unless exactly 3 curated stations are counted (§3) |
| Station kind labels (Trạm 1/2/Gateway) | KEEP | Now confirmed correct against firmware, not just convention |
| `deliveryRate`/`soilEc` labels in UI | REMOVE | Dead fields, §2 |
| Any statistic not traceable to §5's table | **REMOVE / NEEDS FACTUAL SOURCE** | Non-negotiable per §16C-D of Phase 0 |

No replacement marketing copy is written here, per instruction — this is
classification only.

---

## 15. Geography / naming

Unchanged, already correctly shipped (R18/R20 of the prior redesign
phases): HORIZON = product, Cồn Hô = place/context, current province =
**Vĩnh Long**, confirmed live in `apps/web/app/page.tsx` and consistent
across `README.md`/`docs/ARCHITECTURE.md`. No sub-provincial detail
invented anywhere. No action needed this phase.

---

## 16. Keep / Rebuild / Delete / Defer file map

**KEEP (functional core):** `lib/repositories/*`, `lib/publicRead.ts`,
`lib/auth/*`, `lib/supabase/*`, `lib/reports/*`, `types/index.ts`,
`app/api/**`, `middleware.ts`, `components/ui/status-indicator.tsx`,
`components/auth/*`, `app/admin/**`, all of `apps/web/tests/`.

**KEEP + EXTEND:** `components/ui/metric.tsx`, `components/ui/empty-state.tsx`,
`components/dashboard/station-network-map.tsx`, `lib/utils.ts`,
`globals.css` token/motion layer.

**KEEP + ADD ONE FILTER:** `lib/repositories/stationRepository.ts` or a new
thin wrapper — apply the `STATION_01/02/03` allowlist (§3.6). This is the
one required code change and it is frontend-only.

**REBUILD (visual, preserve wiring):** `app/page.tsx`, `app/dashboard/page.tsx`,
`app/about/page.tsx`, `app/report/page.tsx`,
`components/layout/public-shell.tsx`, `components/stations/station-detail.tsx`.

**DELETE:** `soilEc` series + column in `daily-comparison-chart.tsx`;
`deliveryRate` series in `stationProfile.ts:66`; fabricated non-water chart
series in `stationProfile.ts:52-68`.

**DEFER:** any gallery/journal/export/historical-range UI; `stations.kind`
migration.

---

## 17. Risks / unresolved issues

| # | Risk | Severity | Resolution |
|---|---|---|---|
| R-1 | ~~Station identity~~ | **RESOLVED §3** | Option A, frontend-only, no schema change |
| R-2 | No real telemetry stored yet | Open, not a blocker | Rebuild must state provenance honestly; independently re-confirmed §4 |
| R-3 | `crop_thresholds` unseeded | HIGH | Frontend already falls back correctly; seeding is a data decision outside this audit's authority |
| R-4 | ~~Magnus unavailable~~ | **RESOLVED §1** | Read at `D:\pi\web` |
| R-5 | Coordinate inconsistency: seed cluster `10.24,105.82` vs report fallback `10.082,106.032` | MEDIUM, unresolved | Confirm real coordinates before any "real geography" claim in copy |
| R-6 | Province terminology docs vs archive | LOW | Already reconciled (§15) |
| R-7 | 34 docs in `docs/` | MEDIUM | This file is the absorption point (§0) |
| R-8 | ~~No CI~~ — **corrected, CI exists** | NONE | `.github/workflows/ci-validate.yml` gates check/lint/tests/build; rebuild must keep it green |
| R-9 *(new)* | `STATION_03` device credential (`station-secret-03`) exists in `devices` seed but is never used by any firmware path (§3.2) | LOW | Vestigial; flag for cleanup, not a rebuild blocker |

---

## 18. Rebuild order

0. Apply the §3.6 station allowlist filter — the one required code change.
1. Delete dead UI (§16).
2. Layout foundation (§12) in the shell.
3. State system (§9) as extended shared primitives with real call sites.
4. Station detail — highest data coverage, most-built-out register.
5. Dashboard — heaviest page, benefits most from §12 + dead-UI removal.
6. Home, then About — most editorial, least data-dependent, register §7.
7. Report — visual only, behavior frozen.
8. Admin — last, minimal, §7's admin register only.
9. Re-validate: `check`, `lint`, `test:web`, `test:all`, `build`,
   `git diff --check` — all seven CI steps (R-8).

---

## 19. Explicit backend-freeze boundary

Unchanged, restated: `services/edge-ingestion/**`, `infra/supabase/**`,
`firmware/**`, `apps/web/lib/repositories/**` (query shape/scoping),
`apps/web/lib/auth/**`, `apps/web/lib/supabase/**`, `apps/web/app/api/**`,
`apps/web/middleware.ts`, `apps/web/lib/reports/**`, all existing tests.
The one permitted addition is an **application-layer allowlist filter**
inside the existing repository call pattern (§3.6, §16) — not a query
shape change, not a scoping model change, not a schema change.

---

## 20. Implementation gate

| # | Criterion | Status |
|---|---|---|
| 1 | Frontend data contracts verified | ✅ PASS |
| 2 | Unsupported UI claims removed from design | ✅ PASS |
| 3 | New route structure justified | ✅ PASS — justified as *keep existing* |
| 4 | Current working behavior preserved | ✅ PASS |
| 5 | Magnus influence reviewed and bounded | ✅ **PASS** — read at `D:\pi\web`, findings in §1 |
| 6 | Experience architecture not over-abstracted | ✅ PASS |
| 7 | Motion tied to data/interaction/storytelling | ✅ PASS |
| 8 | Empty/no-data states first-class | ✅ PASS |
| 9 | 1920px+ layouts explicitly defined | ✅ PASS |
| 10 | HORIZON's visual signature articulated | ✅ PASS (§6) |
| 11 | No backend/firmware changes required to start | ✅ **PASS** — Option A resolution is frontend-only (§3.6) |
| 12 | Clean rebuild order exists | ✅ PASS (§18) |

### VERDICT: **REBUILD READY**

Both items that blocked Phase 0 are resolved with source evidence, not
assumption: the Magnus reference has been read and its lessons are bounded
(mostly rejected, three deferred, one adopted-later); station identity has
a definitive, firmware-traced answer with a no-schema-change path to ship.

**One non-blocking condition carried forward:** R-3 (unseeded
`crop_thresholds`) means threshold-driven UI (§13B) stays gated behind a
data decision that is not this audit's to make. Everything else in §13A
can begin immediately.
