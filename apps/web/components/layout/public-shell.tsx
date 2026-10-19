"use client";

import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileNavigation } from "./mobile-navigation";

export function PublicShell({
  children,
  activePath,
  backdrop,
}: {
  children: React.ReactNode;
  activePath?: string;
  /**
   * A full-bleed canvas painted behind the header AND the first screen.
   *
   * It belongs HERE rather than inside the page, because only the shell knows
   * where the document actually starts. Rendering it inside <main> meant
   * clawing back the header height and main's padding with a negative margin,
   * and that arithmetic was wrong: `--header-h` is 5.5rem while the header
   * actually renders at 65px, so the hero over-pulled and left a bare strip
   * at the bottom of the first screen. As a sibling of the header, top: 0 is
   * simply the top of the page and there is nothing to compensate for.
   */
  backdrop?: React.ReactNode;
}) {

  return (
    // No background of its own: the drafting-grid canvas painted in
    // RootLayout sits behind every page, and giving the shell an opaque
    // background here would hide it and reintroduce the stacked-layers look.
    <div className="relative min-h-dvh text-foreground">
      {backdrop}

      <SiteHeader register="public" activePath={activePath} />

      {/* `h-wide` is the single outer measure for every public page — the
          same left/right edge the header and footer use, so nothing drifts
          between chrome and content. Sections that need to break out do so
          explicitly with .full-bleed or .h-spatial. */}
      <main className={`public-main ${activePath === "/" ? "public-main--home" : activePath === "/report" ? "h-text" : "h-media"} relative pb-8 pt-4 md:pt-8`}>{children}</main>

      <Footer />

      <MobileNavigation activePath={activePath} />
    </div>
  );
}
