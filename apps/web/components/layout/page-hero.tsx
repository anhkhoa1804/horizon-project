import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one first-screen block every public page opens with.
 *
 * WHY THIS EXISTS.
 *
 * Home, About, Monitoring and Report had each grown their own hero, and the
 * four had drifted into four different designs: eyebrows at 0.28em and
 * 0.18em tracking, three different title tiers, Home carrying two lead
 * paragraphs where Report carried one line, About carrying a metadata
 * definition list nothing else had, and four different top offsets. Read in
 * sequence they did not look like one product.
 *
 * The fix is a shared GRAMMAR rather than a shared appearance. Every page
 * supplies the same three parts —
 *
 *     EYEBROW  ·  TITLE  ·  ONE SUBTITLE
 *
 * — rendered at the same scale, measure and rhythm. What varies is only what
 * genuinely differs between pages: the title tier (Home is allowed to be
 * more cinematic) and whether the page has earned an action or a status
 * marker.
 *
 * `actions` and `aside` are deliberately optional and deliberately awkward
 * to over-use. A hero is not a place to park controls: the owner's note was
 * that small "râu ria" accumulating under every title made the pages feel
 * unfinished. If a page's real action is the thing below the fold — the
 * report form is its own call to action — it passes nothing here.
 */

interface PageHeroProps {
  eyebrow: string;
  title: string;
  /**
   * Exactly one, if the page wants one at all. If it needs two paragraphs, it
   * belongs below the hero.
   *
   * Optional because Monitoring dropped its: on a page whose whole job is to
   * show current readings, a sentence describing what the readings are pushed
   * the first measurement down without telling a returning reader anything.
   * The editorial pages still open with one.
   */
  subtitle?: string;
  /**
   * `display` is the homepage's cinematic tier and holds roughly a screen.
   * `editorial` is the sibling tier for long-form pages — About today.
   * `observatory` is one step down again, for data-dense pages that need
   * more of the first screen given to content than to the title — Monitoring
   * and Report. All three share the same eyebrow/title/subtitle grammar, so
   * the ladder reads as one system rather than "Home" and "everything else".
   */
  scale?: "display" | "editorial" | "observatory";
  /** Only when the page's primary action is not already on screen below. */
  actions?: ReactNode;
  /** Only when it materially contributes — e.g. Monitoring's demo-mode flag. */
  aside?: ReactNode;
  /**
   * Per-route background imagery. Renders behind the text at z-0 with the
   * copy at z-10, so a route can supply an image without touching this
   * component's layout.
   *
   * Home is the only route that passes one today — see
   * components/home/hero-backdrop.tsx. The other three stay on the gradient
   * atmosphere deliberately: a photographic hero on every page would make the
   * set read as a template, and Monitoring in particular needs its first
   * screen for readings rather than for scenery.
   */
  backdrop?: ReactNode;
}

const TITLE_SIZE: Record<NonNullable<PageHeroProps["scale"]>, string> = {
  display: "text-[length:var(--text-title-display)] leading-[1.08]",
  editorial: "text-[length:var(--text-title-editorial)] leading-[1.12]",
  observatory: "text-[length:var(--text-title-observatory)] leading-[1.14]",
};

export function PageHero({
  eyebrow,
  title,
  subtitle,
  scale = "editorial",
  actions,
  aside,
  backdrop,
}: PageHeroProps) {
  const isDisplay = scale === "display";

  return (
    // `.h-hero` supplies the shared top/bottom rhythm for the PAGE tier. The
    // display tier opts out: its inner block already declares an explicit
    // viewport-proportional height, and adding rhythm padding on top of that
    // pushed the section to 103% of the viewport (header + hero = 113%),
    // which defeats the point of sizing it to 88svh in the first place.
    //
    // The `observatory` tier gets a tighter rhythm than the editorial one.
    // `.h-hero` spends --rhythm-large (up to 7rem) above AND below the title,
    // which is right for a page you read and wrong for one you monitor: at
    // 1440 it pushed the first measurement past the fold with nothing above it
    // but chrome. Half the padding, same grammar.
    <section
      className={cn(
        "relative",
        // The display tier is the OPENING SCENE: it pulls itself up under the
        // header, runs a full viewport, and carries the backdrop edge to edge.
        // `.home-hero-shell` owns that geometry so the negative offset and the
        // 100svh stay in one place rather than being restated per page.
        isDisplay
          ? "home-hero-shell"
          : scale === "observatory"
            ? "py-[var(--rhythm-normal)]"
            : "h-hero",
      )}
    >
      {/* The backdrop is NOT wrapped in an inset-0 box any more: it positions
          itself from the document top and spans the viewport width, so the
          picture starts at pixel zero and the header sits on it. */}
      {backdrop}

      <div
        className={
          isDisplay
            ? // THE FIRST SCREEN.
              //
              // 88svh minus the header, so header + hero together occupy 88%
              // of the viewport and roughly 12% of the next section stays
              // visible at the bottom edge. That remainder is deliberate: a
              // hero that exactly fills the screen reads as a dead end, while
              // a sliver of the following content signals that the page
              // continues without inviting the reader to scroll past it.
              //
              // The previous value — clamp(26rem, 100svh − header − 6rem,
              // 40rem) — capped at 40rem (640px), so on a 900px window the
              // hero stopped at 71% and the composition read as the top of a
              // document rather than a landing page. The cap is gone; `svh`
              // (not `vh`) keeps mobile browser chrome from clipping it.
              //
              // `justify-center` with generous padding puts the title block
              // slightly above optical centre, which is where a headline sits
              // in an editorial layout rather than floating mid-frame.
              // The shell already declares the viewport height; this just
              // centres the copy within whatever is left under the header and
              // keeps it off both edges.
              "relative z-10 flex flex-1 flex-col justify-center py-[clamp(2rem,7vh,5.5rem)]"
            : "relative z-10"
        }
      >
        {/* `max-w-3xl` caps the measure in BOTH languages: English runs
            10–15% longer than Vietnamese here, and without a shared cap the
            two would wrap to different heights and change the hero's size
            when the reader switches language. */}
        {/* The display tier gets a wider measure than the page tiers. Its
            title is a sentence at 60px, and 768px would break it over three
            lines; 1024px holds it in two in both languages. The narrower tiers
            keep max-w-3xl, where their smaller type already reads well. */}
        <div className={cn("animate-entrance", isDisplay ? "max-w-5xl" : "max-w-3xl")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            {eyebrow}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className={cn("whitespace-pre-line font-semibold tracking-tight", TITLE_SIZE[scale])}>{title}</h1>
            {aside}
          </div>

          {subtitle ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{subtitle}</p>
          ) : null}

          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
