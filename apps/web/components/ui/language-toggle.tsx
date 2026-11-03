"use client";

import { cn } from "@/lib/utils";
import { setLocaleCookie, useDict, useLocale } from "@/lib/i18n/client";
import { LOCALE_FULL_LABEL, LOCALE_LABEL, type Locale } from "@/lib/i18n/config";

/**
 * Single compact button showing the CURRENT language (VI or EN). One press switches to the other.
 *
 * Same size, border and hover grammar as the theme button beside it. The accessible name is the
 * destination ("Switch to English"), matching the icon button's behaviour. The choice is stored as
 * before (setLocaleCookie), which also reloads the page in the new language.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const current = useLocale();
  const dict = useDict();
  const next: Locale = current === "vi" ? "en" : "vi";
  const label = next === "en" ? dict.controls.switchToEnglish : dict.controls.switchToVietnamese;

  return (
    <button
      type="button"
      onClick={() => setLocaleCookie(next)}
      aria-label={label}
      title={LOCALE_FULL_LABEL[current]}
      className={cn(
        "site-control site-control--text",
        className,
      )}
    >
      {LOCALE_LABEL[current]}
    </button>
  );
}
