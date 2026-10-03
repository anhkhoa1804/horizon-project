---
name: HORIZON
description: A field atlas connecting Cồn Hô, its instruments, observations, and people.
colors:
  primary: "#0c5f7d"
  brand-green: "#2c9e57"
  brand-orange: "#f28c00"
  canvas: "#f7f4ed"
  canvas-recessed: "#f0ece1"
  surface: "#fffdf8"
  ink: "#131d1b"
  ink-muted: "#55635f"
  divider: "rgba(19, 29, 27, 0.11)"
  status-safe: "#197a3f"
  status-warning: "#8f5300"
  status-warning-wash: "rgba(143, 83, 0, 0.09)"
  status-danger: "#b02318"
  series-water: "#2563eb"
  series-soil: "#0d8285"
  cover-ink: "#fffaf0"
  cover-coordinate: "#ece5d2"
  cover-supporting: "#f0ebdd"
  cover-rule: "#afa994"
  diagram-night: "#142924"
  diagram-paper: "#f5f1e6"
  diagram-muted: "#c0cec7"
  diagram-line: "#779a8c"
  diagram-accent: "#a5d2c3"
  stream-connected: "#bc352c"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(3rem, 7.5vw, 6rem)"
    fontWeight: 450
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(2.3rem, 4.5vw, 4rem)"
    fontWeight: 450
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Be Vietnam Pro, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Be Vietnam Pro, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s6: "24px"
  s8: "32px"
  s12: "48px"
  s16: "64px"
  s24: "96px"
  chapter: "clamp(7rem, 13vw, 13rem)"
  gutter-phone: "1.25rem"
  gutter-tablet: "1.75rem"
  gutter-desktop: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "8px 20px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "8px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "8px 20px"
  status-chip-warning:
    backgroundColor: "{colors.status-warning-wash}"
    textColor: "{colors.status-warning}"
    rounded: "{rounded.xs}"
    height: "24px"
    padding: "3px 8px"
  input-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "8px 16px"
---

# Design System: HORIZON

## Overview

**Creative North Star: “The Cồn Hô Field Atlas”**

HORIZON is grounded in the real field system at Cồn Hô: its geography, commissioned illustration and documentary media, sensor stations, gateway, and observations. Keep the existing project identity. The cover can carry the creative expression; the working tools favor quiet surfaces, aligned edges, and legible records.

The home story connects place, hardware, geography, the data path, agricultural questions, and community reports. The Observatory behaves like a station-scoped scientific instrument, the Report flow like a progressive field notebook, and Admin like a compact operations console. Use the same warm canvas, editorial and interface type, station identifiers, and data provenance across these distinct tasks.

**Key Characteristics:**
- Quiet warm canvas with documentary media and a two-row Cồn Hô cover.
- Connected engineering path shown as a dark, numbered diagram.
- Observatory measurements and trend follow the selected station.
- Report evidence and administrative navigation are designed for task completion on phones and desktop.

## Colors

Warm paper and green-cast ink set the reading surface. HORIZON blue marks interaction, while green and orange remain brand colors and each status or chart series keeps its own meaning. Cover tones preserve legibility over the illustration; the diagram uses a separate deep green surface palette.

### Primary
- **River-chart Blue** (`{colors.primary}`): Links, focus rings, selected states, station identifiers, and the primary action.
- **HORIZON Leaf Green** (`{colors.brand-green}`): The HORIZON mark and brand identity.
- **HORIZON Harvest Orange** (`{colors.brand-orange}`): The HORIZON mark and brand identity.

### Secondary
- **Water-series Blue** (`{colors.series-water}`): Water-level trend series.
- **Soil-series Teal** (`{colors.series-soil}`): Soil salinity trend series.
- **Diagram Mist** (`{colors.diagram-accent}`): Connected diagram markers and links.

### Tertiary
- **Safe Green** (`{colors.status-safe}`): Positive status text.
- **Legibility Amber** (`{colors.status-warning}`): Warning and unverified status text.
- **Field Alert Red** (`{colors.status-danger}`): Critical status text.
- **Connected Signal Red** (`{colors.stream-connected}`): The small Observatory stream connection dot.

