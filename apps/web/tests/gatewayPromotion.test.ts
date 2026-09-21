import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const retiredRoute = path.join(process.cwd(), "app", "api", "public", "gateway", "route.ts");

describe("gateway observation retirement", () => {
  it("has no public Next.js gateway ingestion route", () => {
    assert.equal(fs.existsSync(retiredRoute), false);
  });
});
