# UI Audit Checklist

## Purpose

Use this checklist before committing UI work. It converts the Eco-Sense handbook into concrete inspection points so agents and engineers can catch visual, accessibility, responsive, and interaction issues before review.

Do not treat this as a generic web checklist. Every item exists to protect Eco-Sense’s promise: calm, trustworthy environmental intelligence for farmers, visitors, administrators, and judges.

## How to use

1. Read the relevant page blueprint in [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md).
2. Check components against [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md).
3. Check token usage against [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).
4. Check wording against [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md).
5. Check empty states against [`EMPTY_STATES.md`](EMPTY_STATES.md).
6. Run this checklist before claiming the UI is complete.

## Product fit

- The screen communicates environmental state before decoration.
- The UI feels calm, professional, and trustworthy.
- The page does not look like a generic IoT dashboard.
- The page does not look like a Bootstrap, Material demo, or admin template.
- Farmers can understand the main status without technical knowledge.
- Tourists can understand the environmental story without login.
- Admin users can act quickly without visual noise.
- Judges can identify product quality within the first minute.

## Visual hierarchy

- The primary status is visually dominant on public station pages.
- The page title is clear and placed where users expect it.
- Metric values are larger than labels and helper text.
- Secondary metadata does not compete with the primary answer.
- Admin pages prioritize alerts, station health, and last seen time.
- Public pages do not lead with settings, filters, or technical metadata.
- Related content is grouped into meaningful cards or sections.
- Unrelated content is separated with spacing, not random borders.

## Spacing

- Spacing uses the scale from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).
- No arbitrary spacing values such as 13px, 27px, or 58px.
- Public mobile cards use generous padding.
- Admin dense surfaces remain readable.
- Metric cards have consistent internal gaps.
- Table rows have enough height for scanning.
- Form fields have enough vertical spacing for touch use.
- Section gaps are consistent across the page.
- Components do not visually collide at 320px.

## Typography

- Public body text is at least 16px.
- Metric values use tabular numerals when possible.
- Units are shown beside values.
- Labels are readable and not overly muted.
- Long uppercase labels are avoided.
- Admin text is compact but still readable.
- Line lengths are comfortable on desktop.
- Font weights create hierarchy without feeling heavy.

## Color and status

- Status is never communicated by color alone.
- Healthy, watch, risk, offline, and fault states use documented tokens.
- Warning colors are not overly saturated.
- Risk red is clear but not visually aggressive.
- Offline state uses neutral color and explicit copy.
- Sensor fault is visually distinct from environmental risk.
- Chart colors match documented data roles.
- Text contrast meets WCAG AA expectations.
- Grayscale view still communicates status meaning.

## Cards

- Cards group meaning, not decoration.
- Card radius follows token values.
- Card shadows are subtle.
- Public cards are not too dense.
- Admin cards are not oversized marketing blocks.
- Clickable cards have clear focus and accessible names.
- Cards do not contain nested conflicting click targets.
- Loading card skeletons preserve final height.

## MetricCard

- Height matches the documented min-height for the surface.
- Label appears above the value.
- Value is visually dominant.
- Unit is visible and aligned with value.
- Status badge appears near the value.
- Trend/helper text is secondary.
- Icon, if used, is top-right and not centered.
- Loading state preserves the card structure.
- Empty state explains why data is missing.
- Sensor fault does not show confident environmental interpretation.

## StationCard

