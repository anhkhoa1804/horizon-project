/**
 * Locale configuration.
 *
 * ARCHITECTURE CHOICE — cookie, not route segment.
 *
 * The obvious App Router approach is `app/[locale]/...`, which gives every
 * language a real URL and the SEO that comes with it. It was rejected here
 * for one concrete reason: this product has 12 routes and 428 translatable
 * strings across 51 files, and a route segment would require moving the
 * entire page tree under a dynamic segment — touching every route, every
 * `<Link>`, the middleware, and the sitemap — to serve a project that has
 * exactly two languages and one deployment.
 *
 * A cookie read in a Server Component costs one `cookies()` call, works
 * identically in server and client components, survives navigation without
 * rewriting a single href, and can be upgraded to route segments later
 * without changing a single dictionary key.
 *
 * KNOWN TRADE-OFF, stated plainly: with one URL per page there is no
 * per-language canonical URL, so search engines will only ever index the
 * default (Vietnamese) rendering. That is the correct trade for a pilot whose
 * audience is local and whose English exists for funders and researchers
 * reading a link someone sent them — but it IS a trade, and it is the reason
 * to revisit this if the project ever wants English discoverability.
 */

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Vietnamese is the product's first language, not a fallback. Cồn Hô is the
 * subject and the primary audience; English is the translation layer.
 */
export const DEFAULT_LOCALE: Locale = "vi";

/** Readable in both a Server Component (next/headers) and document.cookie. */
export const LOCALE_COOKIE = "horizon-locale";

/** One year — a language preference is not session state. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Never throws, never returns something outside LOCALES. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The `lang` attribute for <html>. Kept beside the locale so the two cannot drift. */
export const HTML_LANG: Record<Locale, string> = {
  vi: "vi",
  en: "en",
};

/** Display names for the switcher — each shown in its own language. */
export const LOCALE_LABEL: Record<Locale, string> = {
  vi: "VI",
  en: "EN",
};

export const LOCALE_FULL_LABEL: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/**
 * Language preference order: (1) the explicit choice stored in the LOCALE_COOKIE,
 * (2) the browser's Accept-Language, (3) DEFAULT_LOCALE (Vietnamese — the project's
 * first language and the documented fallback). Time of day plays no part.
 *
 * Accept-Language is parsed with q-weights; the highest-weighted tag whose primary
 * subtag is supported wins ("en-GB" -> en, "vi-VN" -> vi). Wildcards, malformed
 * entries and unsupported languages are skipped. Never throws.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
