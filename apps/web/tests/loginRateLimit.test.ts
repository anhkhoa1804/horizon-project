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
