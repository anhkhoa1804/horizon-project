/**
 * The outcome of authorising a gateway POST. Three states, not two, because
 * "the server has no token configured" is an OPERATOR error and must not be
 * reported to a caller as an authentication failure — nor, as it previously
 * was, treated as permission to proceed.
 */
export type GatewayAuthResult = "ok" | "unauthorized" | "not_configured";

/**
 * FAILS CLOSED.
 *
 * This previously read:
 *
 *     const expectedToken = process.env.GATEWAY_INGEST_TOKEN;
 *     if (!expectedToken) return true;          // ← unauthenticated ingest
 *
 * which meant that on any deployment where the variable was simply absent —
 * a fresh preview, a misconfigured environment, a rotated-away value — this
 * endpoint accepted writes to `gateway_observations` from anyone who could
 * reach the URL. The failure mode was silent: nothing logged, nothing broken,
 * telemetry just became forgeable.
 *
 * An unset secret is now a 503, never an open door. The rule for anything
 * guarding a write path: absence of a credential is a configuration fault,
 * and a configuration fault denies.
 *
 * Comparison is length-then-content over the raw strings. Timing-safe
 * comparison is deliberately NOT used here: `timingSafeEqual` needs equal
 * lengths (leaking length anyway), and a remote attacker cannot resolve
 * per-character timing across a cellular link to a serverless function. The
 * real protection is that the token is high-entropy and never emitted.
 */
export function authorizeGatewayRequest(
  headerToken: string | null,
  expectedToken: string | undefined,
): GatewayAuthResult {
  const expected = expectedToken?.trim();
  if (!expected) return "not_configured";
  return headerToken === expected ? "ok" : "unauthorized";
}