### Neutral
- **Survey Paper** (`{colors.canvas}`): Main light-theme canvas.
- **Recessed Paper** (`{colors.canvas-recessed}`): Map and support regions.
- **Raised Paper** (`{colors.surface}`): Shared light-theme surfaces.
- **River Ink** (`{colors.ink}`): Main text, with a subtle green cast.
- **Muted Ink** (`{colors.ink-muted}`): Supporting and explanatory text.
- **Hairline Divider** (`{colors.divider}`): Light-theme rules and separators.
- **Cover White** (`{colors.cover-ink}`): Cover title and action text.
- **Cover Coordinate** (`{colors.cover-coordinate}`): Location label on the cover.
- **Cover Supporting Text** (`{colors.cover-supporting}`): Secondary cover copy.
- **Cover Rule** (`{colors.cover-rule}`): Cover action underline and fine separators.
- **Connected Night** (`{colors.diagram-night}`): Dark engineering-path diagram surface and index blocks.
- **Diagram Paper** (`{colors.diagram-paper}`): Primary diagram text.
- **Diagram Muted** (`{colors.diagram-muted}`): Supporting diagram text.
- **Diagram Line** (`{colors.diagram-line}`): Connected path and index outlines.

### Named Rules
**The Brand Is Not Data Rule.** HORIZON green and orange identify the mark; status and chart colors encode their own meanings.

**The Surface Contrast Rule.** Keep cover and diagram tones on those specific surfaces. Do not use them as generic status colors.

## Typography

**Display Font:** Newsreader (with Georgia, serif fallback)  
**Body Font:** Be Vietnam Pro (with Segoe UI and system sans-serif fallbacks)  
**Label/Mono Font:** Roboto Mono (with ui-monospace fallback)

**Character:** Newsreader gives place and chapter headings an editorial voice. Be Vietnam Pro keeps controls and explanatory copy direct; Roboto Mono anchors station codes, timestamps, and measurement values.

### Hierarchy
- **Display** (weight 450, desktop `clamp(3rem, 7.5vw, 6rem)`, phone `clamp(2rem, 8.4vw, 3.8rem)`, line-height 1.08): The Home cover title, with both authored rows kept intact.
- **Headline** (weight 450, `clamp(2.3rem, 4.5vw, 4rem)`, line-height 1.08): Newsreader chapter headings.
- **Title** (weight 600, `clamp(1.5rem, 3vw, 2rem)`, line-height 1.3): Compact route and report titles in Be Vietnam Pro.
- **Body** (weight 400, 16px, line-height 1.7): Main explanatory copy; chapter measures stay near 64ch.
- **Label** (weight 500, 11px, letter spacing 0.08em): Roboto Mono station codes, timestamps, and compact instrument metadata.

### Named Rules
**The Three Registers Rule.** Use Newsreader for editorial titles, Be Vietnam Pro for prose and controls, and Roboto Mono for identifiers and readings.

## Layout

Two width primitives set the page: a 980px text measure and a 1160px media measure. They share the responsive gutter (20px below 640px, 28px from 640px, and 40px from 1024px). The chapter gap is fluid (`clamp(7rem, 13vw, 13rem)`). Keep documentary photography and video open and full-width within the media measure; use the text measure for chapter copy and instrument records.

Home is a numbered editorial sequence without a chapter index with a three-column aligned hardware triptych on desktop, documentary chapters, and a connected data diagram. The cover fills the opening viewport with the islet image behind a transparent header, then exactly two headline rows, one contextual sentence, and one Observatory action. The station-count register does not belong in this cover.

The Observatory preserves the original ten-region bento composition and its square base-cell arrangements on phone, tablet, and desktop. Water, soil, infrastructure, weather, map, and history remain in their established regions. The original arrangement now receives public Realtime updates without a page refresh. Reporting uses one continuous sheet with location, observation, and evidence visible together. Keep the map beside station choices on wide screens and stack them at phone widths. The evidence area supports photos, video, and voice while allowing up to three files total. Admin uses a persistent 210px desktop rail; at tablet and phone widths it changes to a full-width selector.

