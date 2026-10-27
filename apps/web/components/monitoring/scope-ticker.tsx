"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useDict } from "@/lib/i18n/client";

/**
 * One-line scope-and-limits notice that scrolls, with a real pause control.
 *
 * - Fixed height (h-10): the band never changes the page's height, so nothing
 *   below it jumps when the animation starts, pauses, or when reduced motion
 *   swaps it for static text.
 * - `prefers-reduced-motion: reduce` -> no animation at all; the text is shown
 *   still and wraps/clips inside the same fixed-height band, and the full text
 *   is one click away at /data-scope. No pause button is rendered then because
 *   there is nothing to pause.
 * - The scrolling copy is duplicated for a seamless loop; the duplicate is
 *   aria-hidden so a screen reader hears the notice once. The band is a
 *   `role="region"` with a label rather than a live region: it never announces
 *   itself.
 * - WCAG 2.2.2: moving content that starts automatically and lasts > 5 s has a
 *   pause mechanism; hover and keyboard focus inside the band also pause it.
 */
export function ScopeTicker() {
  const dict = useDict();
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const text = dict.dataScope.ticker;
  const running = !paused && !reduced;

  return (
    <section
      aria-label={dict.dataScope.tickerLabel}
      className="scope-ticker"
      data-running={running ? "true" : "false"}
      data-reduced={reduced ? "true" : "false"}
    >
      <div className="scope-ticker__viewport">
        {reduced ? (
          <p className="scope-ticker__static">{text}</p>
        ) : (
          <div className="scope-ticker__track" data-testid="scope-ticker-track">
            <span className="scope-ticker__item">{text}</span>
            <span className="scope-ticker__item" aria-hidden>
              {text}
            </span>
          </div>
        )}
      </div>
      <div className="scope-ticker__actions">
        <Link href="/data-scope" className="scope-ticker__link">
          {dict.dataScope.readMore}
        </Link>
        {reduced ? null : (
          <button
            type="button"
            className="scope-ticker__button"
            aria-pressed={paused}
            aria-label={paused ? dict.dataScope.resume : dict.dataScope.pause}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
    </section>
  );
}
