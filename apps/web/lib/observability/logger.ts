import "server-only";

/**
 * The smallest useful production logging layer.
 *
 * DELIBERATELY NOT a monitoring vendor. This pilot has one operator, low
 * traffic, and already ships to Vercel, whose log drain captures stdout/stderr
 * from every function. A structured line on stdout is therefore already
 * queryable in production; adding Sentry would add a vendor, a DSN to manage
 * in three environments, a client bundle, and a privacy surface, to solve a
 * problem this project does not yet have. Revisit when there is either a team
 * to notify or enough traffic that reading logs by hand stops working — see
 * docs/PRODUCTION_READINESS.md.
 *
 * What this buys over bare `console.error`:
 *
 *  - One JSON object per line, so Vercel's log search can filter on `event`
 *    rather than grepping prose.
 *  - A stable `event` name per call site, so a spike is countable.
 *  - A single redaction chokepoint. Every value passes through `safe()`,
 *    which drops anything whose key looks secret and truncates long strings —
 *    so a future caller cannot casually log a service-role key or paste an
 *    entire Supabase error object containing a connection string.
 *
 * Errors are logged by MESSAGE, never by passing the raw error object: a
 * Supabase/Postgres error can carry the failing statement and its parameters,
 * which may include user-submitted content.
 */

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization|cookie|dsn)/i;
const MAX_VALUE_LENGTH = 500;

function safe(fields: LogFields | undefined): Record<string, LogValue> {
  if (!fields) return {};

  const out: Record<string, LogValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] =
      typeof value === "string" && value.length > MAX_VALUE_LENGTH
        ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
        : value;
  }
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...safe(fields),
  });

  // console.error for warn/error so Vercel classifies them as stderr and they
  // surface in the errors view rather than the general log stream.
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
