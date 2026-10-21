"use client";
import { useDict } from "@/lib/i18n/client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostMeta } from "@/lib/content/posts";
import { fmt } from "@/lib/i18n";

/**
 * Only `verified` renders without a marker — everything else must announce
 * that it is project-development writing, not published field reporting.
 * The label comes from the dictionary: the raw enum ("draft") was shown to
 * Vietnamese readers as an untranslated English word.
 */
function statusLabel(status: PostMeta["status"], notes: { draft: string; demo: string; placeholder: string }): string | null {
  return status === "verified" ? null : notes[status];
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/**
 * THE WHOLE CARD IS ONE LINK. The card previously rendered as a bare
 * <article> — image, hover zoom and all — with no anchor anywhere inside it,
 * so it looked clickable and went nowhere, although /posts/[slug] existed.
 * One <Link> wraps the card so image, title and excerpt share a single tab
 * stop whose accessible name is the title (the image is decorative, alt="").
 */
/** Frontmatter stores "N <minutes-to-read in Vietnamese>" (escaped below to keep this file Vietnamese-free); show it in the active language. Any other string is shown as written. */
function readingTimeLabel(value: string, dict: ReturnType<typeof useDict>): string {
  const match = /^(\d+)\s*ph\u00fat \u0111\u1ecdc$/.exec(value.trim());
  return match ? fmt(dict.notes.minRead, { count: match[1] }) : value;
}

function PostCard({ post }: { post: PostMeta }) {
  const dict = useDict();
  const status = statusLabel(post.status, dict.notes);

  return (
    <article className="group flex w-[78vw] max-w-[340px] shrink-0 snap-start flex-col sm:w-[46vw] lg:w-[340px]">
      <Link
        href={`/posts/${post.slug}`}
        className="flex flex-col rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-describedby={`note-${post.slug}-meta`}
      >
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-border bg-muted/20">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- local SVG placeholder; next/image adds no value for a vector asset
          <img
            src={post.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-[var(--motion-slow)] ease-[var(--ease-standard)] group-hover:scale-[1.03]"
          />
        ) : null}
        {status ? (
          <span className="absolute left-3 top-3 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
            {status}
          </span>
        ) : null}
      </div>

      {/* The notes themselves are written in Vietnamese: say so to assistive tech under the EN locale. */}
      <div className="mt-4 space-y-2" lang="vi">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">{post.category}</p>
        <h3 className="text-lg font-semibold leading-snug tracking-tight transition-colors duration-[var(--motion-base)] group-hover:text-accent">{post.title}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <p id={`note-${post.slug}-meta`} className="pt-1 text-xs text-muted">
          {status ? `${status} · ` : null}
          {formatDate(post.date)}
          {post.readingTime ? ` · ${readingTimeLabel(post.readingTime, dict)}` : null}
        </p>
      </div>
      </Link>
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
        // A scrollable region must be reachable by keyboard (axe: scrollable-region-focusable).
        tabIndex={0}
        role="region"
        aria-label={dict.notes.trackLabel}
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
