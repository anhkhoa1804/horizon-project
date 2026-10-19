# Technical QA Checklist

## Purpose

Use this checklist before demos, pilot deployments, and major releases. The goal is to protect the product promise: calm, trustworthy environmental intelligence for real users.

## Product and UX gate

- Public station page answers “Is the water healthy?” within seconds.
- Sensor health and data freshness are visible.
- Risk, watch, offline, and sensor fault states include plain-language explanations.
- Farmer-facing actions are large and reachable on mobile.
- Public pages are simple and polished, not admin-like.
- Admin pages are dense enough for operations, not marketing-like.
- Empty states explain why data is unavailable.
- Error states are calm and actionable.

## Responsive gate

Check core pages at:

- 320px,
- 375px,
- 390px,
- 430px,
- 768px,
- 1024px,
- 1440px.

Required pages:

- `/`,
- `/dashboard`,
- `/s/[stationId]`,
- `/report`,
- `/admin/login`,
- `/admin`.

## Accessibility gate

- All interactive elements are keyboard reachable.
- Focus is visible.
- Inputs have labels.
- Status is not conveyed by color alone.
- Contrast meets WCAG AA for normal and large text.
- Touch targets are at least 44px by 44px on public mobile pages.
- Reduced-motion preferences are respected.
- Charts include text summaries and readable units.
- Dialogs, menus, and filters avoid keyboard traps.

## Performance gate

- Public station page renders critical status before non-essential content.
- Loading uses skeletons or stable placeholders.
- Layout does not shift significantly after data loads.
- Charts do not block primary status rendering.
- Images are optimized.
- Client bundle size is monitored.
- Data fetching avoids duplicate unnecessary requests.
- Stale data is clearly labeled.

## Telemetry contract gate

- Valid signed telemetry inserts successfully.
- Duplicate `message_id` returns success without duplicate insertion.
- Missing fields return `MISSING_FIELD`.
- Invalid HMAC returns `INVALID_SIGNATURE`.
- Stale timestamp returns `TIMESTAMP_OUT_OF_WINDOW`.
- Unknown or inactive device returns `DEVICE_NOT_REGISTERED`.
- Out-of-range values return `VALUE_OUT_OF_RANGE`.
- Sensor fault returns `SENSOR_FAULT` or equivalent fault isolation behavior.
- Accepted telemetry creates required reading and health records.
- Rejected telemetry creates appropriate audit or event records when expected.

## Authorization gate

- Public users can access only public-safe station data.
- Public users can submit constrained community reports.
- Public users cannot access admin routes.
- Admin routes require authenticated authorized users.
- RLS policies are enabled and tested.
- Service role keys are never exposed to client code.
- Device secrets are never exposed to client code.
- Sensitive actions are audited.

## Admin operations gate

- Station list shows status, last seen, alerts, battery, and signal.
- Filters work with keyboard and pointer.
- Threshold edits require clear intent.
- Alert triage is traceable.
- Report review preserves reporter privacy.
- Audit timeline is understandable.
- Offline and sensor fault states are prioritized clearly.

## Field pilot gate

- Station provisioning record is complete.
- Device secret is securely stored.
- Firmware version is recorded.
- Sensors are calibrated.
- QR code opens correct station page without login.
- Mobile page is readable outdoors.
- Community report flow works on mobile.
- Admin can see the station after first telemetry.
- Stale and fault simulations show correct UI states.

## Documentation gate

- `docs/README.md` reflects the current handbook structure.
- Product philosophy matches implemented UI.
- Visual direction follows `docs/VISUAL_LANGUAGE.md` and `docs/VISUAL_REFERENCES.md`.
- UI uses token values from `docs/DESIGN_TOKENS.md`.
- Reusable UI follows `docs/COMPONENT_SPECIFICATION.md`.
- Page structure follows `docs/PAGE_BLUEPRINTS.md`.
- Motion and loading follow `docs/INTERACTION_GUIDELINE.md`.
- Public and admin copy follows `docs/COPYWRITING_GUIDE.md`.
- Missing-data states follow `docs/EMPTY_STATES.md`.
- API contract matches edge ingestion behavior.
- Authorization model matches RLS and app routes.
- Pilot checklist matches actual deployment workflow.
- Known limitations are documented before demos.

## Release decision

Do not release or demo as production-quality if any of these are false:

- users can understand current water status quickly,
- stale or faulty data is clearly identified,
- public and admin access are separated,
- signed telemetry validation works,
- mobile public pages are accessible and fast,
- documentation matches the product being shown.
