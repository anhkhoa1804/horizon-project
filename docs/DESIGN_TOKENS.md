# Design Tokens

> **Superseded.** This document proposes a parallel token system (its own
> color palette, `text-xs`…`text-6xl` scale, `elevation-*` shadows,
> `MetricCard`/`Dialog`/`Toast` components) that was never implemented and
> does not match the live product. The actual, source-verified token system
> — color/radius/shadow/motion/z-index in `apps/web/app/globals.css`, plus
> the typography and spacing scales added on top of it — is documented in
> `docs/REDESIGN_SPECIFICATION.md` §4/§7, which is the current
> design-direction authority. Kept here for historical reference only; do
> not implement against this file.

## Purpose

Tokens are implementation defaults for Eco-Sense UI. They prevent each engineer or AI agent from inventing spacing, color, shadow, motion, or layout rules differently.

If a component needs a value not listed here, first ask whether the component is too custom. Add a token only when the need repeats across the product.

## Spacing scale

Use this scale for padding, margin, gaps, chart inset, and layout rhythm.

| Token | Value | Use |
|-------|-------|-----|
| `space-0` | 0px | Reset only. |
| `space-1` | 4px | Tight icon-label gaps, dense table internals. |
| `space-2` | 8px | Small gaps, badge padding, compact rows. |
| `space-3` | 12px | Form helper gaps, small card internals. |
| `space-4` | 16px | Default mobile card padding and section gaps. |
| `space-5` | 20px | Public mobile card padding. |
| `space-6` | 24px | Desktop card padding, page section gaps. |
| `space-8` | 32px | Major groups, public page modules. |
| `space-10` | 40px | Hero internals, large page breaks. |
| `space-12` | 48px | Section separation on tablet and desktop. |
| `space-16` | 64px | Landing page section separation. |
| `space-20` | 80px | Rare large desktop hero spacing. |

Rules:

- Public mobile cards default to `space-5` padding.
- Admin cards default to `space-4` or `space-5` padding.
- Do not use arbitrary spacing such as 13px, 27px, or 58px.
- Reduce spacing before reducing font size on small screens.

## Responsive breakpoints

Design from the smallest width upward.

| Token | Width | Meaning |
|-------|-------|---------|
| `bp-xs` | 320px | Small Android baseline. |
| `bp-sm` | 375px | Common phone baseline. |
| `bp-md-phone` | 390px | Modern phone baseline. |
| `bp-lg-phone` | 430px | Large phone baseline. |
| `bp-tablet` | 768px | Tablet and small admin layouts. |
| `bp-laptop` | 1024px | Admin desktop baseline. |
| `bp-desktop` | 1440px | Wide dashboard and presentation layout. |

Rules:

- Public station pages must be complete at `bp-xs`.
- Admin tables may transform into cards below `bp-tablet`.
- Never design desktop first and shrink down.

## Layout widths

| Token | Value | Use |
|-------|-------|-----|
| `content-narrow` | 640px | Forms, report flow, login. |
| `content-readable` | 760px | Long documentation-like public content. |
| `content-public` | 1120px | Public dashboard and landing sections. |
| `content-admin` | 1280px | Admin console content. |
| `content-wide` | 1440px | Dense operational overview. |

Rules:

- Long text should not span the full viewport on desktop.
- Admin pages may use wider layouts, but the primary action area must remain visually grouped.

## Typography scale

Use a readable sans-serif. Prefer system font stacks unless brand typography is intentionally introduced.

| Token | Size | Line height | Weight | Use |
|-------|------|-------------|--------|-----|
| `text-xs` | 12px | 16px | 400–500 | Metadata, table secondary text. |
| `text-sm` | 14px | 20px | 400–500 | Admin body, labels, helper text. |
| `text-md` | 16px | 24px | 400–500 | Public body default, form inputs. |
| `text-lg` | 18px | 28px | 500 | Public lead, card emphasis. |
| `text-xl` | 20px | 28px | 600 | Card title, section title. |
| `text-2xl` | 24px | 32px | 600 | Mobile page heading. |
| `text-3xl` | 32px | 40px | 650 | Public status headline. |
| `text-4xl` | 40px | 48px | 650 | Metric value on mobile and tablet. |
| `text-5xl` | 48px | 56px | 650 | Hero metric on desktop. |
| `text-6xl` | 64px | 72px | 650 | Rare landing hero number. |

Rules:

- Public mobile body text must not go below `text-md`.
- Admin dense text may use `text-sm`, but interactive controls still need usable height.
- Measurement values should use tabular numerals.
- Avoid all-caps labels except short badges with letter spacing.

## Radius scale

| Token | Value | Use |
|-------|-------|-----|
| `radius-xs` | 6px | Badges, small inputs. |
| `radius-sm` | 10px | Buttons, form fields. |
| `radius-md` | 14px | Compact cards, popovers. |
| `radius-lg` | 18px | Public cards, metric cards. |
| `radius-xl` | 24px | Hero panels, large mobile modules. |
| `radius-full` | 999px | Pills, circular controls. |

Rules:

- Metric cards use `radius-lg`.
- Admin tables use `radius-md` on the containing panel, not every row.
- Do not mix many radius values in the same view.

## Elevation and borders

Eco-Sense should feel stable, not floaty. Prefer subtle borders over heavy shadows.

