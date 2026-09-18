import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mediaRule, REPORT_MEDIA_BUCKET, REPORT_MEDIA_MAX_FILES, validateReportMedia } from "@/lib/reports/media";

describe("report evidence media rules", () => {
  it("keeps the evidence bucket private-facing and limits each report to three files", () => {
    assert.equal(REPORT_MEDIA_BUCKET, "report-evidence");
    assert.equal(REPORT_MEDIA_MAX_FILES, 3);
  });

  it("accepts configured evidence types within their own bounds", () => {
    assert.deepEqual(mediaRule("image/jpeg"), { type: "photo", maxBytes: 8 * 1024 * 1024, extension: "jpg" });
    assert.deepEqual(validateReportMedia({ type: "audio/wav", size: 8_044 } as File), { type: "audio", extension: "wav" });
    assert.deepEqual(validateReportMedia({ type: "video/mp4", size: 20 * 1024 * 1024 } as File), { type: "video", extension: "mp4" });
  });

  it("rejects unknown, empty, and oversized files before an upload starts", () => {
    assert.equal(validateReportMedia({ type: "application/pdf", size: 12 } as File), null);
    assert.equal(validateReportMedia({ type: "audio/wav", size: 0 } as File), null);
    assert.equal(validateReportMedia({ type: "image/jpeg", size: 8 * 1024 * 1024 + 1 } as File), null);
  });
});
