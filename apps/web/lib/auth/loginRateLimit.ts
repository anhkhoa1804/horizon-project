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
const failedLoginAttempts = new Map<string, number[]>();

export function isLoginRateLimited(email: string, now = Date.now()): boolean {
  const windowStart = now - LOGIN_RATE_WINDOW_MS;
  const attempts = (failedLoginAttempts.get(email) ?? []).filter((t) => t > windowStart);
  return attempts.length >= LOGIN_RATE_MAX_ATTEMPTS;
}

export function recordFailedLoginAttempt(email: string, now = Date.now()): void {
  const windowStart = now - LOGIN_RATE_WINDOW_MS;
  const attempts = (failedLoginAttempts.get(email) ?? []).filter((t) => t > windowStart);
  attempts.push(now);
  failedLoginAttempts.set(email, attempts);
}

export function clearLoginRateLimit(email: string): void {
  failedLoginAttempts.delete(email);
}
