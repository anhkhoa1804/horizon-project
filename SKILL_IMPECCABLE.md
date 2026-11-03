# HORIZON Interface Standards

Use these rules when creating or refining any HORIZON web interface. HORIZON is a field-monitoring product used in bright, humid, low-connectivity settings; the design must make measurements, their source, and their limits easy to read without overstating what the system knows.

## Design philosophy

- Keep the interface product-specific: field notes, environmental instruments, local geography, and clear data provenance are the visual vocabulary.
- Avoid generic AI/SaaS decoration: meaningless purple/pink gradients, glass effects, hazy borders, diffuse shadows, excessive radii, and decorative animation.
- Prefer clear surfaces, deliberate alignment, restrained elevation, strong type hierarchy, and useful whitespace. A border or shadow is enough; do not stack both by default.
- Do not turn every content region into a nested card. Use cards only when grouping materially improves scanning or interaction.

## Palette and semantics (60–30–10)

- Approximately 60% of the screen is a quiet neutral canvas: Slate-50 in light contexts and Zinc-900 / graphite in dark contexts.
- Approximately 30% is clean display surface: white in light mode; dark slate/graphite with a subtle 1px boundary in dark mode.
- Reserve approximately 10% for meaning and interaction. Do not spend semantic color as decoration.
- Semantic reference hues: safe/fresh water Emerald-500 `#10B981`; early warning Amber-500 `#F59E0B`; danger/close-gate Rose-600 `#E11D48`. Pair small text with contrast-safe foregrounds; the bright reference hue is not automatically a readable text color.
- HORIZON brand green and orange identify the project, not environmental status. Use the semantic status tokens for status, and preserve icon/text cues so color is never the only signal.
- Never invent an operational threshold or gate action. Water salinity (`‰`) is not ECw (`dS/m`); bulk soil EC is not ECe. A salinity status/recommendation may appear only when a validated, active project rule explicitly supports it. Reference values must remain labelled as references.

## Spacing and type

- Use a 4px/8px spacing rhythm (`p-4`, `p-6`, `gap-4`, etc.) and existing layout tokens before arbitrary values.
- Use the existing typography and width tokens. Keep prose comfortably readable; headings must state the section's subject without redundant eyebrow/lead layers.
- Measurements use the approved data/monospace face, tabular numerals, and a prominent but balanced size (`text-2xl`–`text-4xl`, semibold). Monospace is for measurements and code, not as a generic “technical” costume.
- Distinguish primary measurements from secondary device/context details through hierarchy and placement, not competing status colors.

## Mobile-first field UX

- Build and verify the narrow layout first. Prevent horizontal overflow, clipped values, and controls that are hard to reach.
- Interactive touch targets are at least 44×44 CSS px, with visible keyboard focus and meaningful accessible names.
- Keep contrast high enough for outdoor reading: body/placeholder text at least 4.5:1 and large text at least 3:1. Preserve non-color status labels.
- Empty, offline, stale, loading, error, and demo states must be explicit. Never render `null`/`NaN`, and never say data is queued locally unless firmware/backend actually reports that state.
- Keep English and Vietnamese versions equivalent in meaning and hierarchy; check both for overflow and line wrapping.

## Data and action integrity

- Preserve the distinction between unavailable and zero, measurement time and receipt time, device identity and gateway identity, and station telemetry versus regional external context.
- A request to color a threshold does not authorize adding a hard-coded threshold. Read the threshold registry and its validation status first.
- Do not turn a measurement into an instruction to open/close a gate unless an active, validated operational rule explicitly defines that action.

## Verification

- Inspect changed screens at desktop and mobile widths, including real data, no-data/offline, error, and demo states where available.
- Run the repository's web lint/typecheck/build checks after interface changes.
- Do not alter unrelated files or claim field/firmware verification from browser previews.
