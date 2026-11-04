# Data assessment and display rules (website)

Status: implemented in `apps/web/lib/monitoring/{assessment,displayStatus}.ts`, wired into
`observatory-canvas.tsx`. Scope statement: `data-scope-section.tsx`, directly under the dashboard (no ticker, no separate page). **Not deployed.** Notice wording in `dataScope.notice.*` is a project
draft and needs legal review before official release.

## Four independent questions

| Layer | Question | Source of truth | Never does |
|---|---|---|---|
| Freshness | Is the reading recent for this device's cadence? | `provenance.observedAt` vs now; expected interval 180 s (`DEFAULT_EXPECTED_INTERVAL_MS`); FRESH ≤ 3 cycles, STALE ≤ 20 cycles, then OFFLINE; future timestamps → UNKNOWN. **Soil** reports about every 8 h, so its cadence is 8 h: FRESH up to 24 h, STALE up to 7 d (station-level soil freshness uses the same 9 h / 24 h / 7 d marks, `SOIL_FRESHNESS_THRESHOLDS`) | use a fixed 5-minute cut-off |
| Quality | May the value be trusted? | station fault evidence (`fault_flags`, probe status), plausible range, null | read null as 0; call "no evidence" valid |
| Threshold | Where is it against a configured threshold? | `threshold_registry` rows that are active, `OPERATIONAL`/`SITE_VALIDATED`, effective at the observation time, basis not device/sensor-quality | evaluate stale or untrusted values; colour a quantity with no row |
| History | Is it unusual against this station's own validated history? | robust z-score (median/MAD, IQR fallback) against the previous DAILY series values (year, else 30 d; the last 24 h are excluded), ≥ 14 days and ≥ 14 days of coverage, 2-sample confirmation on the same side | colour a reading when the baseline is too short |

They are combined only in `resolveDisplay`, and only toward more caution.

## Display convention: green - white - red

A diverging scale over the station's own history, plus the configured thresholds (unchanged, same sources).
Site data barely moves, so the cut-offs are wide (3 / 5 instead of the textbook 2 / 3.5) and the spread used for
z is floored: at least 5 % of the median and at least a per-quantity minimum (`ANOMALY_POLICY[q].minScale`:
level 5 cm, salinity 0.05 ‰, water EC 0.1 mS/cm, temperatures 1–1.5 °C, soil moisture 3 %, bulk EC 0.05 mS/cm,
pH 0.15, humidity 5 %). Boxes show the colour only; the reason stays available to screen readers. The history
calendar uses the same scale per day (daily mean against the series' own median/spread), white for a usual day
and an empty cell for a day without data.

| Colour | Needs |
|---|---|
| Green | fresh, valid, and **lower than usual**: confirmed robust z ≤ −3 (light) or ≤ −5 (strong) |
| White | fresh, valid, inside the usual range (|z| < 3), or inside a configured band when there is no usable history |
| Red | fresh, valid, and **higher than usual** (z ≥ 3 light, ≥ 5 strong), **or** a configured threshold approached (light) / exceeded and confirmed by 2 consecutive samples (strong) |
| Gray | stale, offline, missing, faulty, suspect, no threshold and no history, not enough basis — with the reason printed |

"Confirmed" = the last 2 samples lie on the same side and both pass the cut-off, so one noisy sample cannot tint a box.
A configured threshold exceedance is always red, whatever the history says. A colour says where a value sits against
history or a threshold; the wording never says "safe" or "dangerous". Green/white/red are tints on a flat fill (no
border, stripe or shadow); the legend sits under the dashboard. A region shows its strongest tinted reading
(red before green on a tie); otherwise a data problem in any reading is shown; otherwise white.

## Known limits (honest list)

* History comes from the daily series the browser already holds (no per-sample quality flag), so a faulty day inside
  it would enter the baseline. A server-side, quality-vetted baseline is still the better source and an approval item.
* Water level and salinity follow the tide, so a comparison with daily values only shows where the reading sits;
  the colour is only a position, not a tide-corrected verdict. Rainfall is event-driven and not compared. No diurnal adjustment (daily buckets).
* Quality is station-level for water (`error` blanks both water metrics). Soil is per field: the soil packet's
  `fault_flags` has one bit per field it could not read (air temp 1, air humidity 2, soil temp 4, moisture 8,
  bulk EC 16, salinity 32, TDS 64, pH 128) and each box reads only its own bit. Before this, a missing salinity
  or TDS field (not shown on the site) marked every soil reading "sensor fault".
* Confirmation samples come from the 24 h trend series; the series has no quality flag.
* `observedAt` is the time the gateway received the packet over the network, not the sensor time. After the
  gateway queue is flashed, a delayed backlog frame is stamped with forward time until the backend honours
  `received_at_epoch` (see `GATEWAY_UPLOAD_QUEUE.md`), so freshness can over-state recency for backlog rows.
* Before hydration (first paint) nothing is coloured: the browser clock is not known yet.
* Thresholds and their sources are unchanged: same registry rows and filter as before (the per-metric provenance panel was removed from the page at the owner's request; sources remain in the reference table).
* Visible behaviour change: warning-severity exceedances now render red; stale readings are gray; soil is no longer
  "old" after 30 minutes but after a day.

## Tests

`tests/assessment.test.ts` (layers) and `tests/displayStatus.test.ts` (glue, region rule, copy). Run: `cd apps/web && npx tsx --conditions=react-server --test tests/assessment.test.ts tests/displayStatus.test.ts`.
