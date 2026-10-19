/**
 * ONE-LINE CONTEXT FOR A REGIONAL READING.
 *
 * The brief for this file was "add a contextual interpretation under each
 * weather value" — and the hard part is not writing the words, it is refusing
 * to write them where nothing justifies them.
 *
 * THE RULE APPLIED HERE: a value gets a context line only if a published,
 * single-variable classification exists for that quantity. Two of the four
 * regional readings clear that bar, and two do not:
 *
 *   WIND         → yes. The Beaufort scale is a WMO standard with defined
 *                  km/h boundaries. Descriptive, not diagnostic.
 *   PRECIPITATION → yes. Rainfall-intensity classes (light / moderate /
 *                  heavy / violent) are standard meteorological usage with
 *                  published mm-per-hour boundaries.
 *   TEMPERATURE  → NO. "Trời oi" is a comfort judgement, and every official
 *                  index that makes it (heat index, humidex, WBGT) is a
 *                  FUNCTION OF TEMPERATURE AND HUMIDITY TOGETHER. Labelling a
 *                  bare temperature "muggy" would be inventing a
 *                  single-variable rule that no source supports.
 *   HUMIDITY     → NO, for the same reason in reverse. 85% RH at 20°C and at
 *                  34°C are not the same experience, and nothing published
 *                  classifies relative humidity on its own.
 *
 * The two that qualify return a plain descriptive phrase. Neither implies
 * danger: this is regional model data from outside the HORIZON network, and
 * the network has no basis for issuing a warning about weather.
 *
 * Sources are recorded in docs/ASSET-SOURCES.md alongside the boundaries.
 */

import type { Dictionary } from "@/lib/i18n/vi";

export type ContextMetricKey = "temperature" | "humidity" | "wind" | "precipitation";

/**
 * Beaufort wind force, in km/h at 10 m — the WMO boundaries, collapsed to the
 * five bands that are distinguishable in one short phrase. Full-scale force
 * numbers are not printed: the number would suggest more precision than a
 * regional model grid cell delivers.
 *
 * Boundaries: B0 <1, B1 1–5, B2 6–11, B3 12–19, B4 20–28, B5 29–38,
 * B6 39–49, B7+ ≥50.
 */
function windBand(kph: number): keyof Dictionary["context"]["wind"] | null {
  if (!Number.isFinite(kph) || kph < 0) return null;
  if (kph < 1) return "calm";
  if (kph < 12) return "light";
  if (kph < 29) return "moderate";
  if (kph < 50) return "fresh";
  return "strong";
}

/**
 * Rainfall intensity, mm in the hour the reading covers. Open-Meteo's
 * `precipitation` for a `current` query is the accumulation over the current
 * hour, so mm/h boundaries apply directly.
 *
 * Boundaries: none 0, light <2.5, moderate 2.5–7.6, heavy 7.6–50,
 * violent ≥50.
 */
function rainBand(mm: number): keyof Dictionary["context"]["rain"] | null {
  if (!Number.isFinite(mm) || mm < 0) return null;
  if (mm === 0) return "none";
  if (mm < 2.5) return "light";
  if (mm < 7.6) return "moderate";
  if (mm < 50) return "heavy";
  return "violent";
}

/**
 * The context line for one regional reading, or null when this build has no
 * defensible basis for one.
 *
 * Returning null is the common case by design — see the note at the top.
 */
export function contextLine(
  key: ContextMetricKey,
  rawValue: string | number | null | undefined,
  dict: Dictionary,
): string | null {
  if (rawValue === null || rawValue === undefined) return null;
  const value = typeof rawValue === "number" ? rawValue : Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) return null;

  if (key === "wind") {
    const band = windBand(value);
    return band ? dict.context.wind[band] : null;
  }

  if (key === "precipitation") {
    const band = rainBand(value);
    return band ? dict.context.rain[band] : null;
  }

  // temperature / humidity — no single-variable published classification.
  return null;
}

/**
 * The context line for a device reading.
 *
 * Unlike weather, these DO have defined bands — the ones `statusFor` already
 * uses (BATTERY_V, SIGNAL_DBM in lib/monitoring/status.ts). This maps that
 * same resolved level to a word rather than re-deriving a second opinion from
 * the raw value, so the phrase and the box's status colour can never disagree.
 */
export function deviceContext(
  key: "signal" | "battery",
  level: "ok" | "watch" | "warn" | "critical" | null,
  dict: Dictionary,
): string | null {
  if (!level) return null;
  return dict.context[key][level];
}
