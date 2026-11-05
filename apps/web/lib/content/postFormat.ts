import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n";

/** Display date for a post. Falls back to the raw string when it is not a date. */
export function formatPostDate(iso: string, locale: Locale, style: "long" | "short" = "long"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tag = locale === "en" ? "en-GB" : "vi-VN";
  return new Intl.DateTimeFormat(tag, style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/**
 * Frontmatter stores "N <minutes-to-read in Vietnamese>" (escaped below to keep this file free of
 * Vietnamese text); show it in the active language. Any other string is shown as written.
 */
export function readingTimeLabel(value: string, minReadTemplate: string): string {
  const match = /^(\d+)\s*ph\u00fat \u0111\u1ecdc$/.exec(value.trim());
  return match ? fmt(minReadTemplate, { count: match[1] }) : value;
}
