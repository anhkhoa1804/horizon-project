"use client";

import type * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useDict } from "@/lib/i18n/client";
import { isPublicNavActive, OPERATIONAL_NAV_HREF, PRIMARY_NAV_LINKS } from "@/lib/publicNav";

/**
 * Scroll-compaction state, with hysteresis.
 *
 * Two thresholds, not one: the header only compacts above `enter` and only
 * expands again below `exit`. A single threshold is what made the header
 * shake — compacting removes 24px of flow height, which shifts the document
 * under the reader, which can push scrollY back across that same threshold,
 * which expands the header, which shifts it back. With a 48px dead band
 * between the two, that feedback loop cannot close.
 *
 * Reads are also throttled to one per animation frame. The listener itself
 * is passive and does nothing but schedule; all layout reads happen inside
 * the rAF callback, so scrolling never triggers a synchronous reflow.
 */
function useScrollCompact(enter = 72, exit = 24): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    let scheduled = false;

    const read = () => {
      scheduled = false;
      const y = window.scrollY;
      setCompact((prev) => {
        if (!prev && y > enter) return true;
        if (prev && y < exit) return false;
        return prev;
      });
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enter, exit]);

  return compact;
}

interface SiteHeaderProps {
  /**
   * Both registers render the same global navigation — "register" only
   * decides whether the admin operational strip is appended below it and
   * which item reads as current. Admin is a hierarchy distinction, not a
   * different product.
   */
  register?: "public" | "admin";
  activePath?: string;
  adminEmail?: string;
  adminActions?: React.ReactNode;
}

/**
 * Icon + label, in the pill/wash active treatment the project owner preferred
 * in the earlier header. Labels tighten one step between `md` and `lg` so the
 * full four-item set still fits a 768px tablet without wrapping or being
 * hidden — the previous build only rendered this nav from `lg` up, which left
 * 768–1023px with no navigation at all (the bottom bar is `md:hidden`).
 */
function NavLink({
  href,
  label,
  active,
  icon: Icon,
  operational = false,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  /** Admin. Same nav family, one notch quieter at rest — a hierarchy cue, not a separate class. */
  operational?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // `whitespace-nowrap` is load-bearing, not cosmetic: without it the
        // label wraps inside the link at tablet widths, every nav item becomes
        // two lines tall, and the header grows from ~64px to ~89px — which is
        // what was visibly compressing the hero on the first screen.
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-2 font-medium lg:gap-2 lg:px-3",
        "text-[13px] lg:text-sm",
        "transition-colors duration-[var(--motion-base)]",
        active
          ? "nav-link-active text-accent"
          : operational
            ? "text-foreground-subtle hover:bg-wash-hover hover:text-foreground"
            : "text-foreground-muted hover:bg-wash-hover hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export function SiteHeader({ register = "public", activePath, adminEmail, adminActions }: SiteHeaderProps) {
  const dict = useDict();
  const compact = useScrollCompact();
  const inAdmin = register === "admin";
  const overHomeHero = !inAdmin && activePath === "/";
  const hasOperationalStrip = inAdmin && Boolean(adminEmail || adminActions);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-[var(--z-sticky)]",
        compact && "is-compact",
        // Transparent at rest so the drafting grid runs through the header;
        // the backdrop is earned only once content is sliding underneath.
        "transition-[background-color,border-color,backdrop-filter] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
        // 88%, not 65%. The lower value let scrolled content stay legible
        // through the bar rather than merely tinting it — over the Monitoring
        // summary line, uppercase tracked text read straight through the nav
        // labels and looked like a collision. Still frosted, still lets the
        // page show as movement underneath; no longer readable through.
        compact || !overHomeHero
          ? "border-b border-border bg-canvas/95 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/88"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "h-wide flex items-center justify-between gap-4",
          // Height interpolates from --header-h, which .is-compact reassigns.
          // Kept short (190ms) and small (24px of travel) so the flow shift
          // it causes is over before it can read as movement.
          "h-[var(--header-h)] transition-[height] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
        )}
      >
        <Wordmark href={inAdmin ? "/admin" : "/"} markSize="fluid" />

        <div className="flex items-center gap-1">
          <nav aria-label={dict.nav.primaryLabel} className="hidden items-center gap-0.5 md:flex lg:gap-1">
            {PRIMARY_NAV_LINKS.map(({ href, key, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={dict.nav[key]}
                icon={icon}
                operational={href === OPERATIONAL_NAV_HREF}
                active={
                  href === OPERATIONAL_NAV_HREF
                    ? inAdmin
                    : !inAdmin && isPublicNavActive(href, activePath)
                }
              />
            ))}
          </nav>

          <div className="mx-1 hidden h-5 w-px bg-border md:block" aria-hidden />

          <ThemeToggle />
          <LanguageToggle className="ml-0.5" />
        </div>
      </div>

      {hasOperationalStrip ? (
        <div className="border-t border-border/60">
          <div className="h-wide flex flex-wrap items-center justify-between gap-3 py-2">
            {adminEmail ? <p className="text-xs text-foreground-muted">{adminEmail}</p> : <span aria-hidden />}
            {adminActions ? <div className="flex flex-wrap items-center gap-3">{adminActions}</div> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
