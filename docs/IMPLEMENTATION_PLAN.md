# Implementation Plan

## Goal

Build Eco-Sense Cồn Hô into a production-quality showcase platform: a calm public environmental experience, a reliable field telemetry pipeline, and a precise admin operations console.

## Phase 1 — Product foundation

Deliverables:

- Product handbook in `docs/`.
- Clear public versus admin information architecture.
- Shared design system direction.
- Core status model for healthy, watch, risk, offline, and sensor fault.
- Mobile-first page hierarchy for QR station pages.

Quality gate:

- A new contributor can explain the product, personas, and UI philosophy after reading `docs/README.md` and `docs/PRODUCT_CONTEXT.md`.

## Phase 2 — Data and ingestion foundation

Deliverables:

- Supabase schema for stations, devices, readings, health logs, events, reports, thresholds, and audit logs.
- v1 telemetry ingestion edge function.
- HMAC signature validation.
- Timestamp replay protection.
- Idempotent `message_id` behavior.
- Sensor fault rejection or isolation.

Quality gate:

- Valid telemetry inserts exactly once.
- Duplicate telemetry is safely ignored.
- Invalid signatures, stale timestamps, inactive devices, out-of-range values, and sensor faults are rejected with clear error codes.

## Phase 3 — Public experience

Deliverables:

- Homepage explaining the environmental monitoring story.
- Public dashboard with high-level station status.
- QR station page for `/s/[stationId]`.
- Salinity and water-level cards.
- Recent trend charts with thresholds.
- Data freshness and sensor health indicators.
- Community reporting page.

Quality gate:

- A farmer can scan a QR code and understand station status in a few seconds on a phone.
- A tourist or judge immediately sees a polished, credible product.

## Phase 4 — Admin operations

Deliverables:

- Admin login.
- Station table with status, freshness, alerts, battery, and signal.
- Station detail operations view.
- Alert triage.
- Threshold management.
- Community report review.
- Audit timeline.

Quality gate:

- An admin can identify and prioritize station issues quickly without visual noise.
- Keyboard navigation and table workflows are efficient.

## Phase 5 — Field pilot readiness

Deliverables:

- Device provisioning checklist.
- QR labels generated and tested.
- Calibration records.
- Staging and production environment separation.
- Pilot runbook and incident response process.
- Data quality monitoring.

Quality gate:

- A deployed station can send signed readings, appear on its public QR page, and show health/freshness correctly.

## Phase 6 — Production showcase polish

Deliverables:

- Accessibility pass against WCAG AA expectations.
- Performance pass for mobile station pages.
- Empty, loading, error, offline, and stale states refined.
- Demo script for judges and partners.
- Documentation updated to match implementation.

Quality gate:

- The product can be demonstrated confidently in 5 minutes and inspected deeply by technical reviewers.

## Feature delivery checklist

Every feature should define:

- primary persona,
- public or admin surface,
- user problem,
- success state,
- loading state,
- empty state,
- error state,
- stale/offline behavior,
- accessibility behavior,
- performance considerations,
- authorization requirements,
- audit requirements if sensitive.

## Design implementation rules

- Start mobile-first.
- Use shared components and tokens.
- Keep public pages simple and admin pages efficient.
- Avoid duplicated component implementations.
- Treat status labels and thresholds as product logic, not decorative styling.
- Preserve data trust when readings are stale, missing, or faulty.

## Technical implementation rules

- Validate data at the boundary.
- Keep secrets server-side.
- Prefer typed contracts where possible.
- Keep ingestion idempotent.
- Separate environmental readings from device health and events.
- Use RLS as the final data access boundary.
- Add tests for contracts, authorization, and critical status logic.
