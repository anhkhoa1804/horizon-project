import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { negotiateLocale, DEFAULT_LOCALE } from "../lib/i18n/config";

describe("browser language negotiation (explicit cookie choice is handled by getLocale)", () => {
  it("follows the browser's preferred supported language", () => {
    assert.equal(negotiateLocale("en-US,en;q=0.9,vi;q=0.5"), "en");
    assert.equal(negotiateLocale("vi-VN,vi;q=0.9,en;q=0.8"), "vi");
    assert.equal(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8"), "en");
  });
  it("honours q-weights regardless of order", () => {
    assert.equal(negotiateLocale("en;q=0.4, vi;q=0.9"), "vi");
  });
  it("falls back to the documented default for missing, wildcard, unsupported or malformed input", () => {
    for (const v of [undefined, null, "", "*", "fr,de;q=0.5", "en;q=0", ";;;,,", "en;q=abc"]) {
      assert.equal(negotiateLocale(v as string | null | undefined), DEFAULT_LOCALE, String(v));
    }
  });
  it("never depends on the clock", () => {
    const a = negotiateLocale("en");
    const realNow = Date.now; Date.now = () => 0;
    try { assert.equal(negotiateLocale("en"), a); } finally { Date.now = realNow; }
  });
});
