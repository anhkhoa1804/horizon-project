import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards against raw control bytes ending up inside source files.
 *
 * THE BUG THIS CATCHES, three times over. Scripted edits that build a
 * replacement string in a language with its own escape rules can emit the
 * BYTE a `\b`, `\x00` or `\x1f` escape was meant to *describe*. The result
 * compiles, looks correct in most editors, and silently changes meaning:
 *
 *   - `/[\x00-\x1f]/` in safeRedirect.ts became a literal NUL, which made
 *     git treat a TypeScript file as binary — no diff, no blame.
 *   - `/<ControlSelect\b/` in a test became `/<ControlSelect<BS>/`, a regex
 *     that matches nothing. The test passed vacuously in one direction and
 *     failed inexplicably in the other.
 *
 * A byte-level assertion is the only thing that catches this class, because
 * every higher-level tool renders the file as if it were fine.
 *
 * Tab, LF and CR are legitimate. Everything else below 0x20, plus DEL, is
 * not — no source file in this project has a reason to contain one.
 */
const ALLOWED = new Set([0x09, 0x0a, 0x0d]);
const ROOTS = ["app", "components", "lib", "tests", "content"];

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css|md|json)$/.test(entry.name)) out.push(full);
  }
}

describe("source hygiene", () => {
  it("contains no raw control bytes in any source file", () => {
    const files: string[] = [];
    for (const root of ROOTS) walk(path.join(process.cwd(), root), files);
    assert.ok(files.length > 50, "the file walk found suspiciously few files");

    const offenders: string[] = [];
    for (const file of files) {
      const bytes = fs.readFileSync(file);
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i]!;
        if ((b < 0x20 && !ALLOWED.has(b)) || b === 0x7f) {
          offenders.push(`${path.relative(process.cwd(), file)} @${i} = 0x${b.toString(16)}`);
          break;
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `raw control bytes found — an escape sequence was written as its byte:\n  ${offenders.join("\n  ")}`,
    );
  });
});
