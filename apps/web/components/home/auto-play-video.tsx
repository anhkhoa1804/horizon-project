"use client";

import { useEffect, useRef, useState } from "react";
import { useDict } from "@/lib/i18n/client";

interface AutoPlayVideoProps {
  id: string;
  title: string;
  captionId: string;
}

/**
 * The film plays by itself, muted, once most of the frame is on screen (70%), so it is never started
 * by a frame that is merely approaching. Before that the reader sees the film's own large thumbnail -
 * no extra play icon on top. The thumbnail is still a real button, so keyboard users and readers with
 * reduced motion (for whom nothing starts on scroll) can start it themselves. A plain YouTube link
 * under the frame is the fallback when the embed is blocked.
 */
export function AutoPlayVideo({ id, title, captionId }: AutoPlayVideoProps) {
  const dict = useDict();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [byClick, setByClick] = useState(false);
  const [poster, setPoster] = useState<"max" | "hq" | "none">("max");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || playing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.7] },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [playing]);

  // Started by scrolling: muted (browsers require it). Started by a press: with sound.
  const params = `autoplay=1&mute=${byClick ? 0 : 1}&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&color=white`;

  return (
    <div className="space-y-2">
      <div ref={frameRef} className="film-frame relative aspect-video overflow-hidden bg-wash-sunken">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
            title={title}
            aria-describedby={captionId}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setByClick(true); setPlaying(true); }}
            className="film-poster group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
            aria-label={`${dict.video.play}: ${title}`}
          >
            {poster === "none" ? null : (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail is the lightest honest poster.
              <img
                src={`https://i.ytimg.com/vi/${id}/${poster === "max" ? "maxresdefault" : "hqdefault"}.jpg`}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setPoster(poster === "max" ? "hq" : "none")}
                onLoad={(e) => {
                  // maxresdefault answers a 120x90 "missing" placeholder instead of failing.
                  if (poster === "max" && e.currentTarget.naturalWidth < 400) setPoster("hq");
                }}
                className="h-full w-full object-cover"
              />
            )}
          </button>
        )}
      </div>
      {/* The caption IS the YouTube link: one line instead of a title plus a separate "watch on YouTube". */}
      <a
        id={captionId}
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        lang="vi"
        aria-label={`${title} · ${dict.video.openOnYoutube}`}
        className="video-caption-link inline-flex min-h-11 items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-accent hover:underline"
      >
        {title} <span aria-hidden>↗</span>
      </a>
    </div>
  );
}
