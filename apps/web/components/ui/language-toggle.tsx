"use client";

import { cn } from "@/lib/utils";
import { setLocaleCookie, useDict, useLocale } from "@/lib/i18n/client";
import { LOCALE_LABEL, LOCALES, LOCALE_FULL_LABEL, type Locale } from "@/lib/i18n/config";

/**
 * VI | EN switcher.
 *
 * A real two-option control rather than a dropdown: with exactly two locales,
 * a select would hide one behind an interaction for no benefit, and both
 * options being visible makes it obvious the site has an English edition at
 * all.
 *
 * Accessibility: rendered as a radiogroup, because that is what it is — a
 * choice between mutually exclusive options, not two independent buttons.
 * Each option carries `aria-checked` and a full-language accessible name
 * ("Switch to Vietnamese") so a screen reader announces the destination
 * rather than reading out the two letters "V" and "I".
 */
export function LanguageToggle({ className }: { className?: string }) {
  const current = useLocale();
  const dict = useDict();

  const accessibleName: Record<Locale, string> = {
    vi: dict.controls.switchToVietnamese,
    en: dict.controls.switchToEnglish,
  };

  const selectLocale = (locale: Locale) => {
    if (locale !== current) setLocaleCookie(locale);
  };

  const moveSelection = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyToIndex: Record<string, number> = {
      ArrowLeft: (index + LOCALES.length - 1) % LOCALES.length,
      ArrowUp: (index + LOCALES.length - 1) % LOCALES.length,
      ArrowRight: (index + 1) % LOCALES.length,
      ArrowDown: (index + 1) % LOCALES.length,
      Home: 0,
      End: LOCALES.length - 1,
    };
    const nextIndex = keyToIndex[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectLocale(LOCALES[nextIndex]);
  };

  return (
    <div
      role="radiogroup"
      aria-label={dict.controls.languageLabel}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-[11px] tracking-[0.08em]",
        className,
      )}
    >
      {LOCALES.map((locale, index) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={accessibleName[locale]}
            title={LOCALE_FULL_LABEL[locale]}
            // Re-selecting the current locale would reload for no reason.
            onClick={() => selectLocale(locale)}
            onKeyDown={(event) => moveSelection(event, index)}
            className={cn(
              "inline-flex min-h-11 min-w-10 shrink-0 items-center justify-center border-b-2 px-1.5 font-medium transition-colors duration-[var(--motion-base)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground-subtle hover:text-foreground",
            )}
          >
            {LOCALE_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
}
