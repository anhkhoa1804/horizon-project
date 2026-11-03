/**
 * The site's canonical public origin.
 *
 * WHY THIS IS RESOLVED RATHER THAN HARDCODED. An earlier pass deliberately
 * omitted `metadataBase` entirely, on the reasoning that hardcoding a
 * production origin would emit wrong absolute URLs on preview deployments.
 * That reasoning is right, and the conclusion was wrong: without a base,
 * Next cannot build absolute URLs for Open Graph or a canonical link at all,
 * and a sitemap has nothing to write. The fix is to resolve the origin per
 * environment, not to give up on having one.
 *
 * Order, most explicit first:
 *
 *   1. NEXT_PUBLIC_SITE_URL — an explicit override, if one is ever needed.
 *   2. PRODUCTION_ORIGIN     — whenever running on Vercel, production or
 *                              preview alike.
 *   3. localhost             — development.
 *
 * Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` are deliberately
 * NOT used: both resolve to a *.vercel.app hostname, and a preview that
 * advertises itself as canonical competes with the real site in a search
 * index. Every deployment points canonical at the project's own domain.
 */

/**
 * The project's official production domain.
 *
 * This must remain the only canonical origin: duplicate production hosts
 * dilute indexing and make share links inconsistent.
 */
export const PRODUCTION_ORIGIN = "https://horizon.frogsleap.com.vn";

function normalize(value: string): string {
  const withProtocol = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);

  // On Vercel — production OR preview — canonical is the project's own
  // domain. `VERCEL_PROJECT_PRODUCTION_URL` is deliberately NOT consulted
  // any more: it resolves to the *.vercel.app deployment host, which is the
  // legacy address and must never be advertised as canonical.
  if (process.env.VERCEL) return PRODUCTION_ORIGIN;

  return "http://localhost:4173";
}

/**
 * Whether this deployment should allow itself to be indexed.
 *
 * Preview deployments and local development must not enter a search index —
 * duplicate content competing with production is the classic way a small site
 * damages its own ranking, and a preview URL in results is worse than no
 * result. Only a deployment that knows it is production says yes.
 */
export function isIndexable(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  // Outside Vercel, indexability follows an explicitly configured site URL.
  return Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());
}
