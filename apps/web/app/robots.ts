import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/siteUrl";

/**
 * Robots policy.
 *
 * Two rules matter here and both are about not publishing things that should
 * not be public:
 *
 *  - `/admin` and `/api` are disallowed. Admin is behind real authentication,
 *    so this is not a security control — it is to keep an operator console
 *    and a set of JSON endpoints out of search results, where they are noise
 *    at best.
 *  - Non-production deployments disallow everything. A preview URL indexed
 *    alongside production is duplicate content competing with the real site.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  if (!isIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
