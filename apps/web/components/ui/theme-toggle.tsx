"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { applyTheme, resolveTheme, THEME_ATTRIBUTE } from "@/lib/theme";

/**
 * Light / Dark / System selector for the global shell.
 *
 * Precedence (documented in lib/theme.ts): an explicit stored choice wins; with none, the
 * operating system's `prefers-color-scheme` decides — never the clock. New visitors are on
 * "System". "System" removes the stored key, so the OS media query is back in charge and the
 * page follows OS changes live (CSS-only; no JS needed).
 *
 * Renders a fixed-size placeholder until mounted: the server cannot know localStorage, so
 * rendering the active option on the server would mismatch on hydration. The placeholder
 * keeps the header from shifting when the real control appears.
 */
const OPTIONS: { value: "light" | "dark"; Icon: typeof Sun }[] = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const dict = useDict();
  const [pref, setPref] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setPref(resolveTheme());
  }, []);

  if (pref === null) {
    return <div className={cn("h-11 w-[4.5rem]", className)} aria-hidden />;
  }

  const labels: Record<"light" | "dark", string> = {
    light: dict.controls.themeLight,
    dark: dict.controls.themeDark,
  };

  const select = (value: "light" | "dark") => {
    applyTheme(value);
    setPref(value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={dict.controls.themeLabel}
      className={cn("inline-flex min-h-11 items-center", className)}
    >
      {OPTIONS.map(({ value, Icon }, index) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels[value]}
            title={labels[value]}
            onClick={() => select(value)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              select(OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length].value);
            }}
            className={cn(
              "inline-flex h-11 w-9 items-center justify-center border-b-2 transition-colors duration-[var(--motion-base)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
              active ? "border-foreground text-foreground" : "border-transparent text-foreground-subtle hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Re-exported so callers importing the toggle can assert on the contract. */
export { THEME_ATTRIBUTE };
