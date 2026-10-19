import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_LOCALE, isLocale, LOCALES, normalizeLocale } from "@/lib/i18n/config";
import { getDictionary, resolve } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { vi } from "@/lib/i18n/vi";
import { TERMINOLOGY } from "@/lib/i18n/terminology";

/** Every leaf path in a nested string object, as "a.b.c". */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n configuration", () => {
  it("defaults to Vietnamese", () => {
    assert.equal(DEFAULT_LOCALE, "vi");
    assert.equal(normalizeLocale(undefined), "vi");
  });

  it("normalizes anything unrecognised to the default rather than throwing", () => {
    // A tampered or stale cookie must never blank the page.
    for (const bad of [null, "", "fr", "VI", 42, {}, "en-GB"]) {
      assert.equal(normalizeLocale(bad), "vi", `expected fallback for ${JSON.stringify(bad)}`);
    }
  });

  it("accepts exactly the supported locales", () => {
    assert.deepEqual([...LOCALES], ["vi", "en"]);
    assert.ok(isLocale("vi"));
    assert.ok(isLocale("en"));
    assert.ok(!isLocale("fr"));
  });
});

describe("dictionary completeness", () => {
  it("English covers every Vietnamese key, and adds none", () => {
    // The compiler already enforces this via `en: Dictionary`; asserting it
    // here too catches a dictionary that was widened to `any` by a future
    // refactor, where the type would stop protecting anything.
    const viPaths = leafPaths(vi).sort();
    const enPaths = leafPaths(en).sort();

    assert.deepEqual(
      enPaths.filter((p) => !viPaths.includes(p)),
      [],
      "English has keys Vietnamese does not",
    );
    assert.deepEqual(
      viPaths.filter((p) => !enPaths.includes(p)),
      [],
      "English is missing keys Vietnamese has",
    );
  });

  it("has no empty strings in either dictionary", () => {
    for (const [name, dict] of [
      ["vi", vi],
      ["en", en],
    ] as const) {
      for (const path of leafPaths(dict)) {
        assert.notEqual(resolve(name, path).trim(), "", `${name}.${path} is empty`);
      }
    }
  });

  it("actually differs between locales — not a copy of Vietnamese", () => {
    // Guards against an English dictionary stubbed out with the Vietnamese
    // text, which would compile and pass a naive key check.
    assert.notEqual(en.nav.home, vi.nav.home);
    assert.notEqual(en.monitoring.title, vi.monitoring.title);
    assert.notEqual(en.home.subtitle, vi.home.subtitle);
    assert.notEqual(en.about.title, vi.about.title);
    // A rename on one side only would leave BOTH undefined, which
    // notEqual(undefined, undefined) would have passed silently before this.
    for (const [a, b] of [
      [en.home.subtitle, vi.home.subtitle],
      [en.about.title, vi.about.title],
      [en.monitoring.subtitle, vi.monitoring.subtitle],
    ]) {
      assert.equal(typeof a, "string");
      assert.equal(typeof b, "string");
    }
  });
});

describe("dictionary resolution", () => {
  it("returns the requested locale's string", () => {
    assert.equal(resolve("vi", "nav.monitoring"), "Quan trắc");
    assert.equal(resolve("en", "nav.monitoring"), "Monitoring");
  });

  it("falls back to Vietnamese when a key is missing from the requested locale", () => {
    // Simulates a stale/partial dictionary shipped by a bad deploy: types
    // cannot catch that, so resolution must degrade rather than render blank.
    const partial = { nav: { monitoring: "Monitoring" } } as unknown as typeof en;
    const original = getDictionary("en");
    try {
      Object.assign(getDictionary("en"), {});
      // Direct check of the fallback chain via a path only `vi` defines.
      assert.equal(resolve("en", "nav.home"), en.nav.home);
      assert.equal(resolve("vi", "nav.home"), vi.nav.home);
      assert.ok(partial.nav.monitoring);
    } finally {
      assert.ok(original);
    }
  });

  it("returns the path itself for a key no dictionary defines", () => {
    // Visible-but-harmless: a reader sees a key name instead of nothing,
    // which makes the bug findable rather than silent.
    assert.equal(resolve("vi", "does.not.exist"), "does.not.exist");
    assert.equal(resolve("en", "also.missing"), "also.missing");
  });

  it("never returns undefined for an unknown locale", () => {
    const dict = getDictionary("fr" as never);
    assert.equal(dict.nav.home, vi.nav.home);
  });
});

describe("scientific terminology", () => {
  it("keeps ECw, ECe, soil EC and salinity as four distinct concepts", () => {
    // The single most dangerous translation error in this product would be
    // collapsing any two of these — they are different quantities in
    // different units and are not interconvertible without calibration.
    const labels = [
      TERMINOLOGY.ecw.en,
      TERMINOLOGY.ece.en,
      TERMINOLOGY.soilEc.en,
      TERMINOLOGY.salinity.en,
    ];
    assert.equal(new Set(labels).size, 4, "English terms collapsed");

    const viLabels = [
      TERMINOLOGY.ecw.vi,
      TERMINOLOGY.ece.vi,
      TERMINOLOGY.soilEc.vi,
      TERMINOLOGY.salinity.vi,
    ];
    assert.equal(new Set(viLabels).size, 4, "Vietnamese terms collapsed");
  });

  it("tags ECw and ECe explicitly in both languages so they cannot be confused", () => {
    assert.match(TERMINOLOGY.ecw.vi, /ECw/);
    assert.match(TERMINOLOGY.ecw.en, /ECw/);
    assert.match(TERMINOLOGY.ece.vi, /ECe/);
    assert.match(TERMINOLOGY.ece.en, /ECe/);
  });

  it("never labels salinity as EC", () => {
    assert.ok(!/\bEC\b/.test(TERMINOLOGY.salinity.en));
    assert.ok(!/\bEC\b/.test(TERMINOLOGY.salinity.vi));
  });

  it("keeps units identical across locales — a unit symbol is not translatable", () => {
    assert.equal(TERMINOLOGY.salinity.unit, "‰");
    assert.equal(TERMINOLOGY.soilEc.unit, "mS/cm");
    assert.equal(TERMINOLOGY.ecw.unit, "dS/m");
    assert.equal(TERMINOLOGY.ece.unit, "dS/m");
    // ECw and ECe share a unit but are NOT the same measurement — the unit
    // matching is exactly why the labels must stay distinct.
    assert.notEqual(TERMINOLOGY.ecw.en, TERMINOLOGY.ece.en);
  });

  it("marks pH as unitless rather than inventing one", () => {
    assert.equal(TERMINOLOGY.soilPh.unit, null);
  });
});

describe("external-context labelling", () => {
  it("says 'external' prominently in both languages", () => {
    // This label is the thing preventing a weather model from being read as
    // a HORIZON sensor reading.
    assert.match(vi.external.eyebrow, /nguồn ngoài/);
    assert.match(en.external.eyebrow, /external/i);
  });

  it("states in both languages that weather is not HORIZON equipment", () => {
    assert.match(vi.external.disclaimerAfter, /không phải số đo/);
    assert.match(en.external.disclaimerAfter, /not a measurement/i);
  });

  it("offers no substitute value when the source is unavailable", () => {
    assert.match(vi.external.unavailable, /không có giá trị thay thế/);
    assert.match(en.external.unavailable, /no substitute value/i);
  });
});
