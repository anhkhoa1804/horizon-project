import "server-only";

import { cookies, headers } from "next/headers";
import { getDictionary, isLocale, LOCALE_COOKIE, negotiateLocale, type Dictionary, type Locale } from "./index";

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
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored; // 1. explicit choice
  return negotiateLocale((await headers()).get("accept-language")); // 2. browser, 3. fallback
}

/** The resolved locale and its dictionary — the usual entry point for a page. */
export async function getI18n(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
