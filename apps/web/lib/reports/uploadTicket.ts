import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveServiceSecret } from "@/lib/supabase/service";

/**
 * A short-lived, server-signed capability that lets an anonymous reporter
 * finish attaching evidence to the ONE report they just created — and nothing
 * else.
 *
 * WHY THIS EXISTS. Evidence used to travel inside the report POST itself.
 * Production runs on Vercel, whose functions reject any request body over
 * 4.5 MB before the route handler runs (FUNCTION_PAYLOAD_TOO_LARGE), so a
 * normal phone video — or two full-resolution photos — never reached this
 * code at all and the whole report was lost. Files now go from the browser
 * straight to Supabase Storage on server-signed upload URLs, and a second,
 * small request asks the server to verify and record what arrived. That
 * second request has no session to authenticate it; this ticket is that
 * authentication.
 *
 * WHAT IT BINDS: the report id, the exact storage paths the server chose for
 * it, and an expiry. A ticket for report A cannot name report B's paths, and
 * a client cannot invent a path, because changing either breaks the HMAC.
 *
 * KEY. Derived from the service-role key with a fixed label (via
 * deriveServiceSecret, so the raw key is still read in exactly one module)
 * rather than a new environment variable: it is already server-only, already
 * required for any report to be stored at all, and rotating it invalidates
 * outstanding tickets, which is the right behaviour.
 */

const TICKET_TTL_SECONDS = 60 * 60 * 2;
const LABEL = "horizon/report-upload-ticket/v1";

export interface UploadTicketPayload {
  reportId: string;
  paths: string[];
  exp: number;
}

function ticketKey(): Buffer | null {
  return deriveServiceSecret(LABEL);
}

function sign(encoded: string, key: Buffer): string {
  return createHmac("sha256", key).update(encoded).digest("base64url");
}

export function issueUploadTicket(reportId: string, paths: string[], now = Date.now()): string | null {
  const key = ticketKey();
  if (!key) return null;
  const payload: UploadTicketPayload = { reportId, paths, exp: Math.floor(now / 1000) + TICKET_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyUploadTicket(ticket: unknown, now = Date.now()): UploadTicketPayload | null {
  if (typeof ticket !== "string" || ticket.length > 4096) return null;
  const key = ticketKey();
  if (!key) return null;
  const [encoded, signature, extra] = ticket.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(encoded, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<UploadTicketPayload>;
    if (
      typeof payload.reportId !== "string" ||
      !Array.isArray(payload.paths) ||
      !payload.paths.every((path) => typeof path === "string") ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(now / 1000)
    ) {
      return null;
    }
    return { reportId: payload.reportId, paths: payload.paths, exp: payload.exp };
  } catch {
    return null;
  }
}
