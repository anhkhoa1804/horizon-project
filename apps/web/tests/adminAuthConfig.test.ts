import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { isAdminAuthConfigured, isLocalAdminPasswordValid } from "@/lib/auth/localAdminSession";

/**
 * Admin auth must fail CLOSED, and it must fail QUIETLY.
 *
 * Found during the production-readiness audit: with ADMIN_SESSION_SECRET and
 * ADMIN_PASSWORD unset (the state of a fresh deployment), the secret
 * accessors threw. The throw propagated out of the /admin Server Component,
 * so an unconfigured deployment answered every admin request with an
 * unhandled 500 rather than a redirect to the login page.
 *
 * It never granted access — verified against the running server, a request
 * carrying a hand-crafted session cookie with a valid-looking payload and a
 * bogus signature was refused. But a 500 is an outage, not a security
 * control: it made a missing environment variable look like a broken
 * application, and it surfaced the variable's name in the dev error overlay.
 *
 * These pin both halves: no access without configuration, and no throw.
 */
describe("admin auth configuration", () => {
  const saved = {
    secret: process.env.ADMIN_SESSION_SECRET,
    password: process.env.ADMIN_PASSWORD,
  };

  beforeEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;
  });

  afterEach(() => {
    if (saved.secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = saved.secret;
    if (saved.password === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = saved.password;
  });

  it("reports itself unconfigured when either secret is missing", () => {
    assert.equal(isAdminAuthConfigured(), false, "no secrets at all");

    process.env.ADMIN_SESSION_SECRET = "s".repeat(32);
    assert.equal(isAdminAuthConfigured(), false, "session secret alone is not enough");

    delete process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_PASSWORD = "p".repeat(16);
    assert.equal(isAdminAuthConfigured(), false, "password alone is not enough");

    process.env.ADMIN_SESSION_SECRET = "s".repeat(32);
    assert.equal(isAdminAuthConfigured(), true, "both present");
  });

  it("rejects every password when none is configured, without throwing", () => {
    // The throw is the regression: this used to be the 500's origin.
    assert.doesNotThrow(() => isLocalAdminPasswordValid("anything"));
    assert.equal(isLocalAdminPasswordValid("anything"), false);
    assert.equal(isLocalAdminPasswordValid(""), false, "empty password must not match a missing one");
  });

  it("never accepts a password that does not match the configured one", () => {
    process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
    assert.equal(isLocalAdminPasswordValid("correct-horse-battery-staple"), true);
    assert.equal(isLocalAdminPasswordValid("correct-horse-battery-stapl"), false, "shorter");
    assert.equal(isLocalAdminPasswordValid("correct-horse-battery-staple!"), false, "longer");
    assert.equal(isLocalAdminPasswordValid(""), false);
  });
});