The active supported viewport range includes 390, 768, 1024, 1280, and 1440px widths. Layouts reflow while keeping navigation, source labels, and actions available.

## Elevation & Depth

The visual system relies on quiet canvas shifts, thin rules, photographic crops, and connected diagram geometry. The cover image has a dark directional scrim for contrast; the engineering path is a deep green plane. Shared controls have restrained shadows, while map, report, and operational sections stay largely flat. The light/dark theme changes shared canvas, ink, status, and interaction tokens.

### Shadow Vocabulary
- **Barely lifted** (`0 1px 1px rgb(19 29 27 / 0.03)`): Shared subtle resting edge.
- **Low surface** (`0 1px 2px rgb(19 29 27 / 0.04)`): Minimal separation where a shared component requires it.
- **Compact separation** (`0 2px 6px rgb(19 29 27 / 0.05)`): Moderate surface separation.
- **Raised surface** (`0 4px 12px rgb(19 29 27 / 0.06)`): Highest shared light-theme shadow.

### Named Rules
**The Diagram Carries the Grid Rule.** Keep the global canvas quiet; geography and the connected diagram provide the spatial structure.

## Shapes

Shared buttons and inputs use the rounded scale (6–24px), with 24px on their standard size. The atlas, station instrument, map, admin tools use open shapes, square image corners, and hairline rules. Report controls use restrained rounded surfaces, text-and-icon station choices, and a single submit action. Selection is communicated by a visible surface treatment and text or identifier; keyboard focus uses the shared 2px blue outline with a 2px offset. Important actions and map controls retain touch areas of at least 44px.

## Components

### Buttons
- **Character:** Quiet, direct controls; filled for the primary action, outlined for secondary work.
- **Shape:** Rounded shared controls (24px default, 18px small, 24px large).
- **Primary:** River-chart Blue fill with canvas text; 44px high and 20px horizontal inset.
- **Hover / Focus:** Slightly reduce primary fill opacity on hover; show a 2px blue ring with a 2px offset on keyboard focus. Disabled controls reduce opacity.
- **Secondary / Ghost:** A quiet border on transparent background, or no resting surface for the ghost variant.

### Inputs / Fields
- **Style:** 44px high, full-width, warm canvas fill, one-pixel border, and 24px shared radius.
- **Focus:** 2px interactive-blue ring with a 2px offset; placeholder uses muted ink.
- **Error / Disabled:** Errors use an explicit semantic warning or danger treatment; disabled controls reduce opacity.

### Navigation
- **Style:** The global header is transparent over the Home hero and returns to its compact warm surface after the hero. Desktop route links pair a small icon with a 13–14px Be Vietnam Pro label; current route uses blue type and a short underline. A bottom route navigation keeps public routes reachable on phones.
- **Admin:** The section rail stays visible while scrolling on desktop. At tablet/phone widths it is replaced by the full-width operations selector.
- **States:** Hover uses a quiet canvas wash. Focus remains visible with the shared outline.

### Cards / Containers
- **Character:** Use section structure and separators rather than a stack of identical floating cards.
- **Background:** Canvas and recessed paper carry most regions; the dark connected diagram is the notable deep surface.
- **Border:** One-pixel divider rules organize records, triptychs, and instrument sections.
- **Padding:** Use the spacing scale; the chapter and evidence regions grow fluidly with the viewport.

### Signature: Station-scoped Observatory

The register selects a station in both the list and geographic map. The instrument follows that station and places its identifier, location, timestamp, freshness, and quality near the readings where available. Its domain-filtered trend also follows the selection; gateway selection does not show an environmental trend. External weather remains subordinate and separately attributed. The live display starts with the server-rendered snapshot, then applies the public allowlisted Realtime projection to local state without telemetry polling or page refresh; the small red dot appears only while the stream is subscribed. Connection status is not a device-health claim.

### Signature: Reporting Notebook

The three-step rail marks the active step and permits return to reached steps. The final evidence panel accommodates photo, video, and voice capture, including voice recording, with a three-file total limit. Upload progress and partial media failures are shown in context.

### Signature: Connected Diagram

Numbered nodes sit on a connected path across desktop and stack along a vertical connector on narrower screens. Diagram tones remain scoped to this engineering explanation.

## Do's and Don'ts

### Do:
- **Do** use the existing Cồn Hô illustration, commissioned media, equipment photographs, and geography as the source of the visual story.
- **Do** keep the cover title to its two authored rows and lead with place, context, and Observatory action.
- **Do** preserve station identity: `STATION_01` water, `STATION_02` soil and microclimate, `STATION_03` gateway location/role, and `GATEWAY_01` the technical gateway.
- **Do** keep each Observatory reading tied to its selected station and preserve source, time, freshness, and quality when provided.
- **Do** keep demo readings explicitly marked and external context attributed separately from HORIZON telemetry.
- **Do** keep reporting to its three steps and its existing three-file combined media limit.
- **Do** retain visible focus, responsive navigation, and outdoor touch targets.

### Don't:
- **Don't** add station counts or a second system register to the cover.
- **Don't** invent measurements, status, thresholds, recommendations, field validation, or device acknowledgements.
- **Don't** treat missing data as zero, external weather as HORIZON telemetry, EC as salinity, or bulk soil EC as ECe.
- **Don't** imply that stored configuration or calibration records prove device receipt, calibration, or execution.
- **Don't** let the connected stream dot read as a device-health indicator.
- **Don't** add a decorative global grid; keep spatial geometry in maps and the connected data path.

### Latest owner refinements

All font roles explicitly support Vietnamese. The connected signal appears beside
the Monitoring title as a larger red dot with expanding rings. Home media uses a
980px maximum measure and shorter single-line headings. Admin includes a network
drawing and rectangular keyword treatments, using actual station/report/threshold counts.

### Shared tool pages and risk calendar

Monitoring, Report, and Admin use ToolPageHeading: Newsreader title, supporting
copy, a drawn network line and an animated fine rule. Every bento box has a subtle
source/connection indicator beside its header. The smaller 2x1 lower box contains
soil moisture and pH; the 4x1 box contains an 84-cell daily risk calendar, with only
the available 30-day history populated. Gray indicates missing data or an applicable
threshold, never safety. Calendar colors use current configured salinity thresholds
or active operational/site-validated bands. Daily means are identified. Water EC,
water temperature, soil EC and soil temperature remain in an expandable probe register.
Report stays one page, with restrained paper surfaces and animated selection marks.
All expressive motion has a reduced-motion alternative.

Visual references inspected: motion.dev (layout/gesture motion), bklit.com (interactive
heatmap), kokonutui.com (control states), animejs.com (SVG line drawing). Adapted as
small native components rather than copied page layouts.

### Full-year calendar and field-page revision — 2026-10-03

This revision supersedes the earlier signal/calendar/report composition notes.
Signals are stronger and remain inside each bento heading. The lower 4x1 is a
January–December combined daily-risk calendar (365/366 actual dates), with no
metric selector or isolated-value sidebar. Public history reads back to January
and paginates beyond Supabase's row limit. The highest applicable supported
severity determines each day; device/sensor-quality bands are excluded from
environmental risk, and unclassified/future dates remain distinct. Keyboard
navigation and a mobile date picker expose the complete calendar.

The shared headings retain Newsreader titles and subtitles; their connection
line diagram is removed. Report adopts Home's existing Cồn Hô illustration,
an editorial invitation, section links, open form composition and a tinted
media workspace. It remains one continuous form with no station photographs.
Admin sign-in now uses the shared title/subtitle and an illustrated composition.
The authenticated console replaces its connection drawing with an illustrated
field overview and real-count navigation. Reduced-motion behavior is retained.

### Keyword-heading refinement — 2026-10-03
Home chapter subjects and shared tool-page titles use the Report invitation's
Newsreader serif and sage rectangular highlights, with a dark-surface variant.
The Report opening becomes a shallow horizontal composition on desktop and
retains its stacked phrase on mobile. Risk levels use light-to-deep red only;
unclassified and future cells remain unfilled. Only genuinely connected live
streams render red dots; historical, external, disconnected and demo dots are
removed. The risk-method sentence and admin sign-in description are removed
at the owner's request.

### Compact monitoring and single-page form — 2026-10-03
The calendar is now a 2x1 region with six calendar months, square day cells,
and no picker, detail panel, legend or explanatory text. Accessible date/risk
labels remain on the cells. Historical reads retain at least six months across
New Year. The mobile/tablet map is last in both reading and DOM order. Desktop's
map extends into the freed cells; soil and calendar occupy adjacent 2x1 regions.
The probe disclosure below the bento is removed at the owner's request.

Full page titles have complete highlight backgrounds, including the Home cover
lines. Report's section index is removed. Station, condition, description and
evidence headings share Home's editorial serif and keyword highlight treatment.
Mobile footer is one row of brand, place and copyright; navigation remains in
the fixed mobile navigation.

### Selective emphasis and paired reporting sections — 2026-10-03
Home cover, Report Station and Description retain plain editorial text. Report
Condition and Evidence retain full highlights. Location choices occupy two rows
of two. Condition and Description are separate sections beside each other on
desktop, stacked on phones, grouped by a warm field-note surface. Choice hover
and selected states retain real radio semantics. Hero continuation link removed.
Monitoring map has no location label or connection dot. Desktop risk calendar
returns to 4x1 and a full calendar year; phone/tablet stays 2x1 with six months.
Day cells remain square, contents vertically centered, and a compact color legend
returns without a picker or explanatory panel.

### Open Report form and calm filled monitoring — 2026-10-03
Report Condition and Description are independent sections again. The station
chooser returns to four unboxed rows, with icons at the left, one-line identity
and code, and one-line location details. Home's network icons move to the left;
metrics remain on one horizontal line, scrolling within the row on narrow screens.
A faint existing Cồn Hô illustration sits behind the network list.
Monitoring region tints are muted sage, straw and coral, with medium-weight data.
Status headers no longer truncate; visible basis text is condensed into the
status tooltip/accessible label. Heatmap is titled History, its heading fixed
to the top while the calendar and color legend center in the remaining space.

### Mobile capability labels and history alignment — 2026-10-03
On phones, soil station capabilities are shortened into Soil (moisture, EC, pH,
temperature) and Air (temperature, humidity), keeping all six capabilities
without a horizontal scrollbar. The mobile data path is a centered vertical
sequence. Report Evidence heading now sits outside its tinted attachment box.
History color labels sit beside the year in the heading area; the calendar
aligns to the bottom. Region status tints are slightly stronger sage, amber
and coral, retaining medium-weight figures.

### Mobile readability correction — 2026-10-03
Soil capabilities retain complete metric names, arranged in two columns on
phones with no scrollbar. Mobile/tablet History heading, compact color scale
and year share one line; intermediate color names remain in accessible labels
and tooltips. Calendar returns to vertical centering on narrow screens.
Desktop History positioning and complete color labels are unchanged.

### Map location refinement
- Surveyed island station markers use red geographic waves, independent of telemetry status. Below zoom 14, show one Cồn Hô marker; demo basemaps show only the known island point.
- With granted geolocation permission, show a separate blue device marker and accuracy circle, plus a control to reach it. Keep location local, never auto-prompt or change report coordinates. Remove the marker on revocation.

### Monitoring scale and status refinement
- Percentage plots use 0–100; pH uses 0–14. Rain, wind, conductivity and salinity scales cannot extend below zero. Units sit above the vertical axis.
- Monitoring status surfaces progress from pale rose to stronger red, with matching dark-theme tints. Status calculations and labels retain their meaning.

### Map framing and compact labels
- With granted location, initially fit Cồn Hô and the device into the same map box; the location control restores this combined view. When the position is unavailable, frame the island.
- Chart ticks include units next to every number. Network capabilities remain on one line; narrow screens group full soil and air quantities to avoid repeating their qualifiers.

### Final requested alignment audit
- Keep the user position marker without a visible location label. Preserve combined island/device framing.
- Network rows show station identifiers, names and full capability labels. Remove location subtitles and freshness lines here. Capabilities align with the name at all widths; mobile wraps complete labels instead of shrinking or repeating grouped qualifiers.
- Chart units return above the vertical scale with a 20px label offset and 44px top inset. Tick numbers carry no units.
