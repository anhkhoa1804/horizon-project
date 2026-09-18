import type { Dictionary } from "@/lib/i18n/vi";
/**
 * The six report categories the API accepts (see the CATEGORIES const in
 * app/api/public/reports/route.ts — these values must stay in sync with it;
 * the route rejects anything else with 400 invalid_category).
 *
 * Plain data module with no "use client" directive on purpose: both the
 * server-rendered page and the client form import it. A constant exported
 * from a "use client" module resolves to an opaque client reference when a
 * Server Component imports it, which fails at runtime despite type-checking
 * clean — the same trap that produced the PUBLIC_NAV_LINKS bug in the
 * shared-shell phase.
 */

export interface ReportCategory {
  /** Wire value sent to the API. Must match the route's CATEGORIES list. */
  value: "erosion" | "flooding" | "pollution" | "infrastructure" | "sensor" | "other";
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  { value: "erosion" },
  { value: "flooding" },
  { value: "pollution" },
  { value: "infrastructure" },
  { value: "sensor" },
  { value: "other" },
] as const;

/**
 * The wire value doubles as the dictionary key, so a category can never be
 * sent to the API under one name and shown to the reader under a label that
 * drifted away from it.
 */
export function categoryLabel(value: string, dict: Dictionary): string {
  const key = value as ReportCategory["value"];
  return dict.reportCategories[key] ?? value;
}

/** Mirrors the route's own MIN/MAX so the UI can validate before a round-trip. */
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;
