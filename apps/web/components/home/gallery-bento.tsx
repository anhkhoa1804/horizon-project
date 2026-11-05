import type { GalleryItem, GalleryStatus } from "@/lib/content/gallery";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Tile shapes by photo. The grid is 4 columns on desktop (2 on phones); `row-span-2` tiles are
 * the tall or hero shots. Anything not listed is a single cell, so adding a manifest file
 * never needs a code change - it just lands as a small tile.
 */
const SHAPE: Record<string, string> = {
  "16-con-ho-riverbank": "col-span-2 row-span-2",
  "20-install-solar-station": "col-span-2",
  "23-soil-sensor-pole": "row-span-2",
  "18-con-ho-sunset": "col-span-2",
  "22-plant-pole-garden": "col-span-2",
  "21-assemble-devices": "col-span-2",
  "26-orchard": "col-span-2",
};

/** Only `verified` is shown without a marker; illustrations say so on the image itself. */
function marker(status: GalleryStatus, dict: Dictionary): string | null {
  return status === "placeholder" ? dict.gallery.placeholder : status === "illustrative" ? dict.gallery.illustrative : null;
}

/** Collage / bento of the project's photographs. Server-rendered, no carousel, no script. */
export function GalleryBento({ items, dict }: { items: GalleryItem[]; dict: Dictionary }) {
  if (items.length === 0) return <p className="text-sm leading-relaxed text-muted">{dict.gallery.empty}</p>;
  // Real photographs fill the collage; illustrations only appear if there are too few of them.
  const real = items.filter((i) => i.status === "verified");
  const shown = (real.length >= 6 ? real : items).slice(0, 11);

  return (
    <ul aria-label={dict.gallery.trackLabel} className="gallery-bento">
      {shown.map((item) => {
        const label = marker(item.status, dict);
        return (
          <li key={item.slug} className={cn("gallery-bento__tile group", SHAPE[item.slug])}>
            <a href={item.image} target="_blank" rel="noopener" aria-label={`${item.title} - ${dict.posts.openOriginal}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
              <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
              {label ? <span className="gallery-bento__marker">{label}</span> : null}
              <span className="gallery-bento__caption" lang="vi">
                <strong>{item.title}</strong>
                <span>{item.caption}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
