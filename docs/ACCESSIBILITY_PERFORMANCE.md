# Accessibility and Performance

## Accessibility target

Eco-Sense targets WCAG AA. Accessibility is not optional because the product serves older farmers, field workers, tourists, administrators, and evaluators using different devices and environments.

## Required accessibility behaviors

- Use semantic HTML before ARIA.
- Provide visible focus states for all interactive controls.
- Support keyboard navigation on public and admin pages.
- Use proper labels for inputs, charts, buttons, and navigation.
- Do not rely on color alone for status.
- Maintain readable contrast in sunlight.
- Keep touch targets at least 44px by 44px.
- Respect reduced-motion preferences.
- Provide useful alt text for meaningful images.
- Ensure loading, success, error, and offline states are announced where appropriate.

## Field usability

Outdoor mobile use changes design requirements.

Field-ready pages should:

- show the critical answer at the top,
- use large values and short labels,
- avoid tiny controls,
- avoid hover-only interactions,
- tolerate intermittent connectivity,
- preserve user input while network status changes,
- work on common Android browsers,
- avoid visual treatments that disappear in bright sunlight.

## Keyboard and admin workflows

Administrators may use desktop keyboards for high-volume tasks.

Admin workflows should support:

- tab order matching visual order,
- visible row and control focus,
- keyboard-operable menus and filters,
- escape to close transient UI,
- enter or space to activate controls,
- clear focus return after dialogs close,
- no keyboard traps.

## Chart accessibility

Charts must include non-visual interpretation.

Required chart support:

- A visible chart title.
- Clear units.
- Threshold labels.
- Tooltip values that are readable and keyboard accessible when possible.
- A short textual summary such as “Salinity has stayed within the safe range for 24 hours.”
- Empty state copy when there is no data.

## Performance philosophy

Performance is a design feature. A slow environmental dashboard feels unreliable even when the data is correct.

Prefer:

- skeletons,
- lazy loading,
- streaming where supported,
- caching,
- partial rendering,
- optimistic UI only when safe,
- small client bundles,
- server-side data shaping.

Avoid:

- layout shifts,
- blocking renders,
- heavy chart libraries on first load when avoidable,
- decorative animations,
- large unoptimized images,
- polling more often than necessary,
- repeated duplicate requests.

## Loading budget

Public station pages should feel useful within seconds on modest mobile hardware. The first meaningful content should be station identity, current status, and last updated time. Charts may load after primary status.

Admin pages may load more data, but must render stable navigation and table skeletons quickly.

## Data freshness

Data freshness must be visible because stale environmental data can be dangerous.

Every station surface should show:

- last reading timestamp,
- freshness status,
- sensor health,
- whether the station is offline or delayed.

Use exact times in detail views and relative time in summaries where helpful.

## Error handling

Errors should be calm and actionable.

Good errors:

- “Station has not reported in 45 minutes.”
- “Report saved on this device. It will sync when connection returns.”
- “Sensor fault detected. Readings may be unreliable.”

Poor errors:

- “Unknown error.”
- “Failed.”
- “500.”

Errors should preserve context and never erase user input unless absolutely necessary.


## Related implementation specs

Accessibility and performance rules are implemented through the rest of the handbook:

- Use token values from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).
- Use component behavior from [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md).
- Use motion and loading rules from [`INTERACTION_GUIDELINE.md`](INTERACTION_GUIDELINE.md).
- Use wording from [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md).
- Use missing-data patterns from [`EMPTY_STATES.md`](EMPTY_STATES.md).

## Quality checks before release

- Navigate all core pages using keyboard only.
- Test public station page at 320px, 375px, 390px, 430px, 768px, 1024px, and 1440px.
- Confirm status remains understandable in grayscale.
- Confirm form labels and errors are announced by screen readers where possible.
- Confirm no major layout shifts during loading.
- Confirm stale data is visible and understandable.
- Confirm reduced-motion mode removes non-essential animation.