# Telemetry State Model

**Status: implemented.** `apps/web/components/ui/status-indicator.tsx`
now defines exactly the two-axis model described below (`FreshnessState` /
`QualityState`, plus a separate `QualityIndicator` component) — confirmed
by reading the file directly (Phase E reconciliation, 2026-08-13). The
"self-correction" history below is kept as the record of *why* the model
looks the way it does, not as an open item.

## Self-correction (historical — already applied)

The Phase B redesign (an earlier working session) introduced
`apps/web/components/ui/status-indicator.tsx` with a single 9-value enum:
`live | recent | stale | offline | unavailable | estimated | invalid |
warning | critical`. A later review found that enum conflated two
orthogonal concerns — how fresh a reading is, and how trustworthy its
value is — and half its values (`estimated`, `invalid`, `warning`,
`critical`) were never actually produced anywhere in the codebase
(grep-confirmed at the time — only `freshnessStatus()`'s five return
values were ever passed to `StatusIndicator`). This document defined the
replacement two-axis model; the component was then edited to match.

## Two independent axes

### Axis 1 — Freshness (how recently did data arrive, if ever)

| State | Meaning | Threshold |
|---|---|---|
| `LIVE` | A reading exists and is very recent | age ≤ 5 minutes |
| `RECENT` | A reading exists, not live but not concerning | 5 min < age ≤ 30 min |
| `STALE` | A reading exists but is old enough to question | 30 min < age ≤ 6 hours |
| `OFFLINE` | A reading exists historically, but nothing recent | age > 6 hours |
| `NEVER_CONNECTED` | No reading has **ever** existed for this station | no row at all, ever |
| `UNAVAILABLE` | Not a freshness question at all — this specific metric has no data source for this station kind (e.g. soil metrics on a water station) | structural, not time-based |

`NEVER_CONNECTED` and `UNAVAILABLE` are easy to conflate but mean
different things: a brand-new station that hasn't sent its first reading
yet is `NEVER_CONNECTED`; asking a water station for its soil pH is
`UNAVAILABLE` regardless of how fresh its water data is. The current
`freshnessStatus()` implementation does not distinguish these — a
station with zero rows ever and a station whose query simply targets a
non-existent field both currently resolve to the same `"unavailable"`
value. Fixing this requires the caller to know *why* there's no data
(zero rows vs. wrong table), which today it usually does — this is a
cheap, low-risk fix, not a redesign.

Thresholds (5 min / 30 min / 6 hr) match what `freshnessStatus()`
already implements (`status-indicator.tsx`) — kept as-is; they were a
reasonable judgment call, not something this pass found wrong. They are
not derived from any documented sensor sampling interval (`device_
runtime_configs.sample_interval_seconds` defaults to 300s = 5 min,
configurable per-station) — worth noting the LIVE threshold and the
default sample interval happen to match, which is good, but if an
operator sets a longer sample interval via the admin sleep-mode
controls, a perfectly healthy station would immediately start reading
as `RECENT` instead of `LIVE` between samples. This is a real, minor
UX inconsistency: freshness thresholds are currently hardcoded and
don't adapt to the station's configured sample interval.

### Axis 2 — Value quality (when a reading exists, should it be trusted)

| State | Meaning |
|---|---|
| `VALID` | Value came directly from a sensor read that succeeded |
| `ESTIMATED` | Value was derived/interpolated rather than directly measured (not currently produced anywhere — no code path in the current repository layer estimates a value; flagged as reserved for a future rollup/interpolation feature, not implemented) |
| `ERROR` | The device explicitly reported a fault for this measurement (`ec_probe_status`/`ultrasonic_status === 'fault'`, or a soil sensor reporting `null` while others on the same message succeeded) |

`ERROR` is not a freshness concept — a station can report a sensor fault
every 5 minutes on schedule, which is simultaneously `LIVE` (axis 1) and
`ERROR` (axis 2). The current single-enum component cannot represent
this combination; it has to pick one label. This is the concrete
consequence of not separating the axes, and the reason to fix it.

## A third, separate concept: `stations.status`

Distinct from both axes above: `stations.status` (`active` / `inactive`
/ `maintenance`) is an **administrator-set field**, not derived from
telemetry at all — it's set via the admin console's station management,
not computed from `environmental_readings`. Confirmed by reading
`stationStatusLabel()` call sites: `dashboard/page.tsx`'s
`stationPriority()` ranks a station as "offline" if `station.status ===
'inactive'`, entirely independent of whether that station's last
reading was 5 minutes or 5 months ago. **These two signals currently
disagree with each other with nothing reconciling them**: a station
manually left at `status='active'` with no reading in weeks shows an
"Đang hoạt động" (active) badge from `station.status` while a nearby
freshness indicator (where present, e.g. `station-detail.tsx`'s
`StatusIndicator`) simultaneously shows "Mất kết nối"/stale — two
true-but-contradictory-looking labels on the same page. This is a real,
current inconsistency, not a hypothetical one.

**Recommendation**: `stations.status` should mean *operational intent*
("this station is deployed and expected to report" vs. "taken out of
service for maintenance"), and freshness should independently describe
*observed reality* ("is it actually reporting"). The UI should show
both, clearly labeled as different things, rather than picking one to
display as if it were the whole answer — e.g. "Trạng thái vận hành:
Đang hoạt động · Dữ liệu: Mất kết nối 3 ngày" instead of a single badge
that has to average two disagreeing signals into one word.

## Backend's own event model (a third source of "status")

`environmental_events` (`OFFLINE`/`SENSOR_FAULT`/`HIGH_SALINITY`/
`LOW_BATTERY`) is emitted by `ingest.ts` at ingestion time, based on
per-request thresholds — this is yet another independent signal,
computed server-side, at write time, not read time. It answers "did
something noteworthy happen on this specific reading," not "what is
this station's status right now." The frontend currently surfaces these
as the dashboard's alert feed — correctly separate from the freshness
question, no conflict found here.

## Consolidated state vocabulary going forward

1. **Freshness** (`LIVE`/`RECENT`/`STALE`/`OFFLINE`/`NEVER_CONNECTED`) —
   derived purely from the latest reading's timestamp, per metric-source
   (water and soil keep independent timestamps because they are separate
   stations and measurement domains).
2. **Availability** (`UNAVAILABLE`) — structural, not time-based; this
   metric has no data source for this station, independent of freshness.
3. **Quality** (`VALID`/`ESTIMATED`/`ERROR`) — per-value, independent of
   both of the above.
4. **Operational status** (`stations.status`) — administrator intent,
   shown alongside freshness, never merged into it.
5. **Events** (`environmental_events`) — point-in-time occurrences, the
   alert feed, not a current-state indicator.

These five are complementary, not competing — the UI's job is to show
whichever combination is relevant per context without silently
collapsing them into one badge that can only say one thing at a time.
