import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  checkReportMedia,
  mediaFingerprint,
  parseReportMediaPath,
  reportMediaPath,
  resolveMediaMime,
  validateReportMedia,
} from "@/lib/reports/media";
import { parseMediaManifest } from "@/lib/reports/evidence";
import { issueUploadTicket, verifyUploadTicket } from "@/lib/reports/uploadTicket";

const MB = 1024 * 1024;

describe("evidence MIME resolution", () => {
  it("accepts a phone video whose browser reported no type, by extension", () => {
    assert.equal(resolveMediaMime({ name: "IMG_0042.MOV", type: "" }), "video/quicktime");
    assert.equal(resolveMediaMime({ name: "clip.mp4", type: "application/octet-stream" }), "video/mp4");
    assert.equal(resolveMediaMime({ name: "photo.HEIC", type: "" }), "image/heic");
  });

  it("never lets an extension override a concrete, unsupported declared type", () => {
    assert.equal(resolveMediaMime({ name: "evil.mp4", type: "application/pdf" }), null);
    assert.equal(resolveMediaMime({ name: "clip.mp4", type: "video/3gpp" }), null);
  });

  it("normalises aliases and codec parameters", () => {
    assert.equal(resolveMediaMime({ name: "a.jpg", type: "image/jpg" }), "image/jpeg");
    assert.equal(resolveMediaMime({ name: "voice.webm", type: "audio/webm;codecs=opus" }), "audio/webm");
    assert.equal(resolveMediaMime({ name: "note.wav", type: "audio/x-wav" }), "audio/wav");
  });

  it("rejects unknown extensions when the type is blank", () => {
    assert.equal(resolveMediaMime({ name: "notes.docx", type: "" }), null);
    assert.equal(resolveMediaMime({ type: "" }), null);
  });
});

describe("evidence verdicts say why a file was refused", () => {
  it("separates type, empty and size problems", () => {
    assert.equal(checkReportMedia({ name: "a.pdf", type: "application/pdf", size: 10 }).reason, "unsupported_type");
    assert.equal(checkReportMedia({ name: "a.mp4", type: "video/mp4", size: 0 }).reason, "empty");
    assert.equal(checkReportMedia({ name: "a.mp4", type: "video/mp4", size: 20 * MB + 1 }).reason, "too_large");
    assert.equal(checkReportMedia({ name: "a.mp4", type: "video/mp4", size: 20 * MB }).ok, true);
    assert.equal(checkReportMedia({ name: "a.jpg", type: "image/jpeg", size: 8 * MB + 1 }).reason, "too_large");
  });

  it("returns the canonical type used for Storage", () => {
    assert.deepEqual(validateReportMedia({ name: "x.mov", type: "", size: 5 * MB }), {
      type: "video",
      extension: "mov",
      mimeType: "video/quicktime",
    });
  });

  it("treats the same name, size and mtime as a duplicate pick", () => {
    const a = { name: "a.mp4", size: 10, lastModified: 5 };
    assert.equal(mediaFingerprint(a), mediaFingerprint({ ...a }));
    assert.notEqual(mediaFingerprint(a), mediaFingerprint({ ...a, size: 11 }));
  });
});

describe("storage paths", () => {
  it("round-trips a server-chosen path and rejects anything else", () => {
    const id = "0b9d0a52-6c1f-4d0e-9c1e-0a1b2c3d4e5f";
    const path = reportMediaPath("report_1", id, "mp4");
    assert.deepEqual(parseReportMediaPath(path), { reportId: "report_1", fileName: `${id}.mp4`, extension: "mp4" });
    assert.equal(parseReportMediaPath("reports/../secrets/x.mp4"), null);
    assert.equal(parseReportMediaPath("other/report_1/x.mp4"), null);
    assert.equal(parseReportMediaPath(`reports/a/b/${id}.mp4`), null);
  });
});

describe("media manifest (declared before the report row is written)", () => {
  it("accepts nothing, or a valid list", () => {
    assert.deepEqual(parseMediaManifest(undefined), { entries: [], problems: [] });
    const ok = parseMediaManifest([{ name: "a.mp4", type: "video/mp4", size: 3 * MB }]);
    assert.equal(ok?.entries.length, 1);
    assert.equal(ok?.problems.length, 0);
  });

  it("flags unsupported, oversize and malformed entries without throwing", () => {
    const result = parseMediaManifest([
      { name: "a.pdf", type: "application/pdf", size: 10 },
      { name: "b.mp4", type: "video/mp4", size: 99 * MB },
      { name: "c.mp4", type: "video/mp4", size: "big" },
    ]);
    assert.equal(result?.entries.length, 0);
    assert.deepEqual(result?.problems.map((p) => p.reason), ["unsupported_type", "too_large", "empty"]);
    assert.deepEqual(parseMediaManifest([null])?.problems.map((p) => p.reason), ["unsupported_type"]);
  });

  it("rejects a non-array manifest and more than three files", () => {
    assert.equal(parseMediaManifest({ name: "a" }), null);
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `${i}.mp4`, type: "video/mp4", size: MB }));
    assert.ok(parseMediaManifest(four)?.problems.every((p) => p.reason === "too_many"));
  });
});

describe("upload ticket", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_ticket_test_only";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  });

  it("binds a report to its paths and verifies", () => {
    const ticket = issueUploadTicket("r1", ["reports/r1/a.mp4"], 1_000_000);
    assert.ok(ticket);
    const payload = verifyUploadTicket(ticket, 1_000_000);
    assert.equal(payload?.reportId, "r1");
    assert.deepEqual(payload?.paths, ["reports/r1/a.mp4"]);
  });

  it("expires", () => {
    const ticket = issueUploadTicket("r1", ["p"], 1_000_000);
    assert.equal(verifyUploadTicket(ticket, 1_000_000 + 3 * 60 * 60 * 1000), null);
  });

  it("rejects tampering with the payload or signature", () => {
    const ticket = issueUploadTicket("r1", ["reports/r1/a.mp4"])!;
    const [payload, signature] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ reportId: "r2", paths: ["reports/r2/x.mp4"], exp: 9_999_999_999 })).toString("base64url");
    assert.equal(verifyUploadTicket(`${forged}.${signature}`), null);
    assert.equal(verifyUploadTicket(`${payload}.${signature}x`), null);
    assert.equal(verifyUploadTicket(`${payload}.${signature}.extra`), null);
    assert.equal(verifyUploadTicket(undefined), null);
    assert.equal(verifyUploadTicket(""), null);
  });

  it("is invalid under a different service key and unavailable without one", () => {
    const ticket = issueUploadTicket("r1", ["p"])!;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_other_key";
    assert.equal(verifyUploadTicket(ticket), null);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(issueUploadTicket("r1", ["p"]), null);
  });
});
