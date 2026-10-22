/** The cover uses the same supplied day/night scene as the global backdrop.
 *
 * Two layers, two jobs. `.hero-canvas` is the taller decorative box (one screen plus the scroll-reveal
 * strip below it); `.hero-canvas__photo` is the actual picture, pinned to exactly one screen tall at the
 * top of that box. The photo therefore renders with true `cover` against its own 100svh box — the same
 * sizing math the page always used, guaranteed to fill the width at any viewport ratio — so the visible
 * frame is pixel-identical to the original, un-overshot hero. The strip below the photo is blank; the
 * mask on `.hero-canvas` dissolves the photo's own bottom edge into that blank strip, reachable only by
 * scrolling, without resizing or cropping the photo itself. */
export function HeroBackdrop() {
  return (
    <div className="hero-canvas" aria-hidden>
      <div className="hero-canvas__photo" />
      <div className="hero-canvas__scrim" />
    </div>
  );
}
