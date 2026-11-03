"use client";

import { useEffect } from "react";

/**
 * Makes `#hash` deep links land, even when the target streams in late.
 *
 * THE BUG THIS FIXES. `/dashboard#observatory` is what a QR code printed on a
 * station resolves to, and what `/s/:id` now redirects to. It did not work:
 * the browser resolves a hash once, at parse time, and the Bento renders
 * inside a `<Suspense>` boundary — so at that moment `#observatory` is not in
 * the document, the browser finds nothing, and the reader lands at the top of
 * the page. Measured at 390px: `scrollY` stayed 0 with the Bento roughly a
 * screen and a half further down.
 *
 * WHY A POLL RATHER THAN AN EFFECT ON THE TARGET. The target is rendered by a
 * Server Component inside Suspense; there is no client-side render pass to
 * hang a callback on, and no event fires when a streamed boundary resolves.
 * A short rAF poll is the honest mechanism. It is bounded (~2s) so a hash
 * that never resolves costs a handful of frames, not a permanent loop.
 *
 * WHY IT GIVES UP IF THE READER SCROLLS. Yanking someone back to an anchor
 * after they have started reading is worse than missing the anchor. Any
 * scroll input before the target appears cancels the attempt.
 *
 * Positioning is left to CSS `scroll-margin-top` on the target, so the sticky
 * header's height lives in one place rather than being duplicated here.
 */
export function HashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;

    // Already where it needs to be — the browser resolved it on its own.
    if (document.getElementById(id) && window.scrollY > 0) return;

    let cancelled = false;
    const startedAt = performance.now();
    const TIMEOUT_MS = 2000;

    const abort = () => {
      cancelled = true;
    };
    // `once` — the first real scroll input hands control back to the reader.
    window.addEventListener("wheel", abort, { once: true, passive: true });
    window.addEventListener("touchstart", abort, { once: true, passive: true });
    window.addEventListener("keydown", abort, { once: true });

    const tick = () => {
      if (cancelled) return;

      const target = document.getElementById(id);
      if (target) {
        // `auto`, not `smooth`: this is a landing, not a navigation the
        // reader initiated, and animating a scroll they did not ask for on
        // first paint reads as the page moving under them.
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }

      if (performance.now() - startedAt < TIMEOUT_MS) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.removeEventListener("wheel", abort);
      window.removeEventListener("touchstart", abort);
      window.removeEventListener("keydown", abort);
    };
  }, []);

  return null;
}