**Stale (Phase G correction):** `StationCard` was deleted — see
`docs/COMPONENT_ARCHITECTURE.md`. This checklist is kept for historical
reference; apply its intent to whatever currently renders a station
summary (the dashboard's row list, `station-detail.tsx`) instead.

- Station name is clear.
- Location or area is visible when relevant.
- Status badge is visible without hover.
- Last updated time is visible.
- Salinity and water-level summary are present when available.
- Offline station shows last seen time.
- Risk stations sort before healthy stations.
- Card remains readable on mobile.

## Buttons

- Button labels are verbs.
- Primary action is visually clear.
- Only one primary action dominates each view.
- Touch target height is at least 44px.
- Disabled state is understandable and accessible.
- Loading state preserves button width.
- Destructive actions are visually distinct and confirmed.
- Buttons do not use bounce or playful animation.

## Inputs and forms

- Every input has a visible label.
- Placeholder is not the only label.
- Error message appears near the field.
- Error copy explains how to fix the issue.
- Required fields are clear.
- Mobile input modes are appropriate.
- Report form is short and forgiving.
- Form values are preserved after failed submit.
- Offline report drafts are preserved when supported.

## Empty states

- Empty state uses a documented pattern from [`EMPTY_STATES.md`](EMPTY_STATES.md).
- Title says what is missing.
- Description explains why it matters.
- CTA is present only when useful.
- Empty state does not say only “Nothing here”.
- No-data state is different from offline state.
- Sensor fault state is different from no-data state.
- Public empty states use plain Vietnamese when appropriate.

## Loading and skeletons

- Skeleton matches final component shape.
- Skeleton preserves layout height.
- Chart skeleton has fixed height.
- Admin table skeleton keeps header stable.
- Existing stale data is not replaced by skeleton unnecessarily.
- Reduced motion disables shimmer or heavy pulse.
- No full-page spinner appears when layout is known.

## Charts

- Chart has a visible title.
- Units are visible.
- Axes are minimal but understandable.
- Grid lines are subtle.
- Threshold line appears when threshold matters.
- Tooltip is readable.
- Mobile tooltip works by tap or drag.
- Chart has a text summary.
- Empty chart state explains missing data.
- Chart does not use 3D, glow, or decorative gradients.

## Navigation

- Public navigation is minimal.
- Public mobile primary actions are reachable.
- Bottom navigation, if used, has visible labels.
- Admin navigation uses text labels, not icon-only default.
- Current page is indicated visually and semantically.
- Admin detail pages provide clear back or breadcrumb behavior.
- Navigation does not imply login is required for public station data.

## Interaction and motion

- Motion duration stays between 120ms and 250ms for routine UI.
- Hover effects are subtle.
- Focus ring is visible.
- Accordions use documented timing and expanded state.
- Dialog focus is trapped and restored.
- Toasts do not contain critical disappearing information.
- Reduced motion is respected.
- No bounce, elastic easing, flashing, confetti, or animated background.

## Accessibility

- Page can be navigated by keyboard.
- Focus order follows visual order.
- Interactive elements have accessible names.
- Dialogs, drawers, and menus avoid keyboard traps.
- Status labels are readable by screen readers.
- Charts include non-visual summaries.
- Images have useful alt text or are hidden if decorative.
- Touch targets are at least 44px by 44px.
- Meaning is not conveyed by color alone.

## Responsive behavior

- Page works at 320px.
- Page works at 375px, 390px, and 430px.
- Tablet layout does not create awkward half-desktop UI.
- Desktop layout uses width without stretching text too far.
- Admin tables transform or remain usable below tablet width.
- Public station page shows status above the fold on mobile.
- No horizontal scroll appears except intentional tables or carousels.

## Public station page

- Station name is visible.
- Last updated time is visible.
- Overall status appears before charts.
- Salinity and water-level cards appear near the top.
- Sensor health is visible.
- Recommendation is plain and actionable.
- Report CTA is reachable.
- Stale data is clearly marked.
- Faulty sensor does not produce false confidence.

## Public dashboard

- Summary status appears before station list.
- Stations are sorted by urgency.
- Offline and risk states are not hidden below healthy cards.
- Station cards show freshness.
- Alerts are understandable without admin knowledge.
- Public controls are minimal.

## Homepage

- Hero communicates the product promise, not just technology.
- Live environmental snapshot appears early.
- Problem, solution, evidence, trust, and CTA are clearly sequenced.
- Technology stack does not dominate the first screen.
- The page feels grounded in Cồn Hô and community use.

## Report page

- Report can be submitted without login.
- Form is usable one-handed on mobile.
- Submit button is reachable.
- Privacy and next step are explained.
- Offline or slow network behavior preserves input.
- Confirmation explains what happens next.

## Admin pages

- Admin overview prioritizes operational triage.
- Station table includes status, last seen, salinity, water level, sensor health, battery, signal, alerts, and actions where applicable.
- Filters are visible and keyboard accessible.
- Row actions are not hover-only.
- Threshold edits explain impact before saving.
- Audit history is readable.
- Report review preserves reporter privacy.

## Final review questions

- Can a farmer understand the station state in a few seconds?
- Can an admin identify the most urgent station quickly?
- Does the UI preserve trust when data is stale or faulty?
- Does the implementation follow tokens instead of arbitrary styling?
- Does the page match the documented blueprint?
- Would this feel credible in a 5-minute judge demo?