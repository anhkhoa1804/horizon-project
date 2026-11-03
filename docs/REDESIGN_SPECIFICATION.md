# HORIZON Redesign Specification

**Status: the primary source of truth for the frontend redesign.** Supersedes
this document's own earlier draft, which was written before the Phase D
implementation pass and is now factually wrong in several places (it
described the homepage map as "an abstract gradient illustration" and
elsewhere as "a real photo-based map image" — it is neither; it's a real,
interactive Leaflet map today). This version was written by reading the
current source directly — every claim below cites the file it comes from.

Nothing in this document has been implemented yet **for the items in
§12's phased plan**. Where a principle below is already true in the live
product, it says so explicitly, so this document doesn't get stale the
same way its predecessor did.

**Phase R16 update — how to read this document now:** §24 (bottom of this
document) is the current, authoritative art direction — brand personality,
visual signature, color system, typography stance, shape/illustration
language, motion vocabulary, data-viz and map treatment, logo usage,
negative rules, and the final "is this Horizon" test. It was written after
direct inspection of the repository's actual logo asset (`logo.png` — a
hand-drawn, tropical, character-driven mark, not the abstract wordmark
this document originally assumed).

**Everything else in §1–§21 remains current and unchanged** — type/spacing
scales, surface/nesting rules, layout grid, navigation structure,
component inventory, data-honesty invariants, accessibility requirements,
page blueprints — **except** the specific passages in §2, §5, §18, and §21
that describe the *old* brand/color direction. Those passages have been
removed from the active text and replaced with a one-line pointer to
§24; their original wording is preserved verbatim in **Appendix H**
(end of document) for audit-trail context only. **Appendix H is not
current guidance — do not implement against it.**

An implementation agent only ever needs two things to be unambiguous:
read §1–§21 (minus the pointer notes) plus §24 for current direction;
never open Appendix H unless you're curious why something changed.

---

## 1. Design objective

Make HORIZON's frontend visually coherent with itself. The backend/data
layer is honest and correct (no fabricated data anywhere, verified across
three prior phases). The problem is not "make it modern" — it's that two
incompatible visual languages currently coexist in one product: a
deliberately-redesigned "no boxes, rule-separated" public surface, and an
untouched "everything in a bordered card, sometimes nested" admin surface.
Closing that gap, plus adding the two structural tokens that were never
built (spacing scale, admin shell), is most of the actual work.

## 2. Product character

**Current direction: see §24.1.** (Original pre-R16 reasoning preserved
verbatim in Appendix H for context — not current guidance.)

## 3. Visual principles

1. **Provenance is part of the data, not a UI nicety.** A number's age and
   trust level are as important as the number itself — this is already the
   product's stated philosophy (`docs/ARCHITECTURE.md`'s freshness/quality
   two-axis model) and is already implemented in `StatusIndicator`/
   `QualityIndicator`. Every new surface must use it, not reinvent it.
2. **The map and the real numbers are the only decoration.** No abstract
   illustration competes with them — already true (`StationNetworkMap` is
   real, `page.tsx`/`dashboard/page.tsx` both render it against live
   coordinates). Keep this discipline; do not add decorative panels.
