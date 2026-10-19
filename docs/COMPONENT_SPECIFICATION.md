# Component Specification

## Purpose

This file translates product philosophy into implementation-level UI specifications. Use it when building reusable components. If a component is not listed here, model it after the closest existing component and document the new variant.

All components must use tokens from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md), language rules from [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md), and accessibility requirements from [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md).

## Shared component rules

- Components must be responsive from 320px upward.
- Components must expose loading, empty, error, and disabled states where relevant.
- Components must not rely on color alone.
- Components must not include one-off spacing, color, shadow, or animation values.
- Components must preserve layout dimensions during loading when possible.
- Components must keep public surfaces calmer and admin surfaces denser.

## MetricCard

### Purpose

Shows one environmental or device metric with value, unit, status, freshness, and trend.

### Anatomy

1. Label, such as `Độ mặn` or `Mực nước`.
2. Optional icon at top-right.
3. Large value with unit.
4. Status badge.
5. Trend or helper line.
6. Optional threshold line or comparison.

### Sizing and spacing

| Surface | Height | Padding | Radius | Gap |
|---------|--------|---------|--------|-----|
| Mobile public | min 132px | `space-5` | `radius-lg` | `space-3` |
| Desktop public | min 148px | `space-6` | `radius-lg` | `space-4` |
| Admin compact | min 112px | `space-4` | `radius-md` | `space-2` |

### Hierarchy

- Label: `text-sm`, muted.
- Value: `text-4xl` mobile, `text-5xl` desktop, tabular numerals.
- Unit: 40–55% of value size, aligned to baseline.
- Status badge: directly below value, never hidden in a tooltip.
- Trend: small and secondary.

### Icon placement

- Top-right only.
- Never center the icon.
- Never make the icon larger than the value.
- Decorative icons must be hidden from screen readers.

### States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for label, value, badge, and trend; preserve card height. |
| Empty | Show `Chưa có dữ liệu` and explain the expected source. |
| Healthy | Calm green badge and plain-language confirmation. |
| Watch | Amber badge and short reason. |
| Risk | Red badge, reason, and recommended action. |
| Offline | Gray badge; show last received time if known. |
| Sensor fault | Fault badge; value may be hidden or marked unreliable. |

### Interaction

- Public cards are usually not clickable unless they navigate to detail.
- Hover on desktop may use `translateY(-1px)` and `elevation-sm`.
- No bounce, flip, glow, or number-counting animation.

### Accessibility

- Metric value and unit must be read as one phrase.
- Status must include text, not color only.
- Provide a screen-reader summary when trend icon is visual.

### Do

- `Độ mặn 12.4 ppt. Cần chú ý. Gần ngưỡng an toàn.`

### Don't

- `EC anomaly critical. Value: 12.438902.`

## StationCard

