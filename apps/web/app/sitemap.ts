import type { MetadataRoute } from "next";
import { getRecentPosts } from "@/lib/content/posts";
import { siteUrl } from "@/lib/siteUrl";

/**
 * The public surface, as far as a crawler is concerned.
 *
 * Deliberately excludes:
 *  - /admin and /admin/login — an operator console, disallowed in robots.ts
 *  - /offline               — a service-worker fallback, not a destination
 *  - /about and /s/:id      — redirects, not pages. Listing a redirect in a
 *                             sitemap asks a crawler to index a 307, which
 *                             wastes crawl budget and tells it nothing the
 *                             destination does not already say.
 *
 * `changeFrequency` and `priority` are hints, not promises. Monitoring gets
 * the highest of both because it is the only page whose content genuinely
 * changes on a schedule.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/report`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  for (const post of getRecentPosts(100)) {
    routes.push({
      url: `${base}/posts/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : now,
      changeFrequency: "yearly",
      priority: 0.4,
    });
  }

  return routes;
}
