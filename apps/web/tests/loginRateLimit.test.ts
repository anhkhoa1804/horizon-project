import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearLoginRateLimit, isLoginRateLimited, recordFailedLoginAttempt } from "@/lib/auth/loginRateLimit";

const BASE_TIME = 1_700_000_000_000;

describe("admin login rate limiting", () => {
  it("allows the first attempts through", () => {
    const email = "operator-a@example.com";
    assert.equal(isLoginRateLimited(email, BASE_TIME), false);
  });

  it("blocks after 5 failed attempts within the window", () => {
    const email = "operator-b@example.com";
    for (let i = 0; i < 5; i += 1) {
      recordFailedLoginAttempt(email, BASE_TIME + i * 1000);
    }
    assert.equal(isLoginRateLimited(email, BASE_TIME + 6000), true);
  });

  it("does not block a different email after another email is rate-limited", () => {
    const attacked = "operator-c@example.com";
    const bystander = "operator-d@example.com";
    for (let i = 0; i < 5; i += 1) {
      recordFailedLoginAttempt(attacked, BASE_TIME + i * 1000);
    }
    assert.equal(isLoginRateLimited(attacked, BASE_TIME + 6000), true);
    assert.equal(isLoginRateLimited(bystander, BASE_TIME + 6000), false);
  });

  it("allows attempts again once the window has passed", () => {
    const email = "operator-e@example.com";
    for (let i = 0; i < 5; i += 1) {
      recordFailedLoginAttempt(email, BASE_TIME + i * 1000);
    }
    assert.equal(isLoginRateLimited(email, BASE_TIME + 6000), true);

    const afterWindow = BASE_TIME + 16 * 60 * 1000;
    assert.equal(isLoginRateLimited(email, afterWindow), false);
  });

  it("clearLoginRateLimit resets the count immediately (successful login)", () => {
    const email = "operator-f@example.com";
    for (let i = 0; i < 5; i += 1) {
      recordFailedLoginAttempt(email, BASE_TIME + i * 1000);
    }
    assert.equal(isLoginRateLimited(email, BASE_TIME + 6000), true);

    clearLoginRateLimit(email);
    assert.equal(isLoginRateLimited(email, BASE_TIME + 6000), false);
  });
});

import { isSignInThrottled, recordSignInFailure, clearSignInFailures } from "@/lib/auth/loginRateLimit";

describe("admin sign-in throttle (audit I-11)", () => {
  const admin = "owner@example.com";
  it("a stranger's failures do not lock the real administrator out", () => {
    for (let i = 0; i < 5; i += 1) recordSignInFailure(admin, "203.0.113.9", BASE_TIME + i);
    assert.equal(isSignInThrottled(admin, "203.0.113.9", BASE_TIME + 10), true, "the guesser is throttled");
    assert.equal(isSignInThrottled(admin, "198.51.100.7", BASE_TIME + 10), false, "the administrator elsewhere is not");
  });
  it("rotating email addresses does not reset a caller's allowance", () => {
    for (let i = 0; i < 20; i += 1) recordSignInFailure(`probe${i}@example.com`, "192.0.2.50", BASE_TIME + i);
    assert.equal(isSignInThrottled("another@example.com", "192.0.2.50", BASE_TIME + 30), true);
  });
  it("distributed guessing against one email is still capped", () => {
    for (let i = 0; i < 40; i += 1) recordSignInFailure("target@example.com", `10.0.0.${i}`, BASE_TIME + i);
    assert.equal(isSignInThrottled("target@example.com", "10.9.9.9", BASE_TIME + 50), true);
  });
  it("a successful sign-in clears that caller's own bucket", () => {
    for (let i = 0; i < 4; i += 1) recordSignInFailure("clear@example.com", "198.18.0.1", BASE_TIME + i);
    clearSignInFailures("clear@example.com", "198.18.0.1");
    assert.equal(isSignInThrottled("clear@example.com", "198.18.0.1", BASE_TIME + 10), false);
  });
});
