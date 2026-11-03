# Design System

## Purpose

The Eco-Sense design system turns product philosophy into repeatable implementation rules. It exists so every page feels like the same calm environmental platform, whether built by a human engineer or an AI coding agent.

This file defines governance and system structure. Concrete values and component specs live in dedicated documents:

- [`VISUAL_LANGUAGE.md`](VISUAL_LANGUAGE.md) for visual direction.
- [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) for numeric implementation values.
- [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md) for reusable UI components.
- [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md) for screen hierarchy.
- [`INTERACTION_GUIDELINE.md`](INTERACTION_GUIDELINE.md) for motion and state changes.
- [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) for language.
- [`EMPTY_STATES.md`](EMPTY_STATES.md) for missing-data and offline states.

## System principles

- **Use tokens first:** no arbitrary spacing, color, radius, shadow, z-index, or motion values in reusable UI.
- **Use components first:** do not duplicate MetricCard, StatusBadge, DataTable, EmptyState, Skeleton, or form controls.
- **Separate public and admin:** public pages are simple and explanatory; admin pages are denser and operational.
- **Preserve data trust:** stale, missing, or faulty readings must change the UI state and copy.
- **Design from mobile upward:** 320px is a real target, not an afterthought.
- **Accessibility is part of the component contract:** every component needs keyboard, focus, label, and contrast behavior.

## Component ownership

A component belongs in the design system when it is reused or represents product logic.

System components include (note: `StationCard` was deleted in the Phase D
redesign, never having been imported anywhere — see
`docs/COMPONENT_ARCHITECTURE.md`; kept in this list only as historical
reference, not a current component):

- `StatusBadge`
- `MetricCard`
- `StationCard`
- `AlertCard`
- `TrendChart`
- `ThresholdIndicator`
- `Button`
- `Input`
- `Select`
- `Textarea`
- `Dialog`
- `Toast`
- `EmptyState`
- `Skeleton`
- `Navigation`
- `BottomNavigation`
- `DataTable`
- `AuditTimeline`

Do not create page-local variants of these components unless the variant is documented and intentionally added back to the system.

## Variant rules

Variants should be explicit and named by purpose, not by appearance.

Good variant names:

- `public`
- `admin`
- `compact`
- `risk`
- `offline`
- `loading`
- `fault`

Avoid variant names:

- `green`
- `big`
- `fancy`
- `newStyle`
- `v2`

## Status model

All status UI must use the shared status model:

| Status | Meaning | UI implication |
|--------|---------|----------------|
| `healthy` | Fresh data, safe readings, sensors OK. | Calm confirmation. |
| `watch` | Near threshold, delayed, or warning. | Amber label and reason. |
| `risk` | Threshold exceeded or dangerous trend. | Red label and recommended action. |
| `offline` | Station has not reported on time. | No confident current environmental judgment. |
| `fault` | Sensor reports unreliable data. | Prioritize maintenance and trust warning. |
| `empty` | No data exists yet. | Explain source and next step. |

Status must be expressed through text, color, icon/shape, and copy. Never use color alone.

## Adding a component

Before adding a new component, document:

- purpose,
- anatomy,
- tokens used,
- variants,
- responsive behavior,
- loading state,
- empty state,
- error state,
- accessibility behavior,
- interaction rules,
- do/don't examples.

If the component cannot be described this way, it is probably too vague or too custom.

## Changing tokens

Token changes affect the whole product. Before changing a token:

1. Identify every component affected.
2. Confirm public mobile readability remains strong.
3. Confirm admin density remains usable.
4. Confirm WCAG AA contrast where color is involved.
5. Update screenshots or visual QA notes if they exist.

## Implementation quality bar

A feature is design-system-compliant only if:

- it uses documented tokens,
- it uses or extends documented components,
- it follows the correct page blueprint,
- it includes loading, empty, error, stale, and offline behavior where relevant,
- it uses approved terminology,
- it works with keyboard and screen readers,
- it remains clear at 320px.