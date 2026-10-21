"use client";

import { useEffect } from "react";

/**
 * Registers the generated service worker (`/sw.js`, built by @ducanh2912/next-pwa).
 *
 * WHY THIS EXISTS. The plugin's own `register: true` injects its registration snippet into the webpack
 * `main` entry, which the App Router does not run (it uses `main-app`). On Next 15.5 a production build therefore
 * produced a valid `/sw.js` that was never registered — so the offline fallback (`/offline`) could never be served
 * (verified with scripts/a11y-i18n-pwa-qa.cjs: `registered: false`). Registering explicitly from a client component
 * removes the dependency on that injection.
 *
 * Production only: a worker in `next dev` caches stale bundles and makes development confusing. Failure is silent by
 * design — the site works without a worker; only the offline fallback is lost.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
