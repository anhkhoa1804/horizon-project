# UX Principles

## Interface philosophy

The interface should disappear. Users should notice the water, the station, the trend, and the recommended action—not the UI chrome.

Every component must have a reason to exist. Decoration is allowed only when it improves comprehension, orientation, trust, or emotional calm.

## Mobile-first behavior

Design starts at 320px, then expands through 375px, 390px, 430px, 768px, 1024px, and 1440px. Desktop is an enhancement, not the starting point.

Mobile requirements:

- Primary actions should be reachable with one hand.
- Touch targets should be at least 44px by 44px, with generous spacing outdoors.
- Critical status should appear before charts or secondary explanation.
- Dense tables should collapse into cards or summaries on small screens.
- Text should remain readable in bright sunlight.

## Public pages

Public pages are for farmers, tourists, community members, judges, and visitors. They should be beautiful, simple, storytelling-oriented, and low-control.

Public pages should prioritize:

- current station status,
- simple health interpretation,
- recent trend chart,
- last updated time,
- sensor health,
- concise explanation of salinity and water level,
- QR-friendly station identity,
- community report entry points.

Avoid public-page complexity:

- raw database terminology,
- dense filters,
- configuration controls,
- admin-only metrics,
- unexplained abbreviations,
- chart overload.

## Station QR experience

The station page is the most important public surface. A person standing near a pond should scan a QR code and see the answer immediately.

Required page hierarchy:

1. Station name and last updated time.
2. Overall environmental state in plain language.
3. Salinity and water-level status cards.
4. Sensor health and data freshness.
5. Recent trend chart.
6. Explanation and recommended next step.
7. Report problem action.

Use plain language such as “Ổn định”, “Cần chú ý”, or “Nguy cơ cao” rather than only technical labels. If English UI is present, use “Stable”, “Watch”, and “High risk”.

## Admin pages

Administrator pages are operational tools. They can be denser, but must remain predictable and calm.

Admin pages should prioritize:

- station list with status, last seen, alert count, and health,
- filtering by status, region, freshness, and issue type,
- clear threshold configuration,
- alert triage workflows,
- audit history,
- keyboard navigation,
- stable tables with persistent columns.

Admin pages must avoid:

- public storytelling layout,
- oversized marketing typography,
- hidden destructive actions,
- ambiguous alert severity,
- color-only status indicators.

## Public versus admin distinction

Do not mix the two design languages.

| Surface | Primary goal | Density | Controls | Tone |
|---------|--------------|---------|----------|------|
| Public | Understand quickly | Low | Minimal | Storytelling, calm, reassuring |
| QR station | Decide immediately | Low | One or two actions | Direct, field-ready |
| Report | Submit safely | Low | Guided form | Supportive, forgiving |
| Admin | Operate efficiently | Medium-high | Filters, tables, config | Precise, professional |

## Status communication

Status must be communicated through label, shape, icon, and copy—not color alone.

Recommended status model:

- **Healthy:** data is fresh, readings are within safe thresholds, sensors are OK.
- **Watch:** readings are near threshold, stale, or a sensor is warning.
- **Risk:** readings exceed threshold or dangerous trend is detected.
- **Offline:** station has not reported within the expected interval.
- **Sensor fault:** environmental readings may be unreliable.

Every non-healthy status should answer “what should the user do next?”

## Charts philosophy

Charts exist to explain trends, not to impress.

Chart requirements:

- Subtle grid lines.
- Minimal axes.
- Readable tooltips.
- Meaningful colors.
- Threshold lines when thresholds matter.
- Empty states explaining why data is unavailable.
- Accessible summaries for screen readers.
- No 3D charts, decorative gradients, or overly saturated palettes.

For farmers, charts should support the status message rather than replace it.

## Motion philosophy

Animation should explain state changes. It should never be decorative noise.

Use motion for:

- loading transitions,
- success feedback,
- expanding or collapsing sections,
- navigation continuity,
- focus and selection.

Avoid:

- bouncing,
- flashing,
- spinning backgrounds,
- long easing curves,
- animated decorations unrelated to state.

Default duration should be 150–250ms. Respect reduced-motion preferences.

## Loading and empty states

Loading states should preserve layout and reduce anxiety.

- Use skeletons for cards, charts, and tables.
- Avoid full-page spinners unless no structure is known.
- Show partial data as soon as safe.
- Explain stale data clearly.

Empty states should be useful:

- “No readings received in the last 24 hours.”
- “This station has not reported since 08:30.”
- “No community reports match this filter.”

Do not use vague empty states like “Nothing here”.

## Writing style

Use simple, calm, direct language.

Good:

- “Water is stable.”
- “Sensor has not reported for 45 minutes.”
- “Salinity is above the safe range.”
- “Submit a community report.”

Avoid:

- “Telemetry anomaly detected.”
- “Critical data stream failure.”
- “Something went wrong.”
- unexplained acronyms.
## Implementation references

Use these documents when turning principles into UI:

- [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md) defines screen order and layout.
- [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md) defines component anatomy and states.
- [`INTERACTION_GUIDELINE.md`](INTERACTION_GUIDELINE.md) defines exact motion behavior.
- [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) defines public and admin wording.
- [`EMPTY_STATES.md`](EMPTY_STATES.md) defines missing-data states.