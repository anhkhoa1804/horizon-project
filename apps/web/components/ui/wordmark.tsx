import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  href?: string;
  /**
   * `fluid`   — height follows the `--header-logo` custom property and
   *             transitions with it. This is what makes the mark read as one
   *             continuous object gently compacting on scroll instead of
   *             snapping between two discrete sizes, which is what a class
   *             swap (h-16 → h-12) produced.
   * `compact` — footer / secondary surfaces, where the mark is a signature
   *             rather than a brand anchor.
   */
  markSize?: "fluid" | "compact";
  className?: string;
}

/** The wordmark's real aspect ratio (829×301) — used only as the width/height CLS hint. */
/* viewBox of logo.svg: 1522.5 x 552.75 — the same 2.754 ratio the PNG had. */
const LOGO_ASPECT_RATIO = 1522.5 / 552.75;
const LOGO_INTRINSIC_HEIGHT = 200;

const markSizeClasses: Record<NonNullable<WordmarkProps["markSize"]>, string> = {
  // The transition is on `height`, and the value comes from a var the header
  // reassigns — so one class change on the header interpolates the mark.
  //
  // Duration and easing MUST match the header row's own height transition
  // (site-header.tsx). They were 420ms/ease-brand against the header's
  // 190ms/ease-standard, so the mark carried on shrinking for 230ms after
  // the bar around it had already settled — read as the logo bouncing
  // independently of the header rather than the two moving as one object.
  fluid: "h-[var(--header-logo)] transition-[height] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
  compact: "h-8",
};

/**
 * The real HORIZON wordmark, linked home — the sole brand lockup across every
 * header/footer surface. Mark-only: the mark already reads as the wordmark,
 * so there is no separate text title to configure.
 */
export function Wordmark({ href = "/", markSize = "fluid", className }: WordmarkProps) {
  return (
    <Link href={href} aria-label="HORIZON — trang chủ" className={cn("group inline-flex items-center", className)}>
      {/* Plain <img>, not next/image: small fixed local asset with a known
          aspect ratio; next/image previously crashed at render time here with
          a module-resolution error unrelated to the asset itself. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/brand/logo.svg"
        alt="HORIZON"
        width={Math.round(LOGO_INTRINSIC_HEIGHT * LOGO_ASPECT_RATIO)}
        height={LOGO_INTRINSIC_HEIGHT}
        // No `wordmark-mark` keyline any more. That class stacked four
        // offset drop-shadows to trace a light edge around the PNG's alpha,
        // because the PNG's dark outlines disappeared against a graphite
        // background. This asset carries its own white keyline, so the
        // synthetic one would double it into a thick halo.
        className={cn("w-auto shrink-0", markSizeClasses[markSize])}
      />
    </Link>
  );
}
