# Shared design system: decisions
- One typeface, Be Vietnam Pro (Vietnamese-safe), light 200-300 for display, 400-500 for text, 700 only for short leads. Sentence case, no tracked-caps labels, no plate numbers.
- Palette from the place: river teal #16302F, deeper #0E2220, silt #E9E2D0, paper #F8F4EA, sand #CDBC93 for secondary text on dark, brand orange #F28C00 as a single accent per slide.
- One idea and one dominant visual per slide; backgrounds alternate dark, light and photographic so no two neighbours look alike.
- Navigation: ten short segments at bottom-left show position in the talk; it is the only recurring chrome.
- Honesty is visual: illustrations are captioned as illustrations, bench photos as bench photos, placeholders are bracketed and underlined, missing photos are dashed slots. Evidence badges are removed from the story and survive only as plain-language appendix rows.
- Motion: one rise for the headline and one fade for the support line; progressive reveals for the three/four/five-step slides. Present mode only; static PDF shows the final state.
- Two decks share hz.py (tokens, helpers); copy lives in build_en.py and build_vi.py.
