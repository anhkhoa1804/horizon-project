import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { authorizeGatewayRequest } from "@/lib/gateway/ingestAuth";

/**
 * THE FAIL-OPEN THIS FILE EXISTS TO PREVENT.
 *
 * The retired `/api/public/gateway` route once wrote to
 * `gateway_observations`. Its authorisation check used to read:
 *
 *     const expectedToken = process.env.GATEWAY_INGEST_TOKEN;
 *     if (!expectedToken) return true;
 *
 * On any deployment where that variable was absent — a fresh preview, a
 * mis-copied environment, a rotation that removed the old value before the
 * new one landed — the endpoint accepted writes from anyone who could reach
 * the URL, with nothing logged and nothing visibly broken. Forged telemetry
 * would simply appear in the table.
 *
 * The property under test is therefore not "does a good token work" but
 * "is there any input for which an unconfigured server accepts a write".
 */

describe("gateway ingest authorisation", () => {
  const TOKEN = "test-token-not-a-real-secret";

  it("accepts a request whose header matches the configured token", () => {
    assert.equal(authorizeGatewayRequest(TOKEN, TOKEN), "ok");
  });

  it("rejects a wrong token", () => {
    assert.equal(authorizeGatewayRequest("wrong-token", TOKEN), "unauthorized");
  });

  it("rejects a missing header when a token IS configured", () => {
    assert.equal(authorizeGatewayRequest(null, TOKEN), "unauthorized");
  });

  it("rejects an empty header when a token IS configured", () => {
    assert.equal(authorizeGatewayRequest("", TOKEN), "unauthorized");
  });

  /**
   * The regression itself. Every one of these inputs returned `true` — i.e.
   * authorised — under the old implementation.
   */
  it("FAILS CLOSED when the server has no token configured", () => {
    for (const header of [null, "", "anything", "guessed-token"]) {
      assert.equal(
        authorizeGatewayRequest(header, undefined),
        "not_configured",
        `unset token must never authorise (header: ${JSON.stringify(header)})`,
      );
      assert.equal(
        authorizeGatewayRequest(header, ""),
        "not_configured",
        `empty token must never authorise (header: ${JSON.stringify(header)})`,
      );
      assert.equal(
        authorizeGatewayRequest(header, "   "),
        "not_configured",
        `whitespace-only token must never authorise (header: ${JSON.stringify(header)})`,
      );
    }
  });

  it("never returns 'ok' for any header when the token is unset", () => {
    const results = [null, "", "x", "null", "undefined", "true"].map((h) =>
      authorizeGatewayRequest(h, undefined),
    );
    assert.ok(
      results.every((r) => r !== "ok"),
      "an unconfigured deployment authorised a gateway write",
    );
  });
});

describe("gateway ingest secret hygiene", () => {
  const routeSrc = fs.readFileSync(path.join(process.cwd(), "lib", "gateway", "ingestAuth.ts"), "utf8");

  it("never puts the token into a response body", () => {
    // The error bodies name the VARIABLE, never a value. A response that
    // echoed the expected token — even to help debugging — would hand the
    // credential to the unauthenticated caller being rejected.
    assert.ok(
      !/GATEWAY_INGEST_TOKEN\s*[,}]/.test(routeSrc.replace(/process\.env\.GATEWAY_INGEST_TOKEN/g, "")),
      "the token variable appears to be serialised into a payload",
    );
    assert.ok(
      !/NextResponse\.json\([^)]*expectedToken/.test(routeSrc),
      "a response body references the expected token",
    );
  });

  it("never logs the token value", () => {
    const logCalls = routeSrc.match(/console\.(log|error|warn|info)\([^;]*\)/g) ?? [];
    for (const call of logCalls) {
      assert.ok(
        !/expectedToken|process\.env\.GATEWAY_INGEST_TOKEN/.test(call),
        `a log statement includes the token value: ${call.slice(0, 90)}`,
      );
    }
  });

  it("keeps the variable server-side — never NEXT_PUBLIC_", () => {
    // A NEXT_PUBLIC_ prefix would inline the secret into the client bundle
    // at build time, publishing it to every visitor.
    assert.ok(
      !/NEXT_PUBLIC_GATEWAY_INGEST_TOKEN/.test(routeSrc),
      "the ingest token was exposed through a NEXT_PUBLIC_ variable",
    );
  });
});
