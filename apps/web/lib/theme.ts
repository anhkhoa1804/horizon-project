/**
 * Theme resolution contract, shared by the no-flash boot script and the
 * toggle component so the two can never disagree about the storage key or
 * the attribute name.
 *
 * Precedence: stored explicit choice > operating-system preference > local time (06:00-17:59 light) only when the OS gives no preference.
 * The header offers Light/Dark only; the "system" state remains the default when nothing is stored.
 *
 * Three states, but only two are ever written to the DOM:
 *
 *   "system"  → no `data-theme` attribute at all; globals.css's
 *               `prefers-color-scheme` media query decides. This is the
 *               default until the reader touches the toggle.
 *   "light"   → `data-theme="light"` — beats a dark OS setting, because the
 *               media query is guarded by `:not([data-theme="light"])`.
 *   "dark"    → `data-theme="dark"` — beats a light OS setting via its own
 *               `:root[data-theme="dark"]` block.
 *
 * Nothing here decides a colour; it only decides which CSS block wins.
 */

export const THEME_STORAGE_KEY = "horizon-theme";
export const THEME_ATTRIBUTE = "data-theme";
/**
 * Fired on `window` after an explicit preference is applied. Exists for the
 * few components that read a CSS custom property into JavaScript instead of
 * a plain class (the Leaflet map: marker fill/tile-layer URL are canvas/DOM
 * attributes, not CSS, so they cannot simply inherit `--h-safe` the way a
 * styled <div> does) — those components resolve the theme once on mount and
 * otherwise have no way to learn the toggle was clicked.
 */
export const THEME_CHANGE_EVENT = "horizon-theme-change";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Runs before first paint, inlined into <head>.
 *
 * Only an explicit stored choice is applied — "system" deliberately writes
 * nothing, leaving the media query in charge. Wrapped in try/catch because
 * localStorage throws in some privacy modes, and a theme preference is never
 * worth breaking the page over.
 *
 * Kept as a string (not a real function) because it has to be embedded via
 * dangerouslySetInnerHTML to execute synchronously ahead of the first paint;
 * a normal <script src> or a React effect would both land too late and let a
 * light flash through on a dark-preferring device.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t=null;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}if(t==="dark"||t==="light"){d.setAttribute("${THEME_ATTRIBUTE}",t);return}var m=window.matchMedia;if(m&&(m("(prefers-color-scheme: dark)").matches||m("(prefers-color-scheme: light)").matches))return;var h=new Date().getHours();d.setAttribute("${THEME_ATTRIBUTE}",h>=6&&h<18?"light":"dark")}catch(e){}})();`;

/** The theme actually being displayed right now, attribute first, OS second. */
export function resolveTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";

  const explicit = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (explicit === "dark" || explicit === "light") return explicit;

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  // Operating-system preference unavailable: local time is the last-resort fallback only.
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

/** The stored choice: an explicit "light"/"dark", otherwise "system". */
export function getThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const explicit = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return explicit === "dark" || explicit === "light" ? explicit : "system";
}

/** Writes an explicit preference. "system" clears the attribute and the key. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === "system") {
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    root.setAttribute(THEME_ATTRIBUTE, preference);
  }

  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Preference simply does not persist — the current page still switches.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