| Token | Border | Shadow | Use |
|-------|--------|--------|-----|
| `elevation-flat` | 1px solid neutral border | none | Tables, simple cards. |
| `elevation-xs` | 1px solid neutral border | `0 1px 2px rgb(15 23 42 / 0.04)` | Buttons, small cards. |
| `elevation-sm` | 1px solid neutral border | `0 4px 12px rgb(15 23 42 / 0.06)` | Hovered cards, popovers. |
| `elevation-md` | 1px solid neutral border | `0 12px 32px rgb(15 23 42 / 0.10)` | Dialogs, drawers. |
| `elevation-lg` | none or subtle border | `0 24px 64px rgb(15 23 42 / 0.14)` | Rare modal emphasis only. |

Rules:

- Default cards should use `elevation-flat` or `elevation-xs`.
- Hover may move from `elevation-xs` to `elevation-sm`.
- Do not use dramatic shadows on environmental data cards.

## Color tokens

Use semantic tokens in components. Do not hard-code raw colors in reusable UI.

### Neutral tokens

| Token | Suggested value | Use |
|-------|-----------------|-----|
| `color-bg` | `#F8FAF7` | App background. |
| `color-surface` | `#FFFFFF` | Cards, panels. |
| `color-surface-muted` | `#F1F5F2` | Secondary panels, skeleton base. |
| `color-border` | `#DDE5DE` | Default border. |
| `color-border-strong` | `#B8C7BA` | Focus-adjacent structural border. |
| `color-text` | `#142019` | Primary text. |
| `color-text-muted` | `#526158` | Secondary text. |
| `color-text-subtle` | `#6F7D73` | Metadata. |

### Environmental status tokens

| Token | Suggested value | Use |
|-------|-----------------|-----|
| `color-healthy` | `#1F8A4C` | Healthy status. |
| `color-healthy-bg` | `#E8F6EE` | Healthy badge background. |
| `color-watch` | `#A96800` | Watch status. |
| `color-watch-bg` | `#FFF4D8` | Watch badge background. |
| `color-risk` | `#B42318` | Risk status. |
| `color-risk-bg` | `#FDE7E4` | Risk badge background. |
| `color-offline` | `#5E6670` | Offline status. |
| `color-offline-bg` | `#ECEFF2` | Offline badge background. |
| `color-fault` | `#8A3FFC` | Sensor fault status. |
| `color-fault-bg` | `#F0E8FF` | Sensor fault badge background. |

### Data visualization tokens

| Token | Suggested value | Use |
|-------|-----------------|-----|
| `color-salinity` | `#0F8B8D` | Salinity series. |
| `color-water-level` | `#2563EB` | Water level series. |
| `color-temperature` | `#D97706` | Temperature series if added. |
| `color-threshold` | `#B42318` | Critical threshold line. |
| `color-grid` | `#DDE5DE` | Chart grid line at low opacity. |

Rules:

- Use muted backgrounds for badges; avoid saturated filled pills.
- Risk red must be clear but not alarming unless action is required.
- Charts should use no more than 3 primary series colors in one view.

## Motion tokens

| Token | Duration | Easing | Use |
|-------|----------|--------|-----|
| `motion-fast` | 120ms | ease-out | Toast fade, small opacity changes. |
| `motion-base` | 180ms | ease-out | Hover, focus, button feedback. |
| `motion-medium` | 220ms | ease-out | Accordion, small panels. |
| `motion-slow` | 250ms | cubic-bezier(0.2, 0, 0, 1) | Drawer, dialog entrance. |
| `motion-skeleton` | 1800ms | linear | Skeleton shimmer or pulse. |

Rules:

- Do not exceed 250ms for routine UI transitions.
- Use opacity and transform before animating layout properties.
- Reduced motion must remove transform and keep simple opacity changes.

## Z-index scale

| Token | Value | Use |
|-------|-------|-----|
| `z-base` | 0 | Normal page content. |
| `z-sticky` | 20 | Sticky header, sticky table column. |
| `z-dropdown` | 40 | Select menu, dropdown menu. |
| `z-popover` | 50 | Tooltip, hover card. |
| `z-toast` | 70 | Toast notifications. |
| `z-drawer` | 80 | Mobile drawer, side panel. |
| `z-modal` | 90 | Modal dialog overlay. |
| `z-critical` | 100 | Rare blocking system alert. |

Rules:

- Do not invent z-index values like 9999.
- If a component needs `z-critical`, it probably needs product review.

## Component defaults

| Component | Padding | Radius | Elevation | Motion |
|-----------|---------|--------|-----------|--------|
| `MetricCard` | `space-5` mobile, `space-6` desktop | `radius-lg` | `elevation-xs` | `motion-base` hover only. |
| `StationCard` *(deleted — see `docs/COMPONENT_ARCHITECTURE.md`; row kept as historical reference only)* | `space-4` mobile, `space-5` desktop | `radius-lg` | `elevation-xs` | `motion-base` hover only. |
| `AlertCard` | `space-4` | `radius-md` | `elevation-flat` | none by default. |
| `Button` | horizontal `space-4` to `space-5` | `radius-sm` | `elevation-xs` for primary | `motion-base`. |
| `Dialog` | `space-6` | `radius-lg` | `elevation-md` | `motion-slow`. |
| `Toast` | `space-4` | `radius-md` | `elevation-sm` | `motion-fast`. |