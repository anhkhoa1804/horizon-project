import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "./config";
import { en } from "./en";
import { vi, type Dictionary } from "./vi";

export type { Dictionary } from "./vi";
export * from "./config";

const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

/**
 * The dictionary for a locale. Never throws and never returns undefined — an
 * unrecognised locale resolves to Vietnamese rather than rendering a page of
 * blank strings.
 */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Defensive lookup by dotted path, with Vietnamese fallback.
 *
 * The typed dictionaries make a missing key impossible at compile time, so
 * application code should read `dict.monitoring.title` directly rather than
 * calling this. It exists for the runtime edges that types cannot cover — a
 * dictionary shipped stale by a bad deploy, or a key read from data rather
 * than written in source — where the correct behaviour is to degrade to
 * Vietnamese rather than render `undefined` to a reader.
 *
 * Resolution order: requested locale → Vietnamese → the path itself, so a
 * failure is always visible in the UI as a key name instead of silently
 * showing nothing.
 */
export function resolve(locale: Locale, path: string): string {
  const fromLocale = lookup(getDictionary(locale), path);
  if (typeof fromLocale === "string") return fromLocale;

  const fromDefault = lookup(DICTIONARIES[DEFAULT_LOCALE], path);
  if (typeof fromDefault === "string") return fromDefault;

  return path;
}

function lookup(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object" && key in node) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export { normalizeLocale };

/**
 * Substitutes `{name}` placeholders in a dictionary string.
 *
 *   fmt(dict.report.form.errTooShort, { min: 40 })  →  "…ít nhất 40 ký tự."
 *
 * Numbers live at the call site rather than in the dictionary so the two
 * languages can order the sentence differently without either one having to
 * carry the value. Unknown keys are left untouched rather than blanked, so a
 * typo shows up as a visible `{min}` instead of a silently missing number.
 */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
