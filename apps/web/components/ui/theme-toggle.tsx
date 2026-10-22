"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { applyTheme, resolveTheme, THEME_ATTRIBUTE, type ResolvedTheme } from "@/lib/theme";

/**
 * Single icon button: one press flips between light and dark.
 *
 * The icon shows the theme that is CURRENTLY displayed (sun in light, moon in dark), and the accessible
 * name states the destination ("Switch to dark theme"), so a screen reader hears the action, not a state.
 * The choice is stored exactly as before (lib/theme.ts): an explicit press writes the attribute and the
 * key; with no stored choice the OS preference, then local time, decides the starting theme.
 *
 * The control renders a same-size placeholder until mounted, because the server cannot read localStorage
 * and rendering a concrete icon there would mismatch on hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const dict = useDict();
  const [current, setCurrent] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    setCurrent(resolveTheme());
    // Follow OS changes while nothing has been chosen explicitly.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!document.documentElement.hasAttribute(THEME_ATTRIBUTE)) setCurrent(resolveTheme());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (current === null) {
    return <div className={cn("h-11 w-11", className)} aria-hidden />;
  }

  const next: ResolvedTheme = current === "dark" ? "light" : "dark";
  const label = next === "dark" ? dict.controls.themeSwitchToDark : dict.controls.themeSwitchToLight;
  const Icon = current === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setCurrent(next);
      }}
      aria-label={label}
      title={label}
      className={cn(
        "site-control",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
