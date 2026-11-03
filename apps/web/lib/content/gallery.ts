import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter";

/**
 * Gallery manifest — one Markdown file per image in apps/web/content/gallery/,
 * so adding an image means dropping a file in `public/assets/gallery/` and a
 * short `.md` beside it, with no React changes.
 *
 * `status` is load-bearing, not decorative: the UI renders a visible marker
 * for anything that is not `verified`, so an illustrative placeholder can
 * never be read as documentation of a real site visit. `source` records
 * provenance for any asset that did not originate with this project.
 */

export type GalleryStatus = "placeholder" | "illustrative" | "verified";

/**
 * Deliberately excludes a "Fieldwork" category. No field deployment has
 * happened — firmware has never been compiled or flashed (docs/ARCHITECTURE.md,
 * "FUTURE / NOT YET DONE") — so offering the category at all would invite
 * mislabelling. Add it when there is real fieldwork to file under it.
 */
export type GalleryCategory = "Thiết kế dự án" | "Phần cứng" | "Cảnh quan";

export interface GalleryItem {
  slug: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  status: GalleryStatus;
  /** Path under /public. */
  image: string;
  /** Attribution/origin for non-project assets. Null when the project made it. */
  source: string | null;
}

const GALLERY_DIR = path.join(process.cwd(), "content", "gallery");
const VALID_STATUSES: GalleryStatus[] = ["placeholder", "illustrative", "verified"];
const VALID_CATEGORIES: GalleryCategory[] = ["Thiết kế dự án", "Phần cứng", "Cảnh quan"];

function toStatus(value: string | undefined): GalleryStatus {
  // Defaults to `placeholder`, the most conservative label — an unlabelled or
  // mislabelled asset is never silently promoted to `verified`.
  return VALID_STATUSES.includes(value as GalleryStatus) ? (value as GalleryStatus) : "placeholder";
}

function toCategory(value: string | undefined): GalleryCategory {
  return VALID_CATEGORIES.includes(value as GalleryCategory) ? (value as GalleryCategory) : "Thiết kế dự án";
}

export function getGalleryItems(): GalleryItem[] {
  if (!existsSync(GALLERY_DIR)) return [];

  return readdirSync(GALLERY_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const { data } = parseFrontmatter(readFileSync(path.join(GALLERY_DIR, file), "utf8"));
      const slug = file.replace(/\.md$/, "");

      return {
        slug,
        title: data.title || slug,
        caption: data.caption || "",
        category: toCategory(data.category),
        status: toStatus(data.status),
        image: data.image || "",
        source: data.source || null,
      } satisfies GalleryItem;
    })
    .filter((item) => item.image.length > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
