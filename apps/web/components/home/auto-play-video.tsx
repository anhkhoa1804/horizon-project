"use client";

import { useEffect, useRef, useState } from "react";

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
 */
export function AutoPlayVideo({ id, title, captionId }: AutoPlayVideoProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

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
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's verified thumbnail URL is an intentional lightweight poster.
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          aria-hidden
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
