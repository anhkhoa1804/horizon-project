import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportQuery } from "@/lib/admin/reports";

describe("admin report query parsing", () => {
  it("accepts only known statuses", () => {
    assert.equal(parseReportQuery("resolved", "1").status, "resolved");
    assert.equal(parseReportQuery("new", undefined).status, "new");
    for (const bad of ["", "all; drop table damage_logs", "RESOLVED", undefined, null, ["new"]]) assert.equal(parseReportQuery(bad, "1").status, "all", String(bad));
  });
  it("clamps the page to a positive integer", () => {
    assert.equal(parseReportQuery("all", "3").page, 3);
    for (const bad of ["0", "-4", "abc", "", undefined, "99999999", "1e9"]) assert.equal(parseReportQuery("all", bad).page, 1, String(bad));
  });
});
