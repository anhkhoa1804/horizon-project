/**
 * Validates the post-login `redirect` target.
 *
 * THE BUG THIS REPLACES
 * The previous guard was `value.startsWith("/") && !value.startsWith("//")`.
 * That admits `/\evil.com`: browsers normalise a backslash in a URL to a
 * forward slash, so the location becomes `//evil.com` — a protocol-relative
 * URL pointing off-site. Control characters (tab, newline) are stripped
 * rather than normalised and reach the same result via `/\t/evil.com`.
 *
 * The consequence is not cosmetic. `/admin/login?redirect=…` is a link an
 * attacker can send to an operator; landing on an attacker-controlled page
 * *immediately after a successful login* is close to ideal conditions for a
 * credential re-prompt.
 *
 * The guard is now an allowlist rather than a denylist: the value must parse
 * as a same-origin URL against a sentinel origin, and only its path and query
 * survive. Anything that resolves elsewhere — or does not parse at all — is
 * replaced with the default.
 */

const DEFAULT_REDIRECT = "/admin";

/** Never a real host, so any absolute URL parses to a different origin. */
const SENTINEL_ORIGIN = "https://redirect-guard.invalid";

const MAX_LENGTH = 512;

export function safeRedirect(value: unknown, fallback = DEFAULT_REDIRECT): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) {
    return fallback;
  }

  // Must be a path, not an absolute or protocol-relative URL.
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  // Backslashes and C0/C1 control characters are rewritten or dropped by the
  // browser before the request is made, so they must be rejected here rather
  // than reasoned about after normalisation.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, SENTINEL_ORIGIN);
    if (url.origin !== SENTINEL_ORIGIN) {
      return fallback;
    }
    // Drop any fragment; a redirect has no use for one.
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
