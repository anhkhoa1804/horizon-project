import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyInsertError, isMissingTableError } from "@/lib/reports/reportPersistence";

describe("report persistence error classification", () => {
  it("treats a missing-table error (PGRST205) as an unavailable persistence path", () => {
    const error = { code: "PGRST205", message: "table not found" };
    assert.equal(isMissingTableError(error), true);
    assert.equal(classifyInsertError(error), "insert_failed");
  });

  it("treats every Supabase error as a genuine insert failure", () => {
    // Regression guard: before this fix, ANY error (RLS denial, network
    // failure, permissions issue) fell back to demo mode and returned
    // ok:true — silently masquerading a real production failure as a
    // successful submission. The route now permits demo only through its
    // explicit request/environment boundary.
    const rlsDenied = { code: "42501", message: "permission denied" };
    const networkError = { code: "ECONNRESET", message: "connection reset" };

    assert.equal(isMissingTableError(rlsDenied), false);
    assert.equal(classifyInsertError(rlsDenied), "insert_failed");

    assert.equal(isMissingTableError(networkError), false);
    assert.equal(classifyInsertError(networkError), "insert_failed");
  });

  it("handles malformed/non-object error values without throwing", () => {
    assert.equal(isMissingTableError(null), false);
    assert.equal(isMissingTableError(undefined), false);
    assert.equal(isMissingTableError("plain string error"), false);
    assert.equal(classifyInsertError(null), "insert_failed");
  });
});
