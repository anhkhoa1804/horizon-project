import type { ObservatoryReferenceItem } from "./types";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Reference guidance shown on Monitoring.
 *
 * The hard rule here: an externally-published guideline and a number written
 * in a firmware comment must never look alike. Each entry declares its
 * `standing`, and the UI renders the three differently.
 *
 * On units — FAO's irrigation-water guideline is expressed in **ECw (dS/m)**,
 * electrical conductivity. HORIZON displays water salinity in **‰**.
 * Converting between them depends on the ionic composition of the specific
 * water (the common TDS ≈ 640 × EC factor is an approximation for typical
 * irrigation water, not a constant), so this module deliberately does NOT
 * restate FAO's thresholds in ‰. Doing that would manufacture a precise-
 * looking number FAO never published and attach their authority to it. FAO
 * is presented in its own units as context; the project's own ‰ figures stay
 * clearly marked as unverified internal guidance.
 */

const FAO_SOURCE = "FAO Irrigation and Drainage Paper 29 Rev. 1 — Water quality for agriculture (Ayers & Westcot)";
const FAO_URL = "https://www.fao.org/4/t0234e/t0234e01.htm";

export function buildReference(
  threshold: { warningLevel: number; criticalLevel: number } | null,
  dict: Dictionary,
): ObservatoryReferenceItem[] {
  const r = dict.reference;
  const items: ObservatoryReferenceItem[] = [
    {
      title: r.faoTitle,
      standing: "external",
      rows: [
        { range: "< 0,7 dS/m", meaning: r.faoNoRestriction },
        { range: "0,7 – 3,0 dS/m", meaning: r.faoSlight },
        { range: "> 3,0 dS/m", meaning: r.faoSevere },
      ],
      detail: r.faoDetail,
      sourceLabel: FAO_SOURCE,
      sourceUrl: FAO_URL,
    },
  ];

  if (threshold) {
    // A threshold configured in crop_thresholds is a real operational
    // setting, but it is the project's own choice — not an external standard.
    items.push({
      title: r.configuredTitle,
      standing: "internal",
      rows: [
        { range: `≥ ${threshold.warningLevel.toFixed(2)}‰`, meaning: r.configuredWatch },
        { range: `≥ ${threshold.criticalLevel.toFixed(2)}‰`, meaning: r.configuredRisk },
      ],
      detail: r.configuredDetail,
      sourceLabel: r.configuredSource,
      sourceUrl: null,
    });
  } else {
    items.push({
      title: r.unconfiguredTitle,
      standing: "unverified",
      rows: [],
      detail: r.unconfiguredDetail,
      sourceLabel: null,
      sourceUrl: null,
    });
  }

  items.push({
    title: r.soilTitle,
    standing: "unverified",
    rows: [],
    detail: r.soilDetail,
    sourceLabel: null,
    sourceUrl: null,
  });

  return items;
}