**Stale as a current-component claim (Phase G correction):** `StationCard`
(`components/dashboard/station-card.tsx`) was deleted — it existed before
the Phase D redesign, was never actually imported anywhere (grep-confirmed
zero call sites), and modeled the "boxes inside boxes" pattern that pass
moved away from. See `docs/COMPONENT_ARCHITECTURE.md` for the deletion
record. The spec below is kept as historical/aspirational reference, not a
description of anything currently in the codebase — station summaries
today are rendered inline (dashboard's priority-sorted row list,
`station-detail.tsx`'s `Metric` grid), not via a dedicated card component.

### Purpose

Summarizes one monitoring station in dashboard or admin lists.

### Anatomy

1. Station name.
2. Location or area.
3. Overall status badge.
4. Last updated time.
5. Key metrics: salinity, water level, sensor health.
6. Optional alert count or report count.
7. Primary action: view station.

### Sizing and spacing

- Mobile public: full-width card, `space-5` padding, `radius-lg`.
- Desktop public: 2–3 column grid, min width 280px.
- Admin: table row preferred; card fallback below `bp-tablet`.

### Responsive behavior

- On mobile, stack metadata below station name.
- On desktop, place status on the right.
- Avoid hiding last updated time.

### States

- Loading: `SkeletonCard` with title, badge, and 3 metric placeholders.
- Empty station metrics: show station identity and `Chưa có dữ liệu đo`.
- Offline: prioritize offline badge and last seen.
- Alert: show count and highest severity reason.

### Accessibility

- Entire clickable card must have one clear accessible name.
- Nested buttons inside clickable card are not allowed.
- Status must be text visible.

## AlertCard

### Purpose

Shows one environmental, sensor, report, or operational alert.

### Anatomy

1. Severity badge.
2. Alert title.
3. Short cause.
4. Station and timestamp.
5. Recommended action.
6. Optional acknowledge or view detail action.

### Rules

- Risk alerts must be actionable, not dramatic.
- Do not use flashing or pulsing red.
- Admin alert cards may include assignment and audit state.
- Public alerts should show only safe, understandable information.

### Severity wording

- `Cần chú ý` for watch.
- `Nguy cơ cao` for risk.
- `Mất kết nối` for offline.
- `Cần kiểm tra cảm biến` for sensor fault.

## TrendChart

### Purpose

Explains environmental change over time.

### Anatomy

1. Title.
2. Time range selector when needed.
3. Chart area.
4. Threshold line and label.
5. Tooltip.
6. Text summary.
7. Empty or stale state.

### Sizing

| Surface | Height |
|---------|--------|
| Mobile station | 220–260px |
| Public dashboard | 260–320px |
| Admin detail | 280–360px |
| Dense admin table preview | 56–80px sparkline |

### Visual rules

- Grid lines are subtle.
- Axes are minimal but labeled with units.
- Threshold lines must be visible and labeled.
- Tooltips use readable text and units.
- Do not use 3D, heavy gradients, or decorative glow.

### Interaction

- Mobile tooltip should work by tap or drag.
- Desktop tooltip should work by hover and keyboard where possible.
- Time range changes should preserve chart area size.

### Empty state

Use `NoData` empty state when there are no readings. Use `Offline` or `StaleData` state when the last reading is old.

## Button

### Purpose

Triggers actions or navigation.

### Variants

| Variant | Use |
|---------|-----|
| Primary | One main action per view. |
| Secondary | Supporting action. |
| Tertiary | Low-emphasis action. |
| Destructive | Rare irreversible or high-impact action. |
| Ghost | Navigation or toolbar action only. |

### Sizing

| Size | Height | Padding | Use |
|------|--------|---------|-----|
| Small | 36px | `space-3` horizontal | Admin toolbar. |
| Medium | 44px | `space-4` horizontal | Default. |
| Large | 52px | `space-5` horizontal | Public mobile primary action. |

### Rules

- Button labels must be verbs: `Gửi báo cáo`, `Xem trạm`, `Lưu ngưỡng`.
- Preserve width while loading.
- Disabled state must not be the only way to explain missing requirements.
- Destructive actions require explicit confirmation when data is affected.

## Badge

### Purpose

Shows compact status, category, role, or severity.

### Anatomy

- Optional icon.
- Text label.
- Muted semantic background.

### Rules

- Use short text, usually 1–3 words.
- Do not use icon-only badges.
- Do not use saturated filled badges except for rare high-impact states.
- Keep badge labels consistent with [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md).

## Input

### Purpose

Collects single-line data in forms and filters.

### Anatomy

1. Visible label.
2. Input field.
3. Optional helper text.
4. Error text.

### Sizing

- Height: 44px minimum.
- Radius: `radius-sm`.
- Padding: `space-3` to `space-4`.

### Rules

- Labels never disappear into placeholder-only UI.
- Use input modes for numeric readings, phone, and email.
- Error message must explain how to fix the problem.

## Select

### Purpose

Chooses from a controlled list such as station, status, crop type, or threshold profile.

### Rules

- Use native select on simple mobile forms when possible.
- Custom select must be keyboard accessible.
- Do not hide critical filters behind icon-only controls.
- Placeholder should describe the choice: `Chọn trạng thái`, not `Select`.

## Textarea

### Purpose

Collects community report descriptions or operator notes.

### Rules

- Minimum height: 120px for reports, 88px for admin notes.
- Show character guidance when useful.
- Preserve drafts during network failure.
- Avoid technical placeholders.

## Dialog

### Purpose

Interrupts the user only for focused decisions or forms that cannot fit inline.

### Anatomy

1. Title.
2. Description.
3. Body content.
4. Primary action.
5. Secondary cancel action.

### Rules

- Avoid dialogs on farmer-facing public flows unless necessary.
- Focus moves into dialog and returns to trigger on close.
- Escape closes non-destructive dialogs.
- Destructive dialogs must clearly name the affected object.

## Toast

### Purpose

Confirms short-lived success, failure, or sync state.

### Rules

- Duration: 4–6 seconds for normal messages.
- Must not contain critical information that disappears forever.
- Use calm language: `Đã gửi báo cáo`, `Không thể lưu. Thử lại khi có mạng.`
- Position bottom on mobile, top-right on desktop admin.

## EmptyState

### Purpose

Explains why content is missing and what the user can do next.

### Anatomy

1. Optional calm illustration or icon.
2. Title.
3. Description.
4. Optional CTA.
5. Optional secondary detail.

### Rules

- No vague “Nothing here”.
- Empty state must mention the data source or next step.
- Use shared examples from [`EMPTY_STATES.md`](EMPTY_STATES.md).

## Skeleton

### Purpose

Preserves layout while data loads.

### Rules

- Match the final component shape.
- Use muted surface color.
- Pulse or shimmer at `motion-skeleton`.
- Stop animation when reduced motion is enabled.
- Do not show skeleton and stale data at the same time; prefer stale data with refresh indication.

## Navigation

### Purpose

Provides orientation and movement between major surfaces.

### Public navigation

- Keep minimal: home, dashboard, report, about.
- Do not place admin links prominently on farmer-facing surfaces.
- Mobile navigation should keep primary field actions reachable.

### Admin navigation

- Use text labels, not icon-only sidebar.
- Include stations, alerts, reports, thresholds, devices, audit, settings.
- Current section must be visually and semantically indicated.

## Bottom Navigation

### Purpose

Improves one-handed public mobile navigation.

### Items

Recommended public mobile items:

- `Trang chủ`
- `Trạm`
- `Báo cáo`
- `Thông tin`

Rules:

- Maximum 4 items.
- Labels always visible.
- Height should account for safe area.
- Do not include destructive or admin actions.