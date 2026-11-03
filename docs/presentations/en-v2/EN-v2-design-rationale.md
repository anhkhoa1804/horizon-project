# HORIZON EN pitch v2: design rationale and open placeholders

## What changed from v1, and why
v1 (archived in `../archive/en-v1-2026-10-21/`) was honest but read like a compressed engineering report. Seven of ten main
slides used the same "text block + one picture" layout. There were no people and no fieldwork, a single light typeface
throughout, and the strongest content was in the appendix.

v2 is built around one idea: **a living laboratory on a river island.** It follows the path
PLACE → PROBLEM → PEOPLE → FIELDWORK → TECHNOLOGY → INFORMATION → VALIDATION → NEXT STEPS:

| # | Slide | Composition |
|---|---|---|
| 01 | A living laboratory on a river island | Full-bleed aerial, editorial headline |
| 02 | Forecasts describe a region / Growers decide for one plot | Typographic contrast + schematic cell |
| 03 | Why Cồn Hô | Tall documentary photo + three-line field note |
| 04 | The road to the pilot is a river | Full-bleed boat landing |
| 05 | Built and checked on the island | Workshop photo, narrow text column |
| 06 | Two sensing stations. One gateway. | Installed station (annotated) + node list |
| 07 | From conditions to information | Five steps on the horizon line, evidence glyphs, "today" marker |
| 08 | One public page | Large real Observatory capture + phone |
| 09 | A working pilot, observed in the field | Three large figures |
| 10 | What we have not proven yet | Built → observed → proven scale + six open items |
| 11 | From pilot to trusted instrument | Four steps beside the river at dusk |
| 12 | What your support makes possible | Ask / enables / partners-receive matrix |
| 13 | Help us turn readings into information people can trust | Full-bleed installed station, person, Cồn Hô sign |
| A1–A4 | Evidence, open findings, release gates, image sources | Tables |

## The system
- **Type:** Newsreader for headlines and figures (editorial voice), Be Vietnam Pro for text, IBM Plex Mono for field-log
  captions and labels. All three cover Vietnamese, so a VI adaptation can reuse `hz2.py` unchanged.
- **Colour, sampled from the photographs:**
  - grounds: canopy `#14231C`, silt `#EDE6D8`, paper `#F7F3EA`;
  - text: ink `#17201B`, mute `#5A645D`, fog `#C9D1C8`;
  - accents: clay `#7A5C3A`, and HORIZON orange `#E8892B` on dark / `#96490F` on light.
  - Every text pairing is at least 4.9:1, except where noted in `hz2.py`.
- **The horizon line:** one hairline at y=952 carrying a sentence-case field-log caption (date · place · what is shown ·
  photo credit). It is the deck's only recurring chrome. Slides 07 and 11 put their diagram on it.
- **Evidence glyphs:**
  - ● observed in the field;
  - ◐ built, not yet complete or observed;
  - ◌ (dashed) designed / not yet proven.
  - The glyphs are always paired with words; colour never carries meaning alone.
- **Rhythm:** dark, light and photographic grounds alternate, so no two neighbours share a composition.
  - Headlines sit top-left at the same margin.
  - Big figures appear only on slide 09.
  - Software test counts are deliberately kept off the main slides (A1).
- **Motion:** fade transitions only. Builds appear only on 07 (steps appear in order) and 11 (the path). The static PDF
  shows the final state.
- **Known trade-off:** IMG_1522 appears twice, as a portrait crop on 06 and a wide crop on 13. It is the only photograph of
  an installed station, and the close needs the people and the place. If a second installation photo exists, use it on 06.

## Critique rounds (rendered and inspected at 1920×1080)
1. **First three samples (cover, landing, figures).**
   - Removed the tracked-caps section eyebrows: they were the repetitive labels the brief rejected.
   - Strengthened the cover scrim and added the Frogsleap identity.
   - Made captions one-line sentence case.
   - Replaced three repeated "observed" captions with one legend.
2. **Full deck, round 1.**
   - Fixed text collisions on 06.
   - Separated "Understand" and "Act" on 07.
   - Made the 09 headline a single line so the figures breathe.
   - Moved the 11 footer clear of the last step.
   - Added a scrim under the 05 caption.
3. **Full deck, round 2.**
   - Rewrote 05 copy to claim only what the photo and your description support.
   - Re-composed 08's left column so the phone no longer crowds the text.
   - Added a "today" marker on 07 to tie it to slide 10's scale.
   - Moved the 06 annotation off the flags and the 02 label off the dashed border.
   - Darkened clay and light-ground orange to pass 4.5:1.

## Unresolved factual placeholders (fill before presenting)
| Where | Placeholder |
|---|---|
| 01 | `[Month 2026]` presentation date |
| 06 | Which station IMG_1522 shows (water or soil) |
| 05 | Confirm the tasks done on 5 Sep 2026 ("assembled, checked and troubleshot") |
| 05 | Confirm the "What the team did" list (boards, firmware, website, installation) |
| 11 | `[duration]` for each of the four steps |
| 11 | The long-term operator |
| 12 | `[Amount]` and `[period]` |
| 12 | The partner names and roles, if known |
| 12 | Whether "quarterly progress" and "co-authorship" are offers you want to make |
| 13 | `[Name]` and `[email]` |
| A4 | Consent of the people pictured in IMG_1612, IMG_1696 and IMG_1522 |
| 03 | "About a kilometre long" comes from the project's own gallery caption; confirm or replace with a measured length |
| 09 | 6,465 readings and the 2.5-minute interval come from the read-only check on 21 Oct 2026; re-count on presentation day if the date matters |

## Editing
- Copy lives in `source-v2/build_en.py`. The visual system lives in `source-v2/hz2.py`.
- Run `prep_images.py`, then `build_en.py out`, then `render.py out render`. These produce the PNGs and the PDF.
- For a Vietnamese version, copy `build_en.py` to `build_vi.py` and translate the strings. Proper names (Cồn Hô, Vĩnh Long)
  are already in their Vietnamese form.
