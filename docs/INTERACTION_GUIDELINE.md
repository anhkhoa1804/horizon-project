# Interaction Guidelines

## Purpose

Interactions should make state changes understandable while keeping the product calm. Eco-Sense should feel responsive, not animated for entertainment.

Use motion tokens from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).

## Global rules

- Motion explains state changes; it does not decorate.
- Default duration is 150–250ms.
- Prefer opacity and small transform changes.
- Avoid bounce, elastic easing, flashing, glow, confetti, and spinning backgrounds.
- Respect `prefers-reduced-motion`.
- Never animate critical environmental warnings in a way that feels alarming.

## Hover

Desktop hover may be used for affordance.

| Element | Hover behavior |
|---------|----------------|
| Card link | `translateY(-1px)`, `elevation-sm`, 180ms. |
| Button | Slight background or border change, 180ms. |
| Table row | Muted surface highlight, no movement. |
| Icon button | Background circle or border, no scale above 1.02. |

Rules:

- Hover must not reveal the only way to act.
- Mobile must not depend on hover.

## Focus

Focus is functional and visible.

Rules:

- Use a clear focus ring with sufficient contrast.
- Focus should not be removed for aesthetic reasons.
- Focus order follows visual order.
- Dialogs and drawers trap focus only while open and return focus on close.

## Press and tap feedback

- Buttons may use a subtle active background or 0.98 scale.
- Do not use bounce.
- Do not delay navigation for animation.
- Touch feedback should be visible on mobile.

## Page transitions

- Public page transitions should be minimal: fade content in 120–180ms.
- Admin page transitions should prioritize speed; avoid full-page animation.
- Preserve header and navigation where possible to reduce disorientation.

## Accordions

| Property | Specification |
|----------|---------------|
| Duration | 200–220ms. |
| Easing | ease-out. |
| Animation | height or grid expansion plus opacity. |
| Icon | rotate 90 or 180 degrees. |
| Reduced motion | instant open/close or opacity only. |

Rules:

- Use accordions for secondary information, not primary status.
- The trigger must be a real button with expanded state.

## Drawer and bottom sheet

| Property | Specification |
|----------|---------------|
| Duration | 250ms. |
| Easing | cubic-bezier(0.2, 0, 0, 1). |
| Animation | slide from edge plus overlay fade. |
| Mobile use | filters, navigation, secondary actions. |

Rules:

- Avoid drawers for critical warnings.
- Bottom sheets should not cover the only visible current status unless user initiated.
- Include clear close control and escape behavior.

## Dialogs

- Open: fade overlay and scale panel from 0.98 to 1 over 200–250ms.
- Close: fade out over 120–180ms.
- Reduced motion: fade only.
- Destructive dialogs should not animate dramatically.

## Toasts

| Property | Specification |
|----------|---------------|
| Entrance | Fade and slight Y movement, 120ms. |
| Exit | Fade, 120ms. |
| Duration | 4–6 seconds. |
| Mobile position | Bottom, above bottom navigation. |
| Desktop position | Top-right or bottom-right for admin. |

Rules:

- Toasts are not a replacement for persistent error states.
- Critical station state should remain on page, not only in toast.

## Skeletons

- Use pulse or shimmer over 1.8s.
- Match final layout shape.
- Avoid skeletons for actions that can use stale data.
- Disable shimmer in reduced motion.

## Loading patterns

| Situation | Pattern |
|-----------|---------|
| First page load | Skeleton for main content. |
| Refresh existing data | Keep stale data and show small refresh indicator. |
| Form submit | Button loading state and preserve form. |
| Chart load | Chart skeleton with fixed height. |
| Admin table load | Header remains; rows become skeleton. |

## Navigation

- Public mobile navigation should keep report and station access reachable.
- Admin navigation should be stable and text-labeled.
- Current page must be clearly indicated.
- Breadcrumbs are useful in admin detail pages, not necessary on public mobile pages.

## Chart interactions

- Tooltip appears on hover, tap, or drag.
- Tooltip should not obscure the selected point on mobile.
- Time range changes should not resize the chart container.
- Threshold toggles, if present, must be labeled.
- Do not animate line drawing every time data refreshes.

## Form interactions

- Validate on blur or submit, not aggressively on every keystroke unless helpful.
- Errors appear near fields.
- Preserve entered values after failed submit.
- On success, show confirmation and next step.
- For offline reports, show saved draft and sync status.

## Reduced motion behavior

When reduced motion is enabled:

- Remove transform-based movement.
- Disable skeleton shimmer; use static or gentle opacity.
- Keep instant state changes acceptable.
- Preserve focus and visibility behavior.