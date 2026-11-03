import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE_NAME as COOKIE_NAME } from "./adminSessionCookie";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  email: string;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/**
 * Whether admin login can operate at all on this deployment.
 *
 * Both secrets are required and neither has a default — an admin console
 * guarded by a fallback password is worse than one that is switched off.
 * Callers use this to fail CLOSED and say so, rather than throwing: an
 * unconfigured deployment previously turned every /admin request into an
 * unhandled 500 (the thrown Error propagated out of a Server Component)
 * instead of a redirect to the login page. It never granted access — but a
 * 500 is an outage, not a security control, and it made a missing
 * environment variable look like a broken application.
 */
export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET) && Boolean(process.env.ADMIN_PASSWORD);
}

function sessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || null;
}

function configuredPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string): boolean {
  const secret = sessionSecret();
  if (!secret) return false;

  const expected = signPayload(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isLocalAdminPasswordValid(password: string): boolean {
  const expected = configuredPassword();
  if (!expected) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(password);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function createLocalAdminSession(email: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) {
    // Unreachable through the login action, which checks
    // isAdminAuthConfigured() first. Throwing rather than issuing an
    // unsigned cookie is the correct failure here: a session nobody can
    // verify is worse than no session.
    throw new Error("ADMIN_SESSION_SECRET is not configured; refusing to mint an unsigned session.");
  }

  const cookieStore = await cookies();
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const token = `${encodedPayload}.${signPayload(encodedPayload, secret)}`;

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearLocalAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getLocalAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}
