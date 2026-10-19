import { ClipboardList, Home, LayoutDashboard, Shield } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Shared by SiteHeader's desktop nav, PublicShell's mobile bottom nav, and
 * Footer — one array so all three can never drift out of sync.
 *
 * Deliberately NOT exported from site-header.tsx (a "use client" module):
 * Footer and PublicShell's mobile nav are Server Components, and importing a
 * plain data value from a "use client" module into a Server Component
 * resolves to an opaque client reference, not the actual array — this file
 * has no "use client" boundary, so the value is a normal export everywhere.
 *
 * Each entry carries a dictionary KEY rather than a literal label. The label
 * a reader sees now depends on their locale, and there are three separate
 * renderers of this list — hardcoding Vietnamese here would have meant
 * translating it in three places and letting them drift.
 */
export type NavKey = keyof Dictionary["nav"];

/**
 * THE FOUR PRIMARY DESTINATIONS.
 *
 * Home, Monitoring, Report, Admin — and nothing else. Two changes made this
 * the list:
 *
 * ABOUT IS GONE. It was a second narrative page competing with Home for the
 * same job, and the two had duplicated each other into near-parity: both
 * opened with the island, both introduced the same three stations, both
 * explained the same data flow, both ended with the same field notes. A
 * reader had no way to know which one answered "what is this project". Home
 * absorbed the material that was genuinely About's own (the place, the
 * hardware, interpretation, the gallery, who builds it) and `/about` now
 * redirects there.
 *
 * ADMIN IS A TAB. It was rendered as a bare shield icon with no label, which
 * made the one destination with real consequences the only one a reader
 * could not name. Being authenticated is not a reason to be unlabelled — the
 * route is still protected; it is simply no longer a secret. The icon stays
 * beside the word as an operational cue.
 */
export const PRIMARY_NAV_LINKS = [
  { href: "/", key: "home", icon: Home },
  { href: "/dashboard", key: "monitoring", icon: LayoutDashboard },
  { href: "/report", key: "report", icon: ClipboardList },
  { href: "/admin", key: "admin", icon: Shield },
] as const satisfies readonly { href: string; key: NavKey; icon: unknown }[];

/**
 * `/admin` is the operational one. Renderers use this to give it a slightly
 * different weight without moving it out of the list — a hierarchy cue, not a
 * separate class of navigation.
 */
export const OPERATIONAL_NAV_HREF = "/admin";

export function isPublicNavActive(href: string, activePath?: string): boolean {
  return activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
}
