import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The freeze guard for mixed-language UI.
 *
 * Phase 9.3 reported "401 hardcoded Vietnamese strings" using a scanner that
 * only matched QUOTED literals — so JSX text nodes (`<p>Bản ghi</p>`) were
 * invisible to it and the real figure was higher. This test scans the way a
 * reader experiences the page: any Vietnamese-specific diacritic in a source
 * file, comments excluded.
 *
 * Files fall into two sets:
 *
 *   INTERFACE  — must contain no Vietnamese. Labels, controls, validation,
 *                status words and empty states all resolve through
 *                lib/i18n, so an English reader never meets an untranslated
 *                fragment of chrome.
 *
 *   ALLOWED    — may contain Vietnamese, for a stated reason. Each entry
 *                carries its category so the list cannot quietly become a
 *                dumping ground:
 *                  D = Vietnamese-only editorial draft (disclosed in the UI
 *                      by <TranslationNotice/>)
 *                  B = proper nouns / place names
 *                  E = developer-facing or non-rendered fallback strings
 *
 * A NEW interface file with Vietnamese in it fails here rather than shipping.
 */

const VIETNAMESE =
  /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵÀÁẢÃẠẰẮẲẴẶẦẤẨẪẬÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/;

/** Vietnamese here is the source dictionary or documented content, by design. */
const ALLOWED = new Map<string, string>([
  ["app/admin/login/page.tsx", "B — project place name"],
  ["components/admin/ingestion-health-panel.tsx", "operator-only Vietnamese console behind auth"],
  ["components/admin/runtime-config-form.tsx", "operator-only Vietnamese console behind auth"],
  ["lib/gateway/remoteConfigService.ts", "operator-only typed validation feedback"],
  ["components/monitoring/field-observatory.tsx", "B — project place name"],
  ["components/dashboard/station-network-map.tsx", "B — project place name in bilingual map controls"],
  ["app/report/page.tsx", "D — bilingual editorial opening, locale selected explicitly"],
  ["components/monitoring/danger-heatmap.tsx", "bilingual compact instrument labels, locale selected explicitly"],
  ["lib/i18n/vi.ts", "the Vietnamese dictionary itself"],
  ["lib/i18n/en.ts", "carries Vietnamese place names (Cồn Hô, Vĩnh Long) — category B"],
  ["lib/i18n/terminology.ts", "the VI↔EN scientific terminology contract"],
  ["app/page.tsx", "D — homepage chapter essays, disclosed by TranslationNotice"],
  ["app/admin/page.tsx", "operator-only console behind auth, single Vietnamese-speaking operator"],
  [
    "components/admin/operations-panels.tsx",
    "operator-only console behind auth — same audience and reason as app/admin/page.tsx",
  ],
  [
    "components/admin/network-overview.tsx",
    "operator-only console behind auth — same audience and same reason as app/admin/page.tsx, which this panel was extracted from",
  ],
  ["lib/stationProfile.ts", "B/D — station names and their descriptive prose"],
  ["lib/monitoring/buildObservatory.ts", "E — `label` fallbacks; every metric carries a labelKey the UI prefers"],
  ["lib/content/posts.ts", "D — field-note post content"],
  ["lib/content/gallery.ts", "D — gallery caption content"],
  ["lib/auth/adminAllowlist.ts", "E — developer-facing message"],
  ["lib/external/weather.ts", "B — the region name Vĩnh Long"],
  ["app/opengraph-image.tsx", "B — the static `alt` export carries the place name Cồn Hô, Vĩnh Long; every other string on the card comes from the dictionary"],
  ["app/api/public/reports/route.ts", "E — server-side API message, never rendered as UI"],
  ["components/ui/wordmark.tsx", "B — brand alt text"],
  ["components/ui/measurement-value.tsx", "E — JSDoc examples in prop docs"],

  ["components/pwa/install-prompt.tsx", "B — platform names"],
  ["lib/i18n/config.ts", "B — the switcher shows each language in its own name (Tiếng Việt)"],
]);

/**
 * Blanks comment CONTENT while preserving newlines, so the line numbers in a
 * failure message point at the real line in the file. Deleting the comments
 * outright shifted every reported number and made the failure hard to act on.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + " ".repeat(m.length - p1.length));
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (/node_modules|\.next/.test(full)) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const root of ["app", "components", "lib"]) {
    const dir = path.join(process.cwd(), root);
    if (fs.existsSync(dir)) walk(dir);
  }
  return out;
}

describe("no hardcoded Vietnamese in interface code", () => {
  it("keeps every interface file free of Vietnamese text", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
      if (ALLOWED.has(rel)) continue;

      const clean = stripComments(fs.readFileSync(file, "utf8"));
      const lines = clean
        .split("\n")
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => VIETNAMESE.test(line));

      if (lines.length > 0) {
        offenders.push(`${rel}: ${lines.map(([n]) => n).join(", ")}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Vietnamese found in interface code — route it through lib/i18n, or add the file to ALLOWED with a category:\n  ${offenders.join("\n  ")}`,
    );
  });

  it("keeps the allowlist honest — every entry still exists and still needs it", () => {
    // A stale entry would silently permit Vietnamese in a file that has since
    // been translated, re-opening the hole this test exists to close.
    for (const [rel, reason] of ALLOWED) {
      const full = path.join(process.cwd(), rel);
      assert.ok(fs.existsSync(full), `allowlisted file no longer exists: ${rel}`);
      assert.ok(reason.length > 10, `allowlist entry needs a real reason: ${rel}`);

      const clean = stripComments(fs.readFileSync(full, "utf8"));
      assert.ok(
        VIETNAMESE.test(clean),
        `${rel} no longer contains Vietnamese — remove it from ALLOWED so the guard applies again`,
      );
    }
  });
});
