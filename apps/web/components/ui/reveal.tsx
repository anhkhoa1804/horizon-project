"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One-shot scroll reveal. Adds `is-visible` the first time the element
 * enters the viewport, then stops observing — no re-triggering on scroll
 * back, no per-frame work.
 *
 * Sets `.js` on <html> before hiding anything: the hidden state in
 * globals.css is scoped to `.js .horizon-reveal`, so server-rendered content
 * stays visible unless JS is actually running (see that rule's comment). An
 * environment without IntersectionObserver falls through to visible rather
 * than staying blank.
 *
 * IMPORTANT: never put this on an element that carries its own `transform`
 * — notably `.full-bleed`, which centres itself with `translateX(-50%)`.
 * The reveal animates `transform` and settles on `transform: none`, which
 * would silently cancel the other transform and shift the element half a
 * viewport sideways. Wrap instead: `<section class="full-bleed"><Reveal>…`.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delayMs,
  stagger = false,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Small stagger for siblings. Keep sparing — the brief rejects staggering every element. */
  delayMs?: number;
  /**
   * Stagger this element's DIRECT CHILDREN by 70ms each, capped at four
   * steps (globals.css `[data-stagger]`). Use it on major sections so
   * eyebrow → headline → body → visual arrive as one gesture that reads as
   * hierarchy. Do not use it everywhere: staggering every group turns the
   * page into a slow cascade and stops communicating anything.
   */
  stagger?: boolean;
  /** Anchor target, so in-page links (e.g. /about#ghi-chep) can address a revealed section. */
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("js");

    const node = ref.current;
    if (!node) return;

    const show = () => node.classList.add("is-visible");

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    // Anything already at or above the fold on mount is shown immediately,
    // with no observer and no transition wait. This covers the two cases a
    // plain observer gets wrong: content inside the first screen (which
    // should never animate in on load) and — the actual bug this fixes —
    // content the browser has already scrolled *past* on a deep link or a
    // restored scroll position, where IntersectionObserver fires once with
    // isIntersecting:false and then stays silent until the reader scrolls
    // back up, leaving the section blank.
    if (node.getBoundingClientRect().top < window.innerHeight) {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(node);

    // Failsafe: never let a missed observer callback permanently hide
    // content. Reveal is an enhancement, so it must not be able to fail
    // closed.
    const failsafe = window.setTimeout(show, 3000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      data-stagger={stagger ? "" : undefined}
      className={cn("horizon-reveal", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
