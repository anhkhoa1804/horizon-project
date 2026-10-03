/**
 * THE SINGLE GLOBAL BACKGROUND OWNER.
 *
 * Exactly one of these is mounted, in the root layout, and it owns every
 * whole-page background layer HORIZON has:
 *
 *   · the survey grid        (::before — a fine, low-contrast survey graticule)
 *   · the atmospheric pools  (::after  — cool / warm / green / centre lift)
 *   · the vignette           (::after  — edge falloff, closes the composition)
 *
 * WHY THIS IS A COMPONENT RATHER THAN A BARE DIV.
 *
 * The previous arrangement had the grid here and a SECOND global texture —
 * a dot field — attached to the shared `PageHero`. Because every public page
 * uses that hero, and because the grid runs the full height of every page,
 * the two textures were always on screen together: dots and squares layered
 * over each other on all four routes. That is the "visually busy" background
 * the owner reported, and it was invisible in code review precisely because
 * the two layers lived in different files and neither one looked wrong
 * alone.
 *
 * The rule that prevents it recurring: a page or section may style its OWN
 * box however it likes, but it may not introduce a texture that spans the
 * viewport. Anything whole-page belongs here. `tests/singleBackground.test.ts`
 * enforces it — a new full-bleed `background-image` outside this file fails
 * the build.
 *
 * `aria-hidden` because it is pure atmosphere: there is nothing here for a
 * screen reader to announce.
 */
export function BackgroundAtmosphere() {
  return (
    <div className="horizon-atmosphere" aria-hidden>
    </div>
  );
}
