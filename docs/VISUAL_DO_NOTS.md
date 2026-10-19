# Visual Do Nots

## Purpose

This file blocks common AI and developer mistakes. Eco-Sense should be calm, trustworthy, accessible, and field-ready. Do not “improve” the interface by adding fashionable visuals that weaken clarity.

If a pattern is listed here, do not use it unless the handbook is explicitly updated with a justified exception.

## Never do these

- Do not use neon gradients.
- Do not use cyberpunk colors.
- Do not use glassmorphism as a primary style.
- Do not use heavy blur panels behind important data.
- Do not use dramatic shadows.
- Do not use bouncing animation.
- Do not use confetti.
- Do not use flashing alerts.
- Do not use spinning decorative backgrounds.
- Do not use animated waves behind charts.
- Do not use 3D charts.
- Do not use chart glow effects.
- Do not use color-only status indicators.
- Do not hide sensor health.
- Do not show stale data as current.
- Do not show a healthy state when sensors are faulty.
- Do not require login for public station pages.
- Do not bury report actions in desktop-style navigation on mobile.
- Do not create multiple competing primary buttons.
- Do not use icon-only admin navigation by default.
- Do not hide row actions behind hover only.
- Do not remove focus rings.
- Do not make touch targets smaller than 44px.
- Do not use placeholder-only form labels.
- Do not erase form input on network failure.
- Do not use generic “Unknown error” copy.
- Do not use random spacing values.
- Do not invent new colors outside tokens for reusable UI.
- Do not invent new z-index values like 9999.
- Do not add dependencies just for visual flair.

## Visual style mistakes

### Gradients

Do not use gradients as default backgrounds for cards, metric panels, admin surfaces, or charts.

Allowed only when:

- the gradient is subtle,
- it does not reduce contrast,
- it does not compete with data,
- it has a documented product reason.

Never use:

- neon green-to-cyan gradients,
- purple-blue crypto gradients,
- rainbow environmental charts without legend,
- animated gradient backgrounds.

### Glassmorphism

Do not use translucent glass panels for environmental readings. They reduce readability in sunlight and often look like generic SaaS templates.

Use solid surfaces with subtle borders instead.

### Shadows

Do not use shadows that make cards look like floating tiles. Eco-Sense should feel stable.

Avoid:

- large blurred shadows on every card,
- black shadows with high opacity,
- layered shadows on dense admin pages.

Use documented elevation tokens only.

### Borders

Do not add borders everywhere to compensate for weak hierarchy. Use spacing and typography first.

Avoid:

- nested bordered boxes inside cards,
- heavy black borders,
- inconsistent border colors.

## Color mistakes

- Do not make every metric card a different color.
- Do not use saturated red for non-critical states.
- Do not use yellow text on light background.
- Do not use pale gray text for important values.
- Do not use green to mean both salinity and healthy status in the same context without labels.
- Do not use environmental colors without legends in charts.
- Do not create dark mode unless the design system explicitly defines it.

## Typography mistakes

- Do not use tiny text on public mobile pages.
- Do not use decorative fonts.
- Do not use all-caps paragraphs.
- Do not use overly light font weights for data.
- Do not display too many numeric precisions.
- Do not use technical abbreviations in public UI without explanation.

Bad public labels:

- `EC Probe Telemetry`
- `RSSI`
- `Payload Timestamp`
- `Anomaly`

Use instead:

- `Độ mặn`
- `Tín hiệu`
- `Cập nhật lần cuối`
- `Cần chú ý`

## Layout mistakes

- Do not design desktop first and shrink to mobile.
- Do not put the main station status below charts or marketing copy.
- Do not place the report CTA only in the top navigation.
- Do not make admin pages look like landing pages.
- Do not make public pages look like admin tables.
- Do not stretch long text across wide desktop screens.
- Do not use horizontal scroll on public mobile pages.
- Do not create equal visual priority for healthy and risk stations.

## Component mistakes

### Metric cards

- Do not center everything vertically like a poster.
- Do not put icons in the center.
- Do not hide units.
- Do not animate numbers counting up.
- Do not show unreliable sensor values without a fault label.

### Buttons

- Do not use vague labels like `OK`, `Submit`, or `Click here`.
- Do not make destructive buttons look like primary safe actions.
- Do not use scale or bounce effects beyond subtle press feedback.

### Forms

- Do not require unnecessary fields in community reports.
- Do not ask public users to understand internal station IDs unless QR context is unavailable.
- Do not show validation errors only after clearing the form.

### Tables

- Do not rely on hover-only controls.
- Do not truncate critical status without tooltip or expansion.
- Do not put too many badges in one cell.
- Do not use dense tables on public mobile pages.

### Charts

- Do not use charts to impress.
- Do not omit units.
- Do not omit threshold labels when thresholds matter.
- Do not animate line drawing on every refresh.
- Do not show a chart with no explanation for empty data.

## Motion mistakes

- Do not bounce.
- Do not use springy playful transitions.
- Do not animate environmental warnings repeatedly.
- Do not use loading spinners when skeleton structure is known.
- Do not delay user action for animation.
- Do not ignore reduced-motion preferences.

## Copy mistakes

Avoid public copy such as:

- `Telemetry anomaly detected.`
- `Fatal sensor failure.`
- `Critical infrastructure exception.`
- `No records found.`
- `Submit ticket.`
- `Payload rejected.`

Use calm, actionable copy:

- `Cần chú ý.`
- `Cần kiểm tra cảm biến.`
- `Chưa có dữ liệu.`
- `Gửi báo cáo.`
- `Trạm đang mất kết nối.`

## AI-specific warnings

AI agents often over-design. Do not let an agent:

- add decorative gradients because the page feels empty,
- add animation because the UI feels static,
- create new component variants instead of using documented ones,
- invent a new color palette,
- create dashboard widgets that are not in the page blueprint,
- turn public pages into technical demos,
- add marketing sections before the user’s environmental answer,
- replace calm Vietnamese copy with generic English SaaS wording,
- optimize for screenshot beauty over field usability.

## Final rule

If a visual idea does not improve clarity, trust, accessibility, speed, or operational confidence, do not add it.