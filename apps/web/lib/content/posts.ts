import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter";

/**
 * Field Notes content system — real Markdown files on disk, not a hardcoded
 * array in JSX, so editorial content can be added by dropping a file into
 * apps/web/content/posts/ with no code change.
 *
 * Frontmatter is parsed by the small reader below rather than pulling in
 * gray-matter/js-yaml. The schema here is deliberately flat — scalar
 * `key: value` pairs only, no nesting, no lists — which is a few lines to
 * read correctly and keeps the project's existing zero-new-dependency
 * discipline. If real editorial content ever needs richer frontmatter
 * (arrays of tags, nested author objects), replace `parseFrontmatter` with
 * gray-matter; nothing else in this module depends on how the block is
 * parsed.
 *
 * Post *bodies* are intentionally not rendered anywhere yet — the homepage
 * carousel is a metadata surface. There is no Markdown renderer in this
 * project and adding one is a later decision, so `body` is exposed raw for
 * whoever needs it first.
 */

/**
 * Editorial lifecycle. `draft` and `demo` both mean "written for design
 * review, not published reporting" — every non-`verified` post carries a
 * visible marker in the UI so a reviewer is never shown project-development
 * writing as though it were confirmed field documentation.
 */
export type PostStatus = "draft" | "demo" | "placeholder" | "verified";

export interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** ISO date string from frontmatter. */
  date: string;
  readingTime: string;
  /** Path under /public, or null when the post has no cover yet. */
  cover: string | null;
  status: PostStatus;
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const VALID_STATUSES: PostStatus[] = ["draft", "demo", "placeholder", "verified"];

/** ~200 words/min. Only used when frontmatter omits `readingTime`. */
function estimateReadingTime(body: string): string {
  const words = body.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} phút đọc`;
}

function toStatus(value: string | undefined): PostStatus {
  return VALID_STATUSES.includes(value as PostStatus) ? (value as PostStatus) : "draft";
}

/**
 * All posts, newest first. Returns [] when the directory is absent rather
 * than throwing — a missing content folder is a normal state (fresh clone,
 * or a deploy that ships no editorial content yet), not an error worth
 * breaking the homepage over.
 */
export function getAllPosts(): PostMeta[] {
  if (!existsSync(POSTS_DIR)) return [];

  return readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => {
      const raw = readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      const slug = file.replace(/\.mdx?$/, "");

      return {
        slug,
        title: data.title || slug,
        excerpt: data.excerpt || "",
        category: data.category || "Ghi chép",
        date: data.date || "",
        readingTime: data.readingTime || estimateReadingTime(body),
        cover: data.cover || null,
        status: toStatus(data.status),
      } satisfies PostMeta;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Homepage carousel surface — a handful of the newest posts. */
export function getRecentPosts(limit = 5): PostMeta[] {
  return getAllPosts().slice(0, limit);
}

export interface Post extends PostMeta {
  /** Raw Markdown body, unrendered. */
  body: string;
}

/** One post by slug, with its body. Returns null when the file is absent. */
export function getPost(slug: string): Post | null {
  if (!existsSync(POSTS_DIR)) return null;

  // Resolve against the posts directory and confirm containment rather than
  // interpolating the slug straight into a path — the value arrives from a
  // route parameter, and `..` segments must not be able to read outside
  // content/posts.
  for (const ext of [".md", ".mdx"]) {
    const candidate = path.resolve(POSTS_DIR, `${slug}${ext}`);
    if (path.dirname(candidate) !== path.resolve(POSTS_DIR)) return null;
    if (!existsSync(candidate)) continue;

    const raw = readFileSync(candidate, "utf8");
    const { data, body } = parseFrontmatter(raw);
    return {
      slug,
      title: data.title || slug,
      excerpt: data.excerpt || "",
      category: data.category || "Ghi chép",
      date: data.date || "",
      readingTime: data.readingTime || estimateReadingTime(body),
      cover: data.cover || null,
      status: toStatus(data.status),
      body,
    };
  }

  return null;
}

/** Newest other posts, for the "read next" rail on a post page. */
export function getRelatedPosts(slug: string, limit = 3): PostMeta[] {
  return getAllPosts()
    .filter((post) => post.slug !== slug)
    .slice(0, limit);
}
