"use client";

import { useEffect, useState } from "react";

/**
 * Current time in ms, or null until the browser has mounted.
 *
 * null (not Date.now()) on the first render: the server and the client would
 * otherwise compute freshness from different clocks and hydrate different
 * text. Consumers render neutral while null. Re-ticks so a page left open
 * moves from "recent" to "old" on its own.
 */
export function useNowMs(tickMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}
