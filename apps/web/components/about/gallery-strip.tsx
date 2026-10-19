"use client";
import { useDict } from "@/lib/i18n/client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryItem, GalleryStatus } from "@/lib/content/gallery";

/**
 * `verified` is the only status that renders without a marker. Everything
 * else says so on the image itself — a reader should never have to check a
 * caption to find out whether they are looking at documentation or a
 * diagram.
 */
const STATUS_LABEL: Record<GalleryStatus, string | null> = {
  placeholder: "placeholder",
  illustrative: "illustrative",
  verified: null,
};

export function GalleryStrip({ items }: { items: GalleryItem[] }) {
  const dict = useDict();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const nudge = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("figure");
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  if (items.length === 0) {
    return <p className="text-sm leading-relaxed text-muted">{dict.gallery.empty}</p>;
  }

  return (
    <div className="space-y-6">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const label = STATUS_LABEL[item.status];
          return (
            <figure key={item.slug} className="w-[82vw] max-w-[520px] shrink-0 snap-start sm:w-[58vw] lg:w-[520px]">
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- local static asset; next/image adds nothing for a committed SVG/PNG */}
                <img src={item.image} alt={item.title} className="aspect-[3/2] w-full object-cover" />
                {label ? (
                  <span className="absolute left-3 top-3 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
                    {label}
                  </span>
                ) : null}
              </div>
              <figcaption className="mt-4 space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-accent">{item.category}</p>
                <p className="text-base font-semibold tracking-tight">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted">{item.caption}</p>
                {item.source ? <p className="text-xs text-muted/70">{dict.common.source}: {item.source}</p> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {(
          [
            { dir: -1 as const, label: dict.gallery.prev, Icon: ArrowLeft, disabled: atStart },
            { dir: 1 as const, label: dict.gallery.next, Icon: ArrowRight, disabled: atEnd },
          ]
        ).map(({ dir, label, Icon, disabled }) => (
          <button
            key={dir}
            type="button"
            onClick={() => nudge(dir)}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-[var(--motion-base)]",
              disabled
                ? "cursor-default border-border/50 text-muted/40"
                : "border-border text-foreground hover:border-accent hover:text-accent",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
