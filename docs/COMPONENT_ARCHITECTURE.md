# HORIZON Component Architecture — Phase D

Written after the Phase D redesign pass. Documents the primitive
hierarchy that now exists and the design-system deltas this pass made —
not a restatement of `DESIGN_TOKENS.md` (still authoritative for exact
values), just what changed and why.

## Design-system deltas this pass

- **`Card` now uses the radius token scale** (`rounded-lg`, 18px) instead
  of Tailwind's untouched default `rounded-2xl` (16px) — the single
  most-used primitive in the app was quietly off the token scale;
  fixing it corrected every page built on `Card` at once.
- **Nav active-state moved off solid-black pills** to an accent-tinted
  background (`bg-accent/10 text-accent`), applied consistently in the
  header nav, mobile bottom nav, and the report form's category picker
  (which had independently invented the same solid-black pattern).
- **Motion**: interactive-state transitions now reference
  `duration-[var(--motion-base)]` (180ms) instead of Tailwind's
  unstated default duration, so hover/active timing is consistent and
  centrally adjustable.

## Foundation

Typography, spacing, radius, elevation, motion, z-index — defined as
CSS custom properties in `apps/web/app/globals.css`'s `@theme` block.
No changes to values this pass beyond the `Card` radius fix above;
`DESIGN_TOKENS.md` remains the reference.

## Primitives

Single-purpose, used across unrelated pages, no page-specific logic.

- **`Badge`** (`components/ui/badge.tsx`) — operational-status vocabulary
  (healthy/watch/risk/offline/fault).
- **`StatusIndicator`** / **`QualityIndicator`** (`components/ui/status-
  indicator.tsx`) — the two independent axes from `docs/
  TELEMETRY_STATE_MODEL.md`: freshness (live/recent/stale/offline/
  never_connected/unavailable) and value quality (valid/estimated/
  error). Deliberately two components, not one with a union prop type —
  the axes are structurally independent and a shared type would blur
  that back together.
- **`Metric`** (`components/ui/metric.tsx`) — the single numeric-readout
  primitive (label + value + unit + optional freshness), now used by
  both the dashboard and station detail (previously station detail had
  its own parallel `MetricTile` card component doing the same job with
  different markup — removed this pass).
- **`SectionHeader`** (`components/ui/section-header.tsx`, new) — the
  eyebrow + title (+ optional trailing content) pattern that was hand-
  repeated with slightly different markup at nine-plus call sites across
  the homepage, dashboard, and station detail. One primitive now.
- **`EmptyState`** (`components/ui/empty-state.tsx`) — unchanged, still
  the honest-disconnected-state primitive used everywhere data is
  unavailable.

## Composite

Combine primitives with real behavior; used in more than one place but
not generic enough to be a foundation primitive.

- **`StationNetworkMap`** (`components/dashboard/station-network-map.tsx`,
  new) — the real Leaflet map, driven entirely by real `stations.lat`/
  `lng`. Used on the dashboard, homepage, and about page (previously
  each had its own separate, fake-positioned network visualization —
  the dashboard had an illustrated PNG with hand-tuned pixel hotspots,
  the homepage had a glowing-pill diagram with hardcoded percentage
  positions, and about page had a third variant of the same pattern).
  One real map now; the fake-position duplication is gone.
- **`ChartPanel`-equivalent**: `SalinityChart`, `StationLiveChart`,
  `DailyComparisonChart` remain page-specific chart components, not
  merged into one generic panel — their axis/unit logic is different
  enough (dual-axis station trend vs. single-series salinity vs. small-
  multiple daily comparison) that a shared wrapper would need more
  configuration surface than three direct implementations cost.

## Page-level

`app/page.tsx` (Homepage), `app/dashboard/page.tsx` (Observatory),
`components/stations/station-detail.tsx` (Station Detail), `app/report/
page.tsx` + `components/report/report-form.tsx` (Report), `app/admin/
page.tsx` (Admin), `app/about/page.tsx` (About).

## What was deliberately NOT extracted into a shared component

- **Report form field layout** — single-purpose, no second caller.
- **Admin table/panel layout** — single-purpose, operational density
  that a generic table component would fight rather than help.
- **`StationCard`** (`components/dashboard/station-card.tsx`) — existed
  before this pass, was never actually used anywhere (grep-confirmed
  zero imports), and modeled exactly the "boxes inside boxes" pattern
  this phase moved away from. Deleted rather than kept as an unused
  second way to render a station.
