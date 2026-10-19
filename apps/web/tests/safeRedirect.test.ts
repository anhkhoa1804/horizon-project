import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeRedirect } from "@/lib/auth/safeRedirect";

/**
 * Open-redirect guard for the post-login destination.
 *
 * `/admin/login?redirect=…` is a link an attacker can send to an operator, and
 * the redirect fires immediately after a successful login — which is exactly
 * when a lookalike credential prompt is most likely to be believed.
 *
 * The original guard (`startsWith("/") && !startsWith("//")`) was bypassable:
 * browsers normalise `\` to `/`, so `/\evil.com` becomes `//evil.com`.
 */
describe("safeRedirect", () => {
  it("allows ordinary same-origin paths", () => {
    assert.equal(safeRedirect("/admin"), "/admin");
    assert.equal(safeRedirect("/admin/settings"), "/admin/settings");
    assert.equal(safeRedirect("/admin?tab=reports"), "/admin?tab=reports");
  });

  it("rejects the backslash bypass", () => {
    // The actual vulnerability: these all reach an external origin once the
    // browser has normalised them.
    assert.equal(safeRedirect("/\\evil.com"), "/admin");
    assert.equal(safeRedirect("/\\/evil.com"), "/admin");
    assert.equal(safeRedirect("\\\\evil.com"), "/admin");
  });

  it("rejects control characters that browsers strip before navigating", () => {
    assert.equal(safeRedirect("/\tevil.com"), "/admin");
    assert.equal(safeRedirect("/\nevil.com"), "/admin");
    assert.equal(safeRedirect("/\r/evil.com"), "/admin");
    assert.equal(safeRedirect("/\x00evil"), "/admin");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    for (const hostile of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//evil.com/admin",
    ]) {
      assert.equal(safeRedirect(hostile), "/admin", `${hostile} must not be honoured`);
    }
  });

  it("rejects non-strings, empties and absurd lengths", () => {
    assert.equal(safeRedirect(undefined), "/admin");
    assert.equal(safeRedirect(null), "/admin");
    assert.equal(safeRedirect(42), "/admin");
    assert.equal(safeRedirect(""), "/admin");
    assert.equal(safeRedirect(`/${"a".repeat(600)}`), "/admin");
  });

  it("drops the fragment, keeping only path and query", () => {
    assert.equal(safeRedirect("/admin#section"), "/admin");
    assert.equal(safeRedirect("/admin?a=1#x"), "/admin?a=1");
  });

  it("honours a caller-supplied fallback", () => {
    assert.equal(safeRedirect("//evil.com", "/"), "/");
  });
});
