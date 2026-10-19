"use client";
import { useDict } from "@/lib/i18n/client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostMeta } from "@/lib/content/posts";

const STATUS_LABEL: Record<PostMeta["status"], string | null> = {
  draft: "draft",
  demo: "demo",
  placeholder: "placeholder",
  // Only `verified` renders without a marker — everything else must announce
  // that it is project-development writing, not published field reporting.
  verified: null,
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function PostCard({ post }: { post: PostMeta }) {
  const statusLabel = STATUS_LABEL[post.status];

  return (
    <article className="group flex w-[78vw] max-w-[340px] shrink-0 snap-start flex-col sm:w-[46vw] lg:w-[340px]">
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-border bg-muted/20">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- local SVG placeholder; next/image adds no value for a vector asset
          <img
            src={post.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-[var(--motion-slow)] ease-[var(--ease-standard)] group-hover:scale-[1.03]"
          />
        ) : null}
        {statusLabel ? (
          <span className="absolute left-3 top-3 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">{post.category}</p>
        <h3 className="text-lg font-semibold leading-snug tracking-tight">{post.title}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <p className="pt-1 text-xs text-muted">
          {formatDate(post.date)}
          {post.readingTime ? ` · ${post.readingTime}` : null}
        </p>
      </div>
    </article>
  );
}

export function FieldNotesCarousel({ posts }: { posts: PostMeta[] }) {
  const dict = useDict();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 2px tolerance — sub-pixel scroll positions never land exactly on the bound.
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
    // Advance by one card + gap rather than a full viewport, so the reader
    // keeps a visual anchor between steps.
    const card = el.querySelector("article");
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  if (posts.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        {dict.notes.emptyLong}
            </p>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {(
          [
            { dir: -1 as const, label: dict.notes.prev, Icon: ArrowLeft, disabled: atStart },
            { dir: 1 as const, label: dict.notes.next, Icon: ArrowRight, disabled: atEnd },
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
