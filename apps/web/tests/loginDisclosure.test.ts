import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * I-11: the sign-in action must not tell a caller whether an email is on the
 * allowlist. Source-level (a server action cannot be invoked outside Next).
 */
const src = fs.readFileSync(path.join(process.cwd(), "components", "auth", "login-form.tsx"), "utf8");
const action = src.slice(src.indexOf("async function loginAdmin"), src.indexOf("export async function LoginForm"));

describe("admin sign-in disclosure", () => {
  it("never redirects to the allowlist-specific error from the sign-in action", () => {
    assert.ok(!action.includes("error=unauthorized"));
  });
  it("checks the allowlist and the password together and answers with one error", () => {
    assert.match(action, /!allowed \|\| !passwordOk/);
    assert.equal((action.match(/error=bad-password/g) ?? []).length, 1);
  });
  it("throttles before evaluating credentials, keyed per caller", () => {
    assert.ok(action.indexOf("isSignInThrottled") < action.indexOf("isAdminEmailAllowed"));
    assert.match(action, /clientIdentifier/);
  });
});