3. **One container language, applied everywhere, including admin.** Public
   pages already prove the "borders + rules, not boxes" pattern works
   (`station-detail.tsx`'s own comment: "Bare metric grid... matches the
   dashboard's global-status pattern"). Admin must adopt the same language,
   not a parallel one.
4. **Two densities, one token set.** Public stays large-type, generous,
   one-idea-at-a-time. Admin gets tighter spacing and tabular data — same
   colors, same radius scale, same motion, different density, never a
   different visual grammar.
5. **Restraint over decoration.** Borders as the default separator, not
   shadows. Shadow reserved for true overlays (dropdowns, modals) sitting
   above the page's own stacking context — this is already `globals.css`'s
   stated intent (`--shadow-xs/sm` used for "subtle borders over dramatic
   shadows") but is inconsistently followed (see §6).

## 4. Typography hierarchy

**Currently missing entirely as a token — this is a real gap, not a
polish item.** `globals.css`'s `@theme` block has color, radius, shadow,
motion, and z-index tokens but zero font-size tokens. Every heading size
today is a hand-picked Tailwind class per call site: homepage h2 is
`text-4xl md:text-6xl` (`page.tsx:165`), about page's equivalent is
`text-3xl md:text-4xl` (`about/page.tsx:55`), dashboard's h1 is `text-2xl`
(`dashboard/page.tsx:113`), admin's h1 is `text-3xl` (`admin/page.tsx:438`).
None of these are wrong in isolation; there's just no rule connecting them.

**Target scale** (add as CSS custom properties in `globals.css`'s `@theme`
block, next to the existing radius/shadow tokens):

| Token | Size | Usage |
|---|---|---|
| `--text-eyebrow` | 11px, uppercase, `tracking-[0.2em]+` | Section/page eyebrows — already the de facto pattern everywhere, just not tokenized |
| `--text-display` | 40–56px (`text-4xl md:text-6xl`) | Homepage/about hero only — marketing-register pages |
| `--text-h1` | 24–28px (`text-2xl md:text-3xl`) | Tool-register page titles (dashboard, station detail, admin) |
| `--text-h2` | 20–22px | Section titles (what `SectionHeader` already renders) |
| `--text-body` | 16px, line-height 1.6+ | Public body copy — outdoor mobile reading |
| `--text-body-dense` | 14px | Admin body/table copy |
| `--text-caption` | 12–13px | Metadata, timestamps |

**Rule:** the homepage and `/about` are the only two pages allowed to use
`--text-display` — everything else (including their own non-hero sections)
uses `--text-h1`/`--text-h2`. This single rule would have prevented the
current drift.

## 5. Color philosophy

**Current direction: see §24.3.** (Original pre-R16 reasoning preserved
verbatim in Appendix H for context — not current guidance.) The semantic
status palette itself — five states, `Badge`/`StatusIndicator` scope, the
admin `Badge`-misuse fix (already implemented in R8) — is unchanged and
still governed by System 1 in §24.3.

## 6. Surface philosophy

**The core inconsistency this redesign must resolve.** Three different
container treatments currently exist for conceptually similar "boxed
content":

| Component | Radius | Background | Shadow |
|---|---|---|---|
| `Card` | `rounded-lg` (18px) | `bg-card` | `shadow-xs` |
| `EmptyState` | `rounded-xl` (24px) | `bg-muted/20` | `shadow-xs` |
| `EmptyState`'s icon well | `rounded-2xl` (16px, **off the token scale entirely**) | `bg-background` | none |

**Rule going forward:** `EmptyState` composes `Card` (or a shared base),
not its own bespoke treatment. Nothing renders at `rounded-2xl` — it
doesn't exist on the token scale and never should.

**The bigger issue is structural, not just a radius mismatch:** public
pages deliberately don't use `Card` for data listings (rule-separated rows
instead — correct, keep it). Admin uses `Card` for *everything*, including
nesting a second bordered box inside a `CardContent` in three separate
places (`admin/page.tsx:588`, `:650`, and the notification dropdown's
report items at `:470`). **Rule:** a `Card` never contains another
bordered/shadowed container as a direct child. If a section needs internal
grouping, use spacing and a rule (border-top), not a nested box.

## 7. Spacing philosophy

**Currently unenforced — the second structural gap.** No spacing tokens
exist; every page picks `mt-20`, `gap-12`, `space-y-8`, `space-y-10`,
`space-y-6` independently. They look similar by convention, not by system.

**Target scale**, matching the existing radius/shadow token pattern (add
to `globals.css`): `4, 8, 12, 16, 24, 32, 48, 64, 96px`. Public
marketing-register pages (`/`, `/about`) default to the top of the range
between major sections (currently `mt-20` = 80px — close enough, round to
96px or 64px, pick one and use it everywhere instead of `mt-20`
specifically). Tool-register pages (`/dashboard`, `/s/[id]`, `/admin`)
default to the middle (24–32px between sections). Nothing outside this
scale, including inside admin's forms.

## 8. Layout/grid philosophy

Already reasonably consistent and worth keeping: `max-w-7xl` for public
pages via `PublicShell`, asymmetric hero grids (`lg:grid-cols-[1.05fr_0.95fr]`)
repeated across `/`, `/about` — keep this pattern, it's a real, deliberate
rhythm, not an accident. Admin currently uses a completely different,
narrower `max-w-5xl` with no shell — this either needs to adopt
`PublicShell`'s grid logic via a new `AdminShell`, or explicitly justify
staying narrower (dense operational data can reasonably want less line
length). Recommendation: give admin its own `max-w-6xl` via `AdminShell`,
not `PublicShell` verbatim — it's a genuinely different audience, per
`docs/PRODUCT_PHILOSOPHY.md`, but it should still be *a* shell, not zero
shell.

## 9. Navigation philosophy

**Public nav is correct — do not restructure.** `Trang chủ / Quan trắc /
Báo cáo` plus a separate admin affordance (`public-shell.tsx`) maps
cleanly to the actual reachable surfaces; desktop-horizontal /
mobile-bottom-tab split is already implemented and accessible. Resist
adding new top-level items (e.g., a separate "Alerts" nav) — alerts
already surface in context (dashboard, station detail), which matches how
someone actually thinks about this product ("is my station okay," not
"show me an alerts inbox").

**Admin has no navigation at all** — one long scrolling page. At its
current size (station overview, allowlist, one config panel, one report
panel) this is arguably still fine information-density-wise; it does not
need a sidebar or multi-route split. It does need `AdminShell` as a
*visual* frame (header/wordmark parity with public, consistent max-width)
even without adding navigation items.

## 10. Component philosophy

**Extend the existing primitives; do not replace them.** `Card`, `Badge`,
`Metric`, `SectionHeader`, `StatusIndicator`/`QualityIndicator`,
`EmptyState`, `Button`, `Input`, `Label`, `Textarea`, `Skeleton` are all
structurally sound — see the inventory in §11 for what changes and what
doesn't.

**New primitives actually needed** (small list, each justified by a
concrete repeated pattern found this audit, not speculative):

- **`Wordmark`** — the "Horizon" eyebrow + title pattern, currently hand-
  typed identically in `public-shell.tsx:37-38` and `admin/login/page.tsx:28-29`.
  One component, two call sites fixed.
- **`Tag`** — a neutral, non-status label for things like "Gốc"/"Database"
  in the admin allowlist (`admin/page.tsx:594,596`) and "Lưu tạm" for
  demo-mode reports (`:481`) — these are not environmental-status badges
  and must stop borrowing `Badge`'s status color vocabulary.
- **`Alert`** — a single banner component for error/warning inline
  messages, replacing three hand-typed near-duplicates
  (`admin/page.tsx:514`, `:520`, `report-form.tsx:241`).
- **`AdminShell`** — header (using `Wordmark`), consistent max-width,
  sign-out affordance — the one real structural gap, see §8/§9.

**Not needed, despite being proposed in the earlier draft of this
document:** `DataTable` (no admin table-shaped data exists yet — build
when the device/ingestion-health view is actually scoped, not before),
`ProvenanceIndicator` (already redundant with the existing
`StatusIndicator compact` pattern — don't build a second one), dark mode
(no evidence of demand; the existing light-only surface is a deliberate,
still-valid call per `docs/VISUAL_REFERENCES.md`'s explicit rejection of a
Linear-style dark-first aesthetic).

## 11. Component inventory

| Component | File | Verdict | Why |
|---|---|---|---|
| `Card` | `ui/card.tsx` | **KEEP**, tighten contract | Sound primitive; needs the "never nest a box inside it" rule enforced (§6) |
| `Badge` | `ui/badge.tsx` | **KEEP**, narrow scope | Status-only going forward; stop admin's non-status reuse (§5) — create `Tag` for that instead |
| `Metric` | `ui/metric.tsx` | **KEEP as-is** | Already the right shape — value/unit/label/provenance in one place, actively used correctly on dashboard and station detail |
| `SectionHeader` | `ui/section-header.tsx` | **KEEP, adopt more widely** | Only 2 of homepage's 6 sections use it; the rest hand-type the same eyebrow+title markup inline (`page.tsx:233-234`, `:41`) — route everything through it |
| `StatusIndicator` / `QualityIndicator` | `ui/status-indicator.tsx` | **KEEP as-is** | Correct two-axis model, already documented in `docs/TELEMETRY_STATE_MODEL.md`, actively used correctly |
| `EmptyState` | `ui/empty-state.tsx` | **REDESIGN** | Compose `Card`, drop the off-scale `rounded-2xl` icon well (§6) |
| `Button` | `ui/button.tsx` | **KEEP**, enforce | Sound `cva` implementation; `report-form.tsx`'s hand-typed `rounded-full` overrides need to either become a real documented `pill` variant or be removed in favor of the default |
| `StationNetworkMap` | `dashboard/station-network-map.tsx` | **KEEP as-is** | Real Leaflet+CartoDB, honest empty state, genuinely the strongest part of the current product |
| Admin's `<details>/<summary>` notification dropdown | `admin/page.tsx:442-508` | **SPLIT out into `Popover`-style primitive** | One-off today; worth a shared component only if a second use case appears — otherwise leave as-is, don't build speculative infrastructure |
| Hand-typed wordmark (×2) | `public-shell.tsx:37-38`, `admin/login/page.tsx:28-29` | **MERGE → `Wordmark`** | Exact duplicate markup, two files |
| Hand-typed alert banners (×3) | `admin/page.tsx:514,520`, `report-form.tsx:241` | **MERGE → `Alert`** | Near-duplicate markup |
| Icon-in-circle pattern (×3 sizes) | `page.tsx:241`, `about/page.tsx:122`, `empty-state.tsx:12` | **CREATE `IconTile`** or standardize to one size | Currently 12/10/12px circles with two different fill treatments and no shared source |
| `logo.png` | repo root | **CLASSIFY, don't touch source yet** | Orphaned, unreferenced. Placement/wiring decision belongs to whoever owns the actual brand asset — flagged, not resolved, in this audit-only phase |

## 12. Data visualization philosophy

Keep the existing `SalinityChart` house style as-is — threshold reference
lines drawn directly on the trend area, not a separate legend (confirmed
this is already implemented and is genuinely good). Apply the identical
pattern if/when a soil EC chart is ever built (blocked on the
`soil_readings` UI-wiring gap already tracked in
`docs/IMPLEMENTATION_ROADMAP.md`, out of scope here).

## 13. Map philosophy

Already correct — real coordinates, real Leaflet/CartoDB tiles, honest
empty state when `stations.length === 0`. No change needed. The one open
question is product-level, not visual: `/` and `/dashboard` currently
render the *exact same map component* with no differentiated framing
(`page.tsx:137` vs `dashboard/page.tsx:34`) — this is an information-
architecture decision (what does the homepage's map add that the
dashboard's doesn't?), not a visual redesign task. Recommend resolving it
in Phase R4 (§16) by making the homepage's map a smaller, non-interactive
preview that leads into the real dashboard map, rather than a second full
instance of the same component.

## 14. Empty / error / loading states

**Already systematically correct at the data-honesty level** — verified
across three prior phases, no fabricated data found anywhere. What's
inconsistent is purely the *container* (§6's `EmptyState` fix) — the
underlying logic (never show 0 for "no data," always say "Chưa có dữ
liệu") is sound and must not be touched.

## 15. Mobile philosophy

Keep the existing discipline — mobile-first from 320px, bottom-tab nav,
44px touch targets, all confirmed still correctly implemented. No
regression found this audit.

## 16. Motion philosophy

> **Extended by §24.8 (Phase R16).** "Motion only clarifies a state
> change" is broadened, not reversed: motion may now also carry brand
> warmth (richer hover states, a freshness-driven "live" marker pulse), as
> long as it still ties to a real interaction or real data state. §24.8
> is the full motion vocabulary (entrance/hover/marker/chart/nav/loading);
> this paragraph's tokens and reduced-motion handling remain the base
> every one of those rules builds on.

Keep existing tokens (`--motion-fast/base/medium/slow`, `--ease-standard`)
and the `prefers-reduced-motion` handling in `globals.css:87-96` — both
correct and already in place. No new motion work needed for this pass;
motion polish is explicitly the *last* phase (R10, §17), not something to
front-load.

## 17. Accessibility requirements

Carry forward what's already correct: real `aria-label`s, `aria-current`,
focus-visible rings (`globals.css:119-122`), `role="radiogroup"`/
`aria-checked` on the report form's category picker. No new requirement
identified this pass beyond what `docs/ACCESSIBILITY_PERFORMANCE.md`
already states — this redesign is visual/structural, not an accessibility
remediation.

## 18. Explicit anti-patterns

- **Do not** put a bordered/shadowed box inside another bordered/shadowed
  box (§6) — this is the single most repeated concrete defect found.
- **Do not** invent a new radius value. If none of `xs/sm/md/lg/xl`
  (6/10/14/18/24px) fits, that's a signal to reconsider the component, not
  to add a sixth token.
- **Do not** reuse `Badge`'s status colors for non-status labels (§5).
- **Do not** add a second visual language for admin "because it's
  different" — density can differ, the container/type/spacing system must
  not (§3.4).
- **Do not** build `DataTable`, dark mode, or `ProvenanceIndicator` — all
  three were proposed in the previous draft of this document and are not
  justified by any current, real requirement (§10).
- **Logo/brand usage:** see §24.11 for current rules (this replaces an
  earlier, narrower "packaging only" rule — preserved in Appendix H —
  written before the actual logo asset had been inspected).

## 19. Page-by-page design goals

### `/` — Homepage
**Objective:** orient a first-time visitor in one screen; prove the
product is real via live numbers, not marketing copy. **Primary action:**
go to `/dashboard`. **Focal point:** the live ribbon stats + map preview,
not the hero headline. **Fix:** route all 6 sections through
`SectionHeader`; shrink the map preview so it's visually distinct from
the dashboard's full map (§13); apply the type scale so the hero uses
`--text-display` and nothing else on the page does.

```
┌────────────────────────────────────────────────┐
│ NAV (PublicShell)                               │
├────────────────────────┬────────────────────────┤
│ Badges + eyebrow        │                        │
│ --text-display headline │   Compact map preview  │
│ Supporting copy          │   (not full dashboard  │
│ CTA buttons              │    map — see §13)      │
│ Live ribbon stats (real) │                        │
├────────────────────────┴────────────────────────┤
│ SectionHeader: "Ba điểm chạm"                    │
│ 3-column focus items (Trạm 1 / Trạm 2 / Gateway) │
├───────────────────────────────────────────────────┤
│ Story blocks (alternating, --spacing scale between)│
├───────────────────────────────────────────────────┤
│ 3-outcome grid                                     │
├───────────────────────────────────────────────────┤
│ SectionHeader: final CTA                           │
└───────────────────────────────────────────────────┘
```
Mobile: single column, map preview moves below the fold (after ribbon
stats, before "Ba điểm chạm").

### `/dashboard` — Observatory
**Objective:** answer "what's happening right now, where, is anything
wrong" in one screen. **Primary action:** click into the highest-priority
station. **Focal point:** the priority-sorted station list — already
correctly sorted (`stationPriority()`), keep the logic, this is a visual
pass only.

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ H1 (--text-h1) + report/about shortcuts            │
├──────────────────────────────────────────────────┤
│ Global status strip (4 Metrics, border-y)          │
├──────────────────────────────────────────────────┤
│ Full station network map                           │
├────────────────────────┬───────────────────────────┤
│ Priority-sorted stations│ Alerts (EmptyState if none)│
├────────────────────────┴───────────────────────────┤
│ Salinity trend chart    │ 24h delta summary          │
├──────────────────────────────────────────────────┤
│ Daily comparison chart                              │
└──────────────────────────────────────────────────┘
```
Mobile: same order, map becomes shorter/scrollable, station list and
alerts stack vertically instead of 2-column.

### `/s/[stationId]` — Station detail
**Objective:** the actual QR-scan destination — answer "is this specific
station okay" instantly. **This page's IA is already correct** per prior
audit — the redesign work here is purely visual (§6's `EmptyState` fix if
it ever renders one; otherwise no structural change).

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ Location eyebrow + station name + intro            │
├──────────────────────────────────────────────────┤
│ 3-axis status row: operational | freshness | quality│
├──────────────────────────────────────────────────┤
│ Metric grid (station-kind-specific, 4 values)      │
├────────────────────────┬───────────────────────────┤
│ Live trend chart         │ Recommendation + raw stats│
├──────────────────────────────────────────────────┤
│ Other stations (rule list)                         │
├──────────────────────────────────────────────────┤
│ Back to map / Report near this station              │
└──────────────────────────────────────────────────┘
```
Already mobile-correct (single column, all sections stack).

### `/report` — Field report
**Objective:** low-friction submission, works without GPS. **Fix:**
replace hand-typed `rounded-full` overrides with the standard `Button`
(or promote `pill` to a real named variant if the product genuinely wants
it elsewhere too — decide, don't leave it as one page's private choice).

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ Eyebrow + H1 + supporting copy                     │
├──────────────────────────────────────────────────┤
│ Category picker (radiogroup pills — keep shape,    │
│   fix via a named variant not a hand override)      │
├──────────────────────────────────────────────────┤
│ Location (GPS button + station-id fallback input)  │
├──────────────────────────────────────────────────┤
│ Description textarea                                │
├──────────────────────────────────────────────────┤
│ Photo-not-supported notice (Alert, not hand-typed)  │
├──────────────────────────────────────────────────┤
│ Sticky submit button (mobile) / static (desktop)    │
└──────────────────────────────────────────────────┘
```

### `/about` — Story
**Objective:** narrative context for press/researchers/curious visitors.
**Fix:** de-duplicate the icon-in-circle pattern (§11's `IconTile`), align
heading sizes to the type scale (currently mixes `text-3xl`, `text-4xl`,
`text-2xl` across its own sections with no rule).

### `/admin/login` — Gate
**Objective:** minimal, fast. **Fix:** use `Wordmark` instead of the
hand-typed duplicate (§10).

### `/admin` — Operations console
**Objective:** the operator's entire toolkit on one screen — station
overview, runtime config, allowlist, report triage. **This page needs the
most structural work**: wrap in `AdminShell` (§8/§9), remove nested boxes
(§6), replace `Badge` misuse with `Tag` (§5), replace the three hand-typed
warning/error banners with `Alert` (§10).

```
┌──────────────────────────────────────────────────┐
│ AdminShell header (Wordmark + report bell + sign-out)│
├──────────────────────────────────────────────────┤
│ Error/demo-mode Alert (if applicable)              │
├────────────────────────┬───────────────────────────┤
│ Station overview Metric │ Public shortcuts           │
├──────────────────────────────────────────────────┤
│ Allowlist management     │ Data retention notes       │
├──────────────────────────────────────────────────┤
│ Sleep-mode config (3 station forms, no nested boxes)│
├──────────────────────────────────────────────────┤
│ Station list (rule-separated, matches public style) │
└──────────────────────────────────────────────────┘
```
De-emphasize on mobile: retention notes card can collapse/move last;
everything else must remain usable at 375px (operator may check from a
phone in the field).

## 20. Definition of "done"

A page is done when: it uses only tokens from §4/§7's type/spacing scales
(no bespoke `text-*`/`mt-*` values), every container follows §6's rule
(no nested boxes), every status color traces back to `Badge`'s five real
states (nothing borrowed for non-status meaning), and it passes the
existing `docs/TECHNICAL_QA_CHECKLIST.md`/`docs/UI_AUDIT_CHECKLIST.md`
gates unchanged.

## 21. What HORIZON should NOT look like

**Current, full list: see §24.12** (this supersedes the list below, which
retained a "not a generic eco-NGO site — green-everything" line no longer
true now that green is a sanctioned brand accent; original wording
preserved in Appendix H). The four items below still hold and are
restated, not contradicted, by §24.12:

Not a dark, futuristic control room. Not glassmorphism. Not gradient-
heavy. Not a card for every single number (the exact pattern already
correctly eliminated from public pages — don't let it creep back via
admin's unfinished state). Not decorative animation without a trigger —
see §24.8 for what now counts as a legitimate trigger.

---

# 22. Redesign Execution Plan

Each phase lists files likely affected, dependencies, risk, acceptance
criteria, and what must NOT change.

## Phase R1 — Tokens
**Files:** `apps/web/app/globals.css` only.
**Adds:** type scale (§4), spacing scale (§7).
**Dependencies:** none — this is the foundation everything else builds on.
**Risk:** low (additive, no existing class removed yet).
**Acceptance:** new CSS custom properties exist; zero visual change yet
(nothing consumes them until R2+).
**Do NOT:** touch color/radius/shadow/motion tokens — those are correct.

## Phase R2 — Shell + navigation
**Files:** new `apps/web/components/layout/admin-shell.tsx`, new
`apps/web/components/ui/wordmark.tsx`; edits to `public-shell.tsx` and
`admin/login/page.tsx` to consume `Wordmark`.
**Dependencies:** R1 (uses new type tokens for the wordmark).
**Risk:** low — additive component, two small call-site swaps.
**Acceptance:** `Wordmark` renders identically to the current hand-typed
markup in both places; `AdminShell` exists but `admin/page.tsx` doesn't
consume it yet (that's R8).
**Do NOT:** change the public nav structure (§9) or the wordmark's actual
text/branding.

## Phase R3 — Primitives
**Files:** `ui/empty-state.tsx` (compose `Card`, fix icon well), new
`ui/tag.tsx`, new `ui/alert.tsx`, new `ui/icon-tile.tsx`.
**Dependencies:** R1.
**Risk:** low-medium — `EmptyState` is used on `/dashboard` (2 call sites)
and possibly elsewhere; verify all call sites after the change.
**Acceptance:** `EmptyState` visually matches `Card`'s radius/shadow;
`Tag`/`Alert`/`IconTile` exist and are unit-testable in isolation (no
consumers wired yet).
**Do NOT:** change `Metric`, `SectionHeader`, `StatusIndicator` — they're
already correct.

## Phase R4 — Homepage
**Files:** `apps/web/app/page.tsx`.
**Dependencies:** R1, R2 (Wordmark not needed here, but type/spacing
tokens are), R3 (SectionHeader adoption).
**Risk:** medium — highest-traffic page, most sections to touch.
**Acceptance:** all 6 sections use `SectionHeader`; map preview is
visually distinct from `/dashboard`'s (§13); only the hero uses
`--text-display`.
**Do NOT:** change the live-data logic (`LiveSummary`, `NetworkPreview`)
— this is a visual-only pass.

## Phase R5 — Dashboard
**Files:** `apps/web/app/dashboard/page.tsx`.
**Dependencies:** R1, R3.
**Risk:** low — structure is already close to correct, mostly a token-
consistency pass.
**Acceptance:** no bespoke spacing/type values remain; `EmptyState` uses
the R3 version.
**Do NOT:** change `stationPriority()`'s sort logic — verified correct.

## Phase R6 — Station detail
**Files:** `apps/web/components/stations/station-detail.tsx`.
**Dependencies:** R1, R3.
**Risk:** low — smallest gap of any page.
**Acceptance:** token-consistency pass only; IA unchanged.
**Do NOT:** change `stationProfiles` or the fallback logic — that's a
backend/IA decision, not a design one (flagged in Step 5, not resolved
here).

## Phase R7 — Report / About
**Files:** `apps/web/components/report/report-form.tsx`,
`apps/web/app/about/page.tsx`.
**Dependencies:** R1, R3 (`Alert`, `IconTile`).
**Risk:** low.
**Acceptance:** report form's pill buttons are either a named `Button`
variant or reverted to default; about page's icon-in-circle uses
`IconTile`; both pages' headings follow the type scale.
**Do NOT:** change the report submission logic or the geolocation flow.

## Phase R8 — Admin
**Files:** `apps/web/app/admin/page.tsx`, `apps/web/app/admin/login/page.tsx`.
**Dependencies:** R1, R2 (`AdminShell`, `Wordmark`), R3 (`Tag`, `Alert`).
**Risk:** medium-high — the largest, most-affected single file; touches
every card in the page.
**Acceptance:** page wrapped in `AdminShell`; zero nested boxes remain
(§6); `Badge` used only for actual station status, `Tag` for allowlist
source/report-sync labels; all three inline banners replaced with
`Alert`.
**Do NOT:** change any server action (`updateRuntimeConfig`,
`addAdminEmail`, etc.) or the underlying data logic — visual pass only.

## Phase R9 — Responsive/mobile verification
**Files:** none (verification pass across all pages above).
**Dependencies:** R4–R8 complete.
**Risk:** low.
**Acceptance:** manual check at 375/390/768/1024/1440 per
`docs/TECHNICAL_QA_CHECKLIST.md`'s existing gate; admin specifically
checked at 375px (§19's mobile note).
**Do NOT:** skip admin — it's the page most likely to have been designed
desktop-first historically.

## Phase R10 — Motion/polish
**Files:** touch-ups only, wherever R4–R8 left a rough transition.
**Dependencies:** R4–R9.
**Risk:** low.
**Acceptance:** any new interactive element (e.g., `AdminShell`'s
sign-out, `Alert` dismiss if added) uses existing motion tokens; nothing
new invented.
**Do NOT:** add decorative animation anywhere (§21).

## Phase R11 — Visual QA
**Files:** none.
**Dependencies:** all prior phases.
**Risk:** low.
**Acceptance:** full `docs/UI_AUDIT_CHECKLIST.md` pass; confirm §18's
anti-pattern list has zero violations via a final grep for `rounded-2xl`,
`rounded-full` outside `Button`'s own variant, and hand-typed
`border.*shadow` combinations outside `ui/*`.
**Do NOT:** treat this as a rubber stamp — it's the actual verification
that R1–R10 held.

---

# 23. What this document deliberately does not do

No Tailwind class-by-class migration diff, no Figma files, no logo/brand
redesign (explicitly out of scope — see §18). This is the decision record
the redesign phases execute against, matching how `docs/ARCHITECTURE.md`
governs the backend. Implementation begins at Phase R1, not in this
document.

> **Note (Phase R16):** "no logo/brand redesign" above described R1–R11's
> scope, not a permanent constraint — it was written before the actual
> logo asset had been inspected. Brand/logo usage is now explicitly in
> scope; see §24, specifically §24.11. The document is still not
> attempting a Figma file or a pixel-by-pixel migration diff — §24 sets
> direction and principles for the next implementation phase to execute
> against, same as §1–§21 did for R1–R11.

---

# 24. Art Direction — Phase R16 (Current, Authoritative)

**Status: this section is the single current source of truth for
Horizon's brand personality, visual signature, color system, typography
stance, shape/illustration language, motion vocabulary, data-viz and map
treatment, logo usage, and negative rules.** It supersedes §2, §5, and the
brand-related lines of §18/§21/§23 — those have been trimmed to pointers;
their original wording lives in **Appendix H**, historical only. Type/
spacing scales (§4/§7), surface/nesting rules (§6), layout grid (§8),
navigation structure (§9), component inventory (§11), data-honesty
invariants (§14), and accessibility requirements (§17) are **not**
touched by this section and remain exactly as built in R1–R15.

**Trigger:** direct inspection of `logo.png` — the repository's existing,
approved brand asset (root of repo; 829×301, RGBA PNG with transparency)
— revealed a hand-drawn, tropical, character-driven wordmark: bubble-style
green lettering, a character face with glasses inside the "O," an orange
conical hat, and an orange sun/wave graphic replacing the second "O."
Rather than redraw, recolor, or suppress the asset, the product's art
direction is revised to embrace it deliberately.

## 24.1 Brand personality

Horizon is "technology that belongs to the community," not "cold
infrastructure software." It is public-facing environmental infrastructure
for a real community (Cồn Hô), not an enterprise ops tool wearing an
environmental skin.

Target feel: playful, contemporary, energetic, tropical, community-driven
— **and** technically credible, premium, approachable. Not one or the
other.

**The split that makes this work:** the *logo* is the source of
personality (color, character, warmth). The *interface* provides maturity
and precision (typography discipline, spacing rhythm, real data,
restrained motion). Personality does not mean redesigning every component
to be playful — it means the product doesn't apologize for its human,
tropical origin story while still being trustworthy enough to report a
real salinity number someone will act on.

Reference formula (principles only, never literal copying — see §24.12):
Linear/Vercel-level structure and polish + Notion-level approachable
information design + Arc-level interaction personality + Stripe-level
storytelling/interactive presentation + Horizon's own tropical/community
character.

## 24.2 The Horizon visual signature

Personality (§24.1) is a feeling; this is the concrete visual grammar
that produces it. Five elements, deliberately not more — a signature
diluted across ten devices isn't a signature. Each is defined by what it
is, where it may/must-not appear, what it's for, and how loud it gets.

**1. The logo mark.** *What:* `logo.png`, unmodified. *Where it may
appear:* public header, admin login, one optional landing-page brand
moment (§24.11). *Where it must not:* admin console working header,
favicons, repeated/tiled, inside data displays. *Purpose:* the
personality anchor — the one place color and character are allowed to be
loud. *Volume:* prominent but subordinate to navigation/content — quiet
in frequency (few placements), confident in the placements it gets.

**2. The brand accent duo (green + orange).** *What:* `--color-brand-green`
/`--color-brand-orange`, sampled from the logo (§24.3). *Where it may
appear:* small, deliberate accent moments — a hover state on a primary
marketing CTA, a section-divider detail, the logo itself. *Where it must
not:* any `Badge`/`StatusIndicator`/`Tag`/data-bearing surface, any
functional/admin screen, chart series. *Purpose:* the thread that ties
quiet interface moments back to the logo without repeating the logo
itself. *Volume:* rare and confident — one or two accent moments per
screen, never a wash.

**3. The signal pulse.** *What:* a soft, slow radiating-ring motion on
map markers (and optionally a small live-indicator dot elsewhere) when,
and only when, `freshnessStatus() === "live"` (§24.8). *Where it may
appear:* `StationNetworkMap` markers; optionally a compact live indicator
on dashboard/station-detail. *Where it must not:* anywhere not backed by
a real live reading — this is data wearing motion, not decoration.
*Purpose:* makes "the network is alive right now" legible at a glance,
and is the one piece of motion that's genuinely Horizon-specific (a
generic SaaS dashboard doesn't have real live sensors to represent).
*Volume:* subtle — a slow, soft pulse, not an urgent blink.

**4. The real station map.** *What:* `StationNetworkMap` — real Leaflet,
real coordinates, near-monochrome CartoDB tiles, colored freshness
markers (§24.10). *Where it may appear:* dashboard (full), homepage
(compact preview), about (full). *Where it must not:* anywhere as a
decorative/non-functional embed. *Purpose:* already, per the original
Phase D audit, "genuinely the strongest part of the current product" —
real geography is a signature no illustration can fake. *Volume:*
prominent where it appears, restrained in tile styling (the map's realism
is the point, not a brand skin on top of it).

**5. The river-line motif.** *What:* a single, restrained organic
wave/curve device, used consistently (not reinvented per page)
(§24.6). *Where it may appear:* a small number of clearly-decorative
brand moments — hero section divider, footer-adjacent CTA block, behind/
around the logo lockup. *Where it must not:* tables, forms, charts,
admin, any functional container. *Purpose:* the one place the
"river/coastal" half of "tropical" shows up as shape rather than color.
*Volume:* used sparingly enough that its handful of appearances stay
memorable rather than becoming wallpaper.

**The "no text, no logo" test** (§24.13) is answered by #2–#4 of this
list — the logo itself is explicitly excluded from that test by
definition, and the river-line motif (#5) is deliberately the most minor
of the five.

## 24.3 Color system — brand vs. semantic (supersedes §5)

§5's "do not change the palette" no longer holds. Replacement model:
**two distinct color systems that must never be confused with each
other.**

**System 1 — Semantic status colors (unchanged).** `--color-healthy`,
`--color-watch`, `--color-risk`, `--color-offline`, `--color-fault` and
their `-bg` pairs, exactly as defined today. These exist only to answer
"is this station/reading okay" and govern `Badge`/`StatusIndicator`/
`QualityIndicator` — nothing else. **Brand green must never be read as
"healthy" merely because it's green; brand orange must never be read as
"warning" merely because it's orange** — the components are structurally
incapable of that confusion (the disambiguation rule below) as long
as brand tokens never enter a status component's implementation.

**System 2 — Brand accent colors (new).** Sampled directly from
`logo.png`'s actual pixels (dominant-color extraction, not invented):

| Token (proposed, not yet added to `globals.css`) | Value | Source |
|---|---|---|
| `--color-brand-green` | `#2FA85C` | Dominant letter-green cluster (~`#30a860`, ~22k sampled pixels) |
| `--color-brand-orange` | `#FB9600` | Dominant sun/hat-orange cluster (~`#fc9c00`, ~9k sampled pixels) |

These exist only for brand/identity moments (§24.2 items 1–2, §24.11) —
never for data or status.

**The disambiguation rule (the single most important rule in this
revision):** brand green ≠ healthy indicator; brand orange ≠ warning
indicator. Both systems sit in the same green/orange hue family, so hue
alone cannot carry the distinction — confusing the two would be easy to
do by accident during implementation. Disambiguation comes from three
things holding simultaneously:
1. **Component boundary** — brand tokens are never referenced inside
   `Badge`, `StatusIndicator`, `QualityIndicator`, `Tag`, or any
   data-bearing component. Status tokens are never referenced inside
   `Wordmark`, the logo treatment, or decorative brand moments.
2. **Structural context** — brand color appears only in fixed, predictable
   brand real estate (header mark, login screen, a landing-page brand
   moment, a marketing-page CTA hover). Status color appears only
   attached to a labeled reading/station.
3. **Never color-alone** — already the rule for status (§17); it now does
   double duty as brand/status disambiguation too. Every status indicator
   keeps its icon + text label regardless of what brand colors exist
   elsewhere on the same screen.

**Usage frequency, by page register** (the concrete answer to "brand
colors should not be used indiscriminately"): marketing-register pages
(`/`, `/about`) may show brand color in the logo plus at most one or two
accent moments (e.g., a primary-CTA hover, a section-divider detail).
Tool-register pages (`/dashboard`, `/s/[id]`, `/report`) show brand color
*only* in the persistent header logo — zero brand color anywhere else on
those screens; blue + neutral + status colors do 100% of the remaining
color work there. Admin shows *no* brand color outside the login screen —
`AdminShell`'s working header stays text/`Wordmark`-led (§24.11).

Base neutrals (`--color-background`, `--color-foreground`, `--color-card`,
`--color-muted`, `--color-border`) are unchanged — the calm canvas the
brand accents sit on top of. `--color-accent` (blue) is unchanged and
still does the technical/data-UI work (links, primary actions, focus
rings, the water-level data-viz series) — it is not replaced by brand
green/orange; blue carries precision, brand colors carry personality.

**Rule:** brand color is never the majority color of any screen. Surfaces
stay neutral; green/orange appear as accents. This is what keeps
"tropical/playful" from sliding into "the whole app is green" or
"childish."

## 24.4 Typography philosophy (restated, not changed)

The existing scale (`--text-eyebrow/display/h1/h2/body/body-dense/caption`,
§4) stays exactly as built in R1 — deliberately, not by oversight.
Typography is where the interface earns the "premium/technical/maturity"
half of the personality; it stays disciplined even as color and shape get
more expressive elsewhere. Do not introduce a display/decorative typeface,
hand-lettered treatments, or playful type effects (no wavy baselines, no
mixed-weight logotype-style headlines) — that register belongs to the
logo alone. One typeface (Inter), one scale, applied consistently, now
carries relatively *more* of the visual-hierarchy work against a warmer
palette, not less.

## 24.5 The playfulness boundary

"Playful" is precisely scoped. It does **not** mean: cartoon UI (icons,
borders, or components drawn in the logo's hand-drawn style), childish
illustration (new characters, expanded mascot appearances), bouncing/
elastic UI motion, emoji as interface elements, excessive rounded shapes
beyond the existing radius scale, loud/decorative gradients, gamification
(badges-for-badges'-sake, streaks, points), or random decorative blobs.

Instead, a **mature form of playfulness**, expressed only through the
channels already scoped elsewhere in this section, with concrete
examples:
- **Color (§24.3):** commit fully to a saturated brand accent *when* you
  use one, rather than a pale, apologetic tint. Playful means confident
  in the few moments it appears, not diluted everywhere.
- **Shape (§24.6):** the one river-line motif, used with real scale and
  intention in a brand moment, rather than many small decorative rounds
  scattered across the page.
- **Motion (§24.8):** the signal pulse — one well-executed motion idea
  that means something, rather than many small ambient animations.
- **Microinteraction:** primary marketing-page CTA buttons may warm
  toward brand orange on hover (concrete, scoped exception — buttons are
  unambiguously actions, never status displays, so this doesn't collide
  with §24.3's disambiguation rule). Tool-register/data-row hovers keep
  the existing plain opacity fade — no personality added there; scanning
  interactions stay quiet.
- **Environmental motifs (§24.7):** a water-ripple or leaf motif used
  exactly like today's `IconTile` icons — small, purposeful, never a full
  illustration.
- **Illustration restraint (§24.7):** zero new characters or mascot
  appearances beyond the one existing logo — playfulness doesn't mean
  "draw more of the mascot," it means "let the one mascot you have
  breathe in a disciplined interface."
- **Typography details:** none — per §24.4, typography carries zero of
  the playfulness budget, by design.

## 24.6 Shape language

Organic, river/coastal-inspired curves are now an available device — the
river-line motif from §24.2 item 5 — used deliberately and sparingly:
- **Allowed:** a subtle wave/curve motif as a section divider or
  decorative accent in clearly-brand moments (hero, a footer-adjacent CTA
  block); rounded, organic accent shapes behind or around the logo
  lockup.
- **Not allowed:** organic shapes inside data displays, tables, forms,
  charts, or admin — these stay rectilinear and precise. The existing
  radius scale (`--radius-xs…xl`, §6) is unchanged and still governs every
  functional container. This shape-language change applies to a small,
  clearly-decorative set of brand surfaces, not the component system.

## 24.7 Illustration / graphic language

Any new graphic element must trace to a real product concept: water,
soil, station, signal, community, environment, monitoring. Generic
decorative illustration (unrelated blobs, stock-style icon compositions,
ambient background art) is still banned, unchanged from before.

Allowed direction: small, purposeful motifs (a ripple for water, a
leaf/root motif for soil, a signal-wave for gateway/connectivity), used
the same restrained way `IconTile` icons are used today — never a full
illustration, never replacing real data with decoration.

## 24.8 Motion language (extends §16)

§16's "motion only clarifies a state change, never decorates" is
broadened, not reversed: motion may now also carry a small amount of
brand warmth, as long as it still ties to a real interaction or a real
data state. Six categories, each with purpose, intensity, trigger
behavior, and reduced-motion fallback:

| Category | Purpose | Intensity | Trigger | Reduced-motion |
|---|---|---|---|---|
| **Entrance** | Signal "this is a crafted product" at marketing touchpoints only | Gentle fade + 8px rise, `--motion-medium` (220ms) | Once, on first paint of hero/brand moments (`/`, `/about`) — never on `/dashboard`, `/s/[id]`, `/report`, admin | Instant (no fade/rise) |
| **Hover** | Baseline interactivity feedback everywhere; brand warmth only on marketing CTAs | `--motion-base` (180ms) color/opacity, existing baseline; marketing-page primary CTA may warm toward `--color-brand-orange` (§24.5) | On `:hover`/`:focus-visible`, every interactive element | Color transition remains (not motion — exempt) |
| **Map marker (signal pulse)** | Make "live right now" legible — data, not decoration | Soft radiating ring, ~2s cycle, low opacity | Persistent while `freshnessStatus() === "live"`; zero motion for stale/offline (their stillness *is* the signal) | Replace looping pulse with the existing static solid-color dot |
| **Chart/telemetry** | Orient the eye on first load without becoming distracting on repeat checks | One-time line/area draw-in, ≤ ~400ms, on initial data mount only | Once per data load — never on hover/tooltip/re-render; tooltips appear instantly, no delay | Skip draw-in, render final state immediately |
| **Navigation transitions** | Fast wayfinding, not cinematic | Active nav-item indicator transitions over `--motion-fast` (120ms); no custom page-transition choreography | On route/active-state change | Instant indicator change |
| **Loading** | Existing `Skeleton` shimmer stays the loading language | `--motion-skeleton` (1800ms), unchanged | While data is pending | Static skeleton (no shimmer) |

**Still out of scope, unconditionally:** motion without a real trigger
(autoplay, looping ambient decoration), anything exceeding the durations
above, anything that ignores `prefers-reduced-motion` — §17's
reduced-motion handling is unchanged and still applies to every row.

## 24.9 Data visualization personality

Data-honesty invariants are unchanged and non-negotiable (§14, and the
project's original Data Honesty Invariant) — this section is about
presentation only, never about what is shown.

**What makes a Horizon chart recognizable** (all already true today,
restated as the standard new charts must match): threshold context drawn
directly on the trend area, not a separate legend (`SalinityChart`'s
signature pattern — stays exactly as-is); thin, precise axes with minimal
gridlines; tabular numerals with real units always shown next to values;
freshness/provenance always visible near the chart, never just a number
floating alone; never more than two series sharing one Y-axis (the
existing small-multiples reasoning in `DailyComparisonChart` — different
physical measurements at different scales would visually flatten
whichever series has the smaller range); a one-time draw-in on initial
load, otherwise static (§24.8).

**Explicitly avoided:** a generic Recharts-dashboard look, excessive area
fills, rainbow/many-color palettes, a card wrapped around every single
chart.

**Series colors stay on the existing data-viz tokens**
(`--color-salinity`, `--color-water-level`) — these are *not* brand
colors and are not being replaced. A chart must never gain brand
green/orange as a data-series color: that would collapse data-viz color,
brand color, and (per §24.3's hue-proximity note) status color into one
ambiguous system — exactly what this revision exists to prevent. If/when
a soil EC chart is built (currently blocked on the `soil_readings`
UI-wiring gap, out of scope here), it gets its *own* distinct data-viz
hue — not brand green, even though "soil = green" is thematically
tempting; the disambiguation principle wins over the thematic instinct.

## 24.10 Map visual language

The map (`StationNetworkMap`) is the environmental-network centerpiece of
the signature (§24.2 item 4) — real geography, real stations, already the
strongest part of the current product per the original Phase D audit.
Do not replace it or its provider.

- **Markers:** real `circleMarker`s (already implemented), colored by
  `FreshnessState` via the existing `FRESHNESS_COLOR` map. Live markers
  additionally get the signal pulse (§24.8); stale/offline markers stay
  static/solid — their stillness is part of the signal, not a missing
  feature.
- **Station states on the map:** the same six-state freshness vocabulary
  used everywhere else in the product — no map-specific state language.
- **Selected station:** no explicit "selected" visual state exists today
  (a marker click navigates away). If a future station-detail page ever
  embeds its own small locator map, the current station's marker should
  get a distinct ring/halo in `--color-accent` (blue — a UI-selection
  state, not a brand moment, so brand color is wrong here) to
  distinguish it from siblings. Forward-facing guidance, not a current
  requirement.
- **Hover:** existing name tooltip stays; cursor is a pointer only on the
  interactive (`full`) variant — already correctly implemented.
- **Clustering:** not introduced. With ~3 real stations, clustering
  solves a problem Horizon doesn't have. Revisit only if the network
  genuinely grows past ~15–20 stations, as its own separate decision.
- **Popups:** stays tooltip-based (hover, lightweight), not click-
  triggered popups — a full popup is heavier UI than a 3-marker network
  needs.
- **Map container:** existing treatment stays (`rounded-lg` border, and
  the `isolate` stacking-context fix from R13 that keeps Leaflet's
  internal z-index from escaping over the sticky header). Tile provider
  stays CartoDB Positron, near-monochrome — the map's own genuine
  geographic content already does enough "real, not decorative" work,
  and a brand-colored tile skin would fight with reading the real
  station-status colors rendered on top of it.
- **Empty/disconnected state:** the existing honest dashed-border "no
  coordinates" placeholder stays exactly as-is — never a fake pin, ever.

## 24.11 Brand / logo usage (updates §18/§23)

`logo.png` is used unmodified: no recolor, no redraw, no cropping into a
new symbol-only mark, no regeneration.

**Strategic placement, not ambient placement:**
- **Public header (desktop/tablet):** the full lockup at a small size —
  roughly matching or only slightly exceeding the current text
  `Wordmark`'s visual weight — never competing with nav links for
  attention.
- **Public header (mobile):** the same unmodified asset, scaled down
  further. Its wide aspect ratio (829×301, ~2.75:1) is a real legibility
  constraint at mobile header heights — if the full lockup can't stay
  legible without crowding navigation, the mobile header falls back to
  the text-only `Wordmark`, with the full logo reserved for the login
  screen and any dedicated brand moment. This is a legibility-driven
  fallback to verify visually during implementation, not a preference.
- **Admin login:** a larger, centered treatment — the one place a bigger
  lockup is appropriate, since it's a dedicated, low-density,
  single-purpose screen.
- **Landing-page brand moment:** optional, at most one placement (e.g.,
  near the hero). If the logo already appears in the persistent header,
  it does not also need a second, separate hero placement — one clear
  anchor, not two.
- **Out of scope entirely:** the admin console's *working* header
  (`AdminShell` stays text/`Wordmark`-led — operators need the compact,
  dense treatment already established; the same "two densities, one
  token set" principle from §3.4, unchanged), favicon-scale iconography
  (the full lockup does not survive shrinking that far; a favicon is a
  separate asset decision, out of scope here), any repeated/watermark/
  pattern use, inline within body copy or as a list/bullet icon, on every
  card or section, or inside any data display/chart/table.

**Minimum visual prominence:** the logo must always remain legible —
never shrunk to a size where the character face reads as a blur. If a
placement can't fit it legibly, fall back to the text-only `Wordmark`
rather than shrinking past legibility.

**Sizing discipline:** the mark stays subordinate to navigation and
content at all times — quiet but present, not a hero-logo treatment.
Exact pixel sizing is an implementation decision for the next phase.

## 24.12 Negative design rules — "Horizon must never look like…"

- A **generic SaaS dashboard template** — interchangeable with any B2B
  analytics product: no real geography, no real brand color, a card
  around every number.
- A **Bootstrap/admin-template UI** — default component chrome, no
  typographic discipline, inconsistent spacing.
- A **childish mascot website** — the character illustration repeated
  everywhere, playground colors dominating every surface, hand-drawn
  styling bleeding into real UI components.
- A **climate-NGO donation brochure** — guilt-driven copy, stock nature
  photography, "donate now" energy. Horizon reports real data; it isn't
  fundraising.
- A **generic AI-startup landing page** — gradient blobs, glassmorphism
  cards, vague abstract 3D shapes, buzzword-heavy hero copy.
- A **literal Linear clone** — dark-mode-first, purple/violet accent,
  Linear's specific icon style. (Reference for structure/polish only,
  §24.1 — never for visual identity.)
- A **literal Vercel clone** — black/white monochrome, triangle-brand
  aesthetic. (Same caveat.)
- **Excessive eco-green branding** — every surface tinted green "because
  environment." Brand green is now sanctioned (§24.3), but only as a
  deliberate accent — a majority-green interface is exactly the failure
  mode §5's original reasoning correctly warned against, just reached
  from the opposite direction (too much brand color instead of too much
  status-color borrowing).
- A **neon cyberpunk dashboard** — dark background, glowing neon data
  lines, sci-fi HUD styling. Tonally wrong for a warm community tool.
- Not childish — the mascot lives in the logo; it does not spawn a
  cartoon UI kit (no cartoon icons, no illustrated characters elsewhere,
  no comic-style outlines applied to real components).
- Not a mascot plastered across every screen — logo placement is
  strategic (§24.11), not ambient.
- Not brand color doing status color's job, or vice versa (§24.3) — the
  single most important rule in this revision, and the one most likely to
  be violated by accident during implementation.
- Not organic/wave shapes inside functional UI (tables, forms, charts,
  admin) — that register is reserved for clearly-decorative brand
  surfaces (§24.6).
- Not a dark, futuristic control room. Not glassmorphism. Not gradient-
  heavy. Not decorative animation without a trigger (§24.8). Not
  excessive shadows, blobs, or unrelated illustration.

## 24.13 The final art-direction test

**"If all text and logos were removed, what would still make someone
recognize this as Horizon?"**

Four things: three straight from the visual signature's non-logo items
(§24.2, items 2–4 — the brand accent duo, the signal pulse, and the real
station map, which combine into one impression: the real, near-monochrome
station map with colored markers that softly pulse when live, genuine
geography rather than a generic map widget), plus the river-line motif
(§24.2 item 5) marking brand real estate, sitting on top of the calm,
neutral base color system (§24.3) underneath all of it — disciplined
Inter typography, tabular-numeral data readouts, restrained borders,
almost no shadow. Together: a real place, rendered honestly, carrying two
colors that feel like they belong to a community rather than a category.

---

# Appendix H — Historical / Superseded Reasoning (pre-R16)

**This appendix is historical only. Do not implement against anything in
it.** It exists so the audit trail from R1–R15's reasoning isn't lost,
not as an alternate current direction. Where anything here conflicts with
§24, §24 wins, unconditionally.

### H.1 — Original §2, "Product character" (written before `logo.png` was inspected)

> A calm instrument reporting on a real river system in Cồn Hô, Trà Vinh —
> not a startup dashboard, not an eco-NGO microsite. Quiet, precise,
> technical, trustworthy. The existing color-token reasoning already nails
> this (`globals.css:12-14`: brand blue is deliberately *not* green,
> because green is reserved for the "healthy" status meaning — using it
> for both would read as generic eco-branding). Extend that same
> discipline everywhere else.

Current direction: §24.1.

### H.2 — Original §5, "Color philosophy" (written before `logo.png` was inspected)

> **Already correct — do not change the palette.** Five semantic states
> (`healthy/watch/risk/offline/fault`), brand blue deliberately separated
> from the "healthy" green, data-viz colors (`salinity`, `water-level`)
> separated from status colors. Verified against `globals.css` directly.
>
> **One real bug to fix:** `Badge`'s status variants are being reused in
> `admin/page.tsx` for meanings that have nothing to do with environmental
> status — `variant="healthy"` labels an email as "sourced from `.env`"
> (`admin/page.tsx:594`), `variant="watch"` labels a report as "not yet
> synced to Supabase" (`:481`). This quietly breaks the rule "green always
> means environmentally healthy" that the rest of the product depends on.
> **Fix:** these need a separate, neutral tag treatment — not a `Badge`
> status color at all. See §10.

Current direction: §24.3. (The admin `Badge`-misuse fix described above
was implemented in R8 and remains correct — only the "do not change the
palette" framing is superseded.)

### H.3 — Original §18 bullet, wordmark/logo scope

> **Do not** touch the HORIZON wordmark/logo's actual content, color, or
> meaning — only its *packaging* (one `Wordmark` component instead of two
> hand-typed copies) is in scope.

Current direction: §24.11. (Written before the actual logo asset had been
inspected — at the time, "the wordmark" meant hand-typed text, not
`logo.png`.)

### H.4 — Original §21 line, eco-NGO anti-pattern

> Not a generic eco-NGO site (green-everything — already correctly
> avoided at the token level, see §5).

Current direction: §24.12. (Green is now a sanctioned brand accent under
§24.3; the anti-pattern that replaces this line is "not an interface
where *most* surfaces are green/orange," not "no green at all.")
