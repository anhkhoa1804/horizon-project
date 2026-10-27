# Data assessment and display rules (website)

Status: implemented in `apps/web/lib/monitoring/{assessment,displayStatus}.ts`, wired into
`observatory-canvas.tsx`. **Not deployed.** Notice wording in `dataScope.notice.*` is a project
draft and needs legal review before official release.

## Four independent questions

| Layer | Question | Source of truth | Never does |
|---|---|---|---|
| Freshness | Is the reading recent for this device's cadence? | `provenance.observedAt` vs now; expected interval 180 s (`DEFAULT_EXPECTED_INTERVAL_MS`); FRESH ≤ 3 cycles, STALE ≤ 20 cycles, then OFFLINE; future timestamps → UNKNOWN | use a fixed 5-minute cut-off |
| Quality | May the value be trusted? | station fault evidence (`fault_flags`, probe status), plausible range, null | read null as 0; call "no evidence" valid |
| Threshold | Where is it against a configured threshold? | `threshold_registry` rows that are active, `OPERATIONAL`/`SITE_VALIDATED`, effective at the observation time, basis not device/sensor-quality | evaluate stale or untrusted values; colour a quantity with no row |
| History | Is it unusual against this station's own validated history? | robust z-score (median/MAD, IQR fallback), ≥ 72 samples and ≥ 7 days, strictly earlier valid non-demo samples, 2-sample confirmation | colour anything green or red on its own |

They are combined only in `resolveDisplay`, and only toward more caution.

## Display convention

| Colour | Needs |
|---|---|
| Green | configured threshold **and** valid **and** fresh, value inside the band ("within reference threshold", never "safe") |
| Yellow | approaching a configured threshold, exceedance not yet confirmed, or notably different from history |
| Red | configured alert threshold exceeded **and** confirmed by 2 consecutive samples (warning and critical severities are both red) |
| Gray | everything else: stale, offline, missing, faulty, suspect, no threshold, not enough basis — with the reason printed |

A region (box) is never greener than its data: one stale or faulty reading in it keeps it neutral and
shows the reason; red/yellow from any reading still win.

## Known limits (honest list)

* **History is not active in production yet.** No quality-vetted baseline reaches the browser (the trend
  series carries no per-sample quality flag), so the layer reports "not enough history". A server-side
  baseline endpoint (valid samples only, last N weeks, per quantity) is the next step and is an approval item.
* Water level and salinity are tide-driven and are deliberately **not** compared with history.
* Quality is station-level for water (`error` blanks both water metrics). Per-metric sensor flags would be finer.
* Confirmation samples come from the 24 h trend series; the series has no quality flag.
* `observedAt` is the time the gateway received the packet over the network, not the sensor time. After the
  gateway queue is flashed, a delayed backlog frame is stamped with forward time until the backend honours
  `received_at_epoch` (see `GATEWAY_UPLOAD_QUEUE.md`), so freshness can over-state recency for backlog rows.
* Before hydration (first paint) nothing is coloured: the browser clock is not known yet.
* Visible behaviour change: warning-severity exceedances now render red (previously the warn tint);
  readings that were green while stale are now neutral.

## Tests

`tests/assessment.test.ts` (layers, 29) and `tests/displayStatus.test.ts` (glue, region rule, copy, ticker
contract, 22). Run: `cd apps/web && npx tsx --conditions=react-server --test tests/assessment.test.ts tests/displayStatus.test.ts`.
