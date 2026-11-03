"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_LOCALE,
  getDictionary,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Dictionary,
  type Locale,
} from "./index";

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
}

/**
 * Seeded with the default rather than `null` so a client component rendered
 * outside the provider degrades to Vietnamese instead of crashing. A missing
 * provider is a wiring bug worth fixing, but it should not blank the page.
 */
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dict: getDictionary(DEFAULT_LOCALE),
});

/**
 * Supplies the already-resolved locale to client components.
 *
 * The root layout reads the cookie on the server and passes the locale down
 * as a prop, so the client never re-derives it — which removes the flash of
 * wrong-language content a client-side cookie read would cause, and keeps
 * server and client rendering the same strings during hydration.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale, dict: getDictionary(locale) }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useDict(): Dictionary {
  return useContext(LocaleContext).dict;
}

/**
 * Persist a language choice and reload so Server Components re-render in it.
 *
 * A full reload rather than a router refresh: the locale lives in a cookie
 * that server components read at request time, and `<html lang>` is a server
 * render too. Reloading is the honest way to get every layer — document
 * language, server strings, client strings — consistent in one step, and a
 * language switch is a rare, deliberate action where a reload is acceptable.
 *
 * `SameSite=Lax` keeps the preference on top-level navigations without
 * exposing it cross-site; it carries no personal data and is not a secret.
 */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  window.location.reload();
}
