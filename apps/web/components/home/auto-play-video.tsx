"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

interface AutoPlayVideoProps {
  id: string;
  title: string;
  captionId: string;
}

/**
 * Keep the evidence films visible before they play, then only create the
 * YouTube player once the reader is actually at the frame. A 70% threshold
 * prevents a video from starting while it is merely approaching the viewport.
 *
 * Browser autoplay rules require playback to begin muted; YouTube still keeps
 * its native controls available for an intentional unmute or pause.
 *
 * Before the player exists the poster is a real <button>: previously it was
 * an aria-hidden image with nothing focusable, so a keyboard or screen-reader
 * user — and anyone with `prefers-reduced-motion`, for whom a video starting
 * on scroll is exactly the motion they opted out of — had no way to start the
 * film. Reduced-motion readers now get click-to-play only. A plain "watch on
 * YouTube" link sits under the frame as the fallback when the embed itself is
 * blocked by a network, an extension, or a school/company filter.
 */
export function AutoPlayVideo({ id, title, captionId }: AutoPlayVideoProps) {
  const dict = useDict();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    if (!("IntersectionObserver" in window)) {
      setIsReadyToPlay(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          setIsReadyToPlay(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.7] },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-2">
      <div ref={frameRef} className="relative aspect-video overflow-hidden rounded-lg bg-wash-sunken">
        {isReadyToPlay ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1&mute=1&playsinline=1`}
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
            onClick={() => setIsReadyToPlay(true)}
            className="group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
            aria-label={`${dict.video.play}: ${title}`}
          >
            {posterFailed ? null : (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube's verified thumbnail URL is an intentional lightweight poster.
              <img
                src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setPosterFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-transform duration-[var(--motion-base)] group-hover:scale-105">
                <Play className="ml-1 h-7 w-7" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-accent hover:underline"
      >
        {dict.video.openOnYoutube}
      </a>
    </div>
  );
}
