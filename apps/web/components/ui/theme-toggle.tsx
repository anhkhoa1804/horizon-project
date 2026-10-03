"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { applyTheme, resolveTheme, THEME_ATTRIBUTE, type ResolvedTheme } from "@/lib/theme";

/**
 * Light/dark switch for the global shell.
 *
 * Renders a fixed-size placeholder until mounted. The server cannot know
 * which theme the reader will resolve to — that depends on localStorage and
 * an OS media query, neither of which exist during SSR — so rendering an
 * icon on the server would guarantee a hydration mismatch on every
 * dark-mode visitor. Reserving the space keeps the header from shifting when
 * the real control appears.
 *
 * While the reader is still on "system" this stays in sync with the OS: the
 * media listener below re-resolves on change. Once they pick a side,
 * `data-theme` is set and the listener's result no longer affects what is
 * displayed, which is the intended precedence.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const dict = useDict();
  const [theme, setTheme] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(resolveTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (theme === null) {
    return <div className={cn("h-11 w-11", className)} aria-hidden />;
  }

  const next: ResolvedTheme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? dict.controls.toDark : dict.controls.toLight;
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted",
        "transition-colors duration-[var(--motion-base)] hover:bg-muted/15 hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Re-exported so callers importing the toggle can assert on the contract. */
export { THEME_ATTRIBUTE };
