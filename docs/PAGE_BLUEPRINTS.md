# Page Blueprints

## Purpose

Page blueprints define component order, hierarchy, and responsive behavior. They help engineers and AI agents build screens without guessing.

A blueprint is not a pixel-perfect mockup. It is the required information architecture and interaction priority for each page.

## Global page rules

- Public pages answer the user's main question before explaining the product.
- Admin pages prioritize triage, filtering, and action speed.
- Mobile layout is the source layout; desktop enhances it.
- Every page must define loading, empty, error, and stale states.
- Every page must preserve data trust by showing freshness when readings are involved.

## Homepage

### User goal

Understand what Eco-Sense is, why it matters, and where to view environmental data.

### Mobile hierarchy

1. Header with logo/name and minimal navigation.
2. Hero: clear product promise and primary CTA.
3. Current environmental snapshot.
4. Mission: why salinity and water level matter.
5. How it works: station to public data flow.
6. Community reporting CTA.
7. Research and sustainability story.
8. Trust indicators: signed telemetry, public transparency, pilot readiness.
9. Footer.

### Desktop hierarchy

1. Header.
2. Hero with product promise and live snapshot side panel.
3. Mission and problem statement.
4. Realtime dashboard preview.
5. How Eco-Sense works.
6. Community and research sections.
7. Trust and technical credibility.
8. Footer.

### Priorities

- The first screen should communicate “real environmental monitoring for Cồn Hô”.
- Do not lead with technology stack.
- Do not bury dashboard CTA.

## Public Dashboard

### User goal

See the overall environmental situation across stations.

### Mobile hierarchy

1. Header and last updated summary.
2. Overall status banner.
3. Summary metric cards: healthy stations, watch/risk stations, offline stations.
4. Station cards sorted by operational importance.
5. Recent alerts or notable changes.
6. Regional trend chart.
7. Community report CTA.
8. Footer.

### Desktop hierarchy

1. Header with dashboard title and freshness.
2. Summary metrics row.
3. Main content grid: station list/cards and trend panel.
4. Alerts panel.
5. Community reports preview.
6. Footer or secondary metadata.

### Sorting rules

Station order should prioritize:

1. Risk.
2. Sensor fault.
3. Offline.
4. Watch.
5. Healthy.
6. No data.

### States

- No stations: explain pilot setup and show no fake data unless demo mode is explicit.
- Stale data: keep last known data but mark it clearly.
- Partial failure: show available stations and explain what failed.

## Station Detail QR Page

### User goal

Immediately understand whether the water and sensor are OK at one station.

### Mobile hierarchy

1. Station header: station name, location, last updated.
2. Overall status card with plain-language answer.
3. Primary metrics: salinity and water level.
4. Sensor trust card: EC probe, ultrasonic, battery, signal.
5. 24-hour trend chart with threshold.
6. Recommendation card.
7. Community report CTA.
8. Recent community reports if public-safe.
9. Educational explanation.
10. Footer.

### Desktop hierarchy

1. Station header.
2. Two-column top section: overall status and metric cards.
3. Trend chart full-width or dominant column.
4. Sensor health and recommendations side panel.
5. Community reports and educational notes.
6. Footer.

### Above-the-fold requirement

At 320px width, users must see:

- station identity,
- current status,
- last updated time,
- at least one critical metric or a clear summary.

### States

- Healthy: show confidence and current readings.
- Watch: explain reason and what to monitor.
- Risk: show reason and recommended action near top.
- Offline: hide confident environmental judgment; show last known reading separately.
- Sensor fault: mark readings unreliable and prioritize maintenance message.

## Report Page

### User goal

Submit a community environmental or damage report quickly from a phone.

### Mobile hierarchy

1. Header with simple title.
2. Short reassurance: what reports are for.
3. Station selector or QR-derived station context.
4. Report type.
5. Description textarea.
6. Optional photo or contact field if supported.
7. Submit button near thumb zone.
8. Offline draft or sync status.
9. Privacy note.

### Desktop hierarchy

1. Centered form in `content-narrow` width.
2. Context side note only if helpful.
3. Confirmation state after submit.

### Rules

- Do not require account creation for public reports.
- Preserve drafts locally when network is unstable.
- Keep fields minimal.
- Use plain Vietnamese labels.

## Login Page

### User goal

Authenticate as an administrator without confusion.

### Hierarchy

1. Product/admin identity.
2. Short explanation: admin access only.
3. Email and password form (current implementation is shared-password + allowlist, not magic-link — see `ARCHITECTURE_DECISIONS.md`).
4. Submit button.
5. Help text for unauthorized users.
6. Return to public site link.

### Rules

- Do not make public users think login is required for station data.
- Keep login visually distinct from public station pages but still calm.
- Error messages should not leak account existence unnecessarily.

## Admin Overview

### User goal

Triage the station network and identify what needs action.

### Desktop hierarchy

1. Admin shell: sidebar with text labels and top freshness indicator.
2. Summary metrics: risk, watch, offline, sensor fault, reports pending.
3. Station operations table.
4. Alerts queue.
5. Recent ingestion or audit activity.
6. Secondary panels: battery/signal trends, reports preview.

### Mobile/tablet hierarchy

1. Admin header.
2. Summary metrics in horizontal scroll or grid.
3. Priority alert cards.
4. Station cards replacing dense table.
5. Reports and audit links.

### Table columns

Recommended station table columns:

- Station.
- Status.
- Last seen.
- Salinity.
- Water level.
- Sensor health.
- Battery.
- Signal.
- Alerts.
- Actions.

### Rules

- Keep filters visible.
- Use sticky table header on desktop.
- Row actions must be available without hover-only interaction.

## Admin Station Detail

### User goal

Diagnose one station and take operational action.

### Hierarchy

1. Station identity, status, last seen.
2. Action row: acknowledge alert, edit thresholds, mark maintenance.
3. Metric and health summary.
4. Time-series chart.
5. Recent events and rejected telemetry.
6. Device metadata.
7. Audit timeline.
8. Related community reports.

### Rules

- Separate environmental issue from sensor/device issue.
- Show exact timestamps for operations.
- Keep destructive actions behind confirmation.

## Admin Reports

### User goal

Review and resolve community reports.

### Hierarchy

1. Filters: status, station, report type, date.
2. Reports table or cards.
3. Selected report detail.
4. Status/action controls.
5. Audit history.

### Rules

- Reporter private information must be protected.
- Status changes should be logged.
- Public visibility must be explicit.

## Offline Page

### User goal

Understand that the app or data is unavailable and know what still works.

### Hierarchy

1. Calm offline title.
2. Explanation of what cannot be refreshed.
3. Last cached data if available.
4. Retry action.
5. Report draft status if relevant.

### Rules

- Do not show a generic browser-like failure.
- Do not imply current safety from stale data.
- If cached data is shown, label it as cached and timestamped.