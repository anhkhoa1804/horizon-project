/**
 * Sliding-window brute-force throttle for admin login password attempts.
 * Kept free of any "server-only" import (unlike localAdminSession.ts) so
 * it can be unit-tested directly, and because it has no real dependency
 * on server-only APIs — it's pure in-memory state.
 *
 * Prior to this, loginAdmin() (components/auth/login-form.tsx) had zero
 * throttling — the entire admin console is guarded by one shared password
 * with no other brute-force resistance. Process-local, in-memory sliding
 * window, same caveat as the reports endpoint's rate limiter
 * (apps/web/app/api/public/reports/route.ts): doesn't hold across multiple
 * serverless instances. Still meaningfully raises the bar over unthrottled
 * guessing, which is what this pilot's threat model actually needs.
 */

const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX_ATTEMPTS = 5;
/**
 * Ceiling on failures for ONE email across all clients. Much higher than the
 * per-client limit on purpose: if a stranger could trip it with five bad
 * guesses they could lock the real administrator out (audit I-11). It only
 * has to cap distributed guessing, not stop a single caller.
 */
const LOGIN_EMAIL_MAX_ATTEMPTS = 40;
const failedLoginAttempts = new Map<string, number[]>();

export function isLoginRateLimited(key: string, now = Date.now(), max = LOGIN_RATE_MAX_ATTEMPTS): boolean {
  const windowStart = now - LOGIN_RATE_WINDOW_MS;
  const attempts = (failedLoginAttempts.get(key) ?? []).filter((t) => t > windowStart);
  return attempts.length >= max;
}

export function recordFailedLoginAttempt(key: string, now = Date.now()): void {
  const windowStart = now - LOGIN_RATE_WINDOW_MS;
  const attempts = (failedLoginAttempts.get(key) ?? []).filter((t) => t > windowStart);
  attempts.push(now);
  failedLoginAttempts.set(key, attempts);
}

export function clearLoginRateLimit(key: string): void {
  failedLoginAttempts.delete(key);
}

/**
 * Throttle buckets for one sign-in attempt.
 *
 * - `client`: this caller + this email. Five failures lock THIS caller out of
 *   THAT email only, so a stranger guessing the admin's address cannot stop
 *   the admin signing in from somewhere else.
 * - `email`: every caller combined, with a high ceiling (see above).
 * - `anyEmail`: this caller across every address, so rotating emails (or
 *   probing the allowlist) does not reset the allowance.
 */
export function loginThrottleKeys(email: string, client: string) {
  return { client: `c:${client}|${email}`, email: `e:${email}`, anyEmail: `a:${client}` };
}

export function isSignInThrottled(email: string, client: string, now = Date.now()): boolean {
  const k = loginThrottleKeys(email, client);
  return (
    isLoginRateLimited(k.client, now) ||
    isLoginRateLimited(k.anyEmail, now, LOGIN_RATE_MAX_ATTEMPTS * 4) ||
    isLoginRateLimited(k.email, now, LOGIN_EMAIL_MAX_ATTEMPTS)
  );
}

export function recordSignInFailure(email: string, client: string, now = Date.now()): void {
  const k = loginThrottleKeys(email, client);
  recordFailedLoginAttempt(k.client, now);
  recordFailedLoginAttempt(k.anyEmail, now);
  recordFailedLoginAttempt(k.email, now);
}

export function clearSignInFailures(email: string, client: string): void {
  const k = loginThrottleKeys(email, client);
  clearLoginRateLimit(k.client);
}
