import "server-only";

import { cookies } from "next/headers";
import { getDictionary, LOCALE_COOKIE, normalizeLocale, type Dictionary, type Locale } from "./index";

/**
 * Server-side locale resolution.
 *
 * One `cookies()` read per request. Because this is called from Server
 * Components, every page and layout can be locale-aware without a provider,
 * a context, or shipping either dictionary to the browser — the strings a
 * server component renders are already resolved by the time they reach the
 * client bundle.
 *
 * Note this makes any page calling it dynamic (it reads a request cookie).
 * That is already true of every route here that reads Supabase; the two
 * genuinely static pages (`/`, `/about`) accept the trade in exchange for
 * not duplicating the route tree under a `[locale]` segment.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

/** The resolved locale and its dictionary — the usual entry point for a page. */
export async function getI18n(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
