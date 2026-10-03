"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { useDict } from "@/lib/i18n/client";
import { isPublicNavActive, PRIMARY_NAV_LINKS } from "@/lib/publicNav";

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
  const dict = useDict();

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

      <nav
        aria-label={dict.nav.mobileLabel}
        className="fixed inset-x-0 bottom-0 z-[var(--z-drawer)] border-t border-border bg-canvas/85 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">
          {PRIMARY_NAV_LINKS.map(({ href, key, icon: Icon }) => {
            const active = href === "/admin" ? false : isPublicNavActive(href, activePath);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 min-w-[3.25rem] flex-col items-center gap-1 rounded-sm px-1.5 py-2",
                    "text-[10px] transition-colors duration-[var(--motion-base)]",
                    active ? "text-accent" : "text-foreground-muted",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="font-medium">{dict.nav[key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
