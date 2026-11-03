/**
 * Deliberately dependency-free (no node:crypto, no "server-only") so
 * middleware.ts can import it directly into the Edge Runtime bundle
 * without pulling in Node-only APIs that don't exist there.
 */
export const ADMIN_SESSION_COOKIE_NAME = "horizon_admin_session";
