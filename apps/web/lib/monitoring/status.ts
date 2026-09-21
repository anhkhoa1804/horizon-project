import type { MetricLabelKey } from "./types";

/**
 * Status colour for a measurement — and, just as importantly, the reason it
 * is allowed to have one.
 *
 * THE HONESTY CONSTRAINT.
 *
 * Colouring a value red says "this reading is bad". That is a claim, and
 * HORIZON can only make it where a threshold actually exists. Today the
 * system has exactly two kinds of basis:
 *
 *   "configured" — crop_thresholds, the project's own salinity warning and
 *                  critical levels. A real operational setting, set by the
 *                  team, and already disclosed as such in the Reference panel.
 *   "device"     — a hardware operating spec. A LiPo cell at 3.4 V really is
 *                  nearly flat and a link at −95 dBm really is failing;
 *                  these are datasheet facts about the equipment, not
 *                  environmental judgements about Cồn Hô.
 *
 * Everything else — air temperature, humidity, soil pH, soil EC, soil
 * moisture — has NO basis in this system. `crop_thresholds` carries only
 * salinity, and the project has explicitly declined to publish agronomic
 * bands for Cồn Hô it cannot source (see lib/monitoring/reference.ts). Those
 * metrics therefore return `null` and render neutral, however tempting a red
 * "too hot" chip would look. Inventing the band to light the pixel is
 * precisely the dishonesty this codebase keeps refusing.
 *
 * Demo mode is the exception, and legitimately so: its data is synthetic and
 * labelled as such everywhere it appears, so it may exercise the full palette
 * to show what the design does once thresholds are configured.
 */

export type StatusLevel = "ok" | "watch" | "warn" | "critical";
export type StatusBasis = "configured" | "device" | "reference" | "pilot" | "quality" | "demo";

export interface MetricStatus {
  level: StatusLevel;
  basis: StatusBasis;
}

/** The project's configured salinity thresholds, when a crop row exists. */
export interface SalinityThreshold {
  warningLevel: number;
  criticalLevel: number;
}

/**
 * Device operating bands. These describe the hardware, not the environment.
 * Values chosen to match the limits already stated elsewhere in the product:
 * the demo alert copy calls a link "weak" below −85 dBm, and the ESP32 nodes
 * run from a single Li-ion cell whose usable floor is ~3.5 V.
 */
const BATTERY_V = { critical: 3.4, warn: 3.6, watch: 3.8 };
const SIGNAL_DBM = { critical: -100, warn: -95, watch: -85 };

/**
 * Resolves a status for one reading, or null when this build has no
 * defensible basis for judging it.
 *
 * `value` is the parsed numeric reading. Callers pass the raw model string
 * through Number() — a non-finite result yields null rather than a guess.
 */
export function statusFor(
  labelKey: MetricLabelKey | undefined,
  value: number | null,
  options: { salinity?: SalinityThreshold | null; isDemo?: boolean } = {},
): MetricStatus | null {
  if (value === null || !Number.isFinite(value) || !labelKey) return null;

  const basis: StatusBasis = options.isDemo ? "demo" : "configured";

  if (labelKey === "salinity") {
    const t = options.salinity;
    // No configured threshold means no opinion. The Reference panel already
    // tells the reader that none is set; a green chip here would contradict it.
    if (!t) return null;
    if (value >= t.criticalLevel) return { level: "critical", basis };
    if (value >= t.warningLevel) return { level: "warn", basis };
    // Within the configured safe range — genuinely informative, so it earns
    // the green rather than staying neutral.
    if (value >= t.warningLevel * 0.75) return { level: "watch", basis };
    return { level: "ok", basis };
  }

  if (labelKey === "battery") {
    const b: StatusBasis = options.isDemo ? "demo" : "device";
    if (value <= BATTERY_V.critical) return { level: "critical", basis: b };
    if (value <= BATTERY_V.warn) return { level: "warn", basis: b };
    if (value <= BATTERY_V.watch) return { level: "watch", basis: b };
    return { level: "ok", basis: b };
  }

  if (labelKey === "signal") {
    const b: StatusBasis = options.isDemo ? "demo" : "device";
    if (value <= SIGNAL_DBM.critical) return { level: "critical", basis: b };
    if (value <= SIGNAL_DBM.warn) return { level: "warn", basis: b };
    if (value <= SIGNAL_DBM.watch) return { level: "watch", basis: b };
    return { level: "ok", basis: b };
  }

  // moisture / ec / ph / temperature / humidity / wind / precipitation:
  // measurable, but this system has no sourced band for them. Neutral.
  return null;
}

/**
 * Tailwind classes per level, for the tile's accent rail and value colour.
 *
 * Deliberately restrained: a thin rail plus a coloured numeral, never a
 * fully saturated card. A wall of red tiles reads as a broken system rather
 * than as one reading needing attention.
 *
 * Three colours, not four: `watch` and `warn` are adjacent points on the
 * same "elevated" band (the salinity model uses `watch` for "inside the
 * configured range but worth noticing," `warn` for "past the warning
 * level"), and giving them their own hue each — the previous build used
 * accent blue for `watch` — read as a fourth, unrelated status rather than
 * two intensities of the same one. A reader should be able to hold the
 * whole vocabulary in their head as normal / elevated / critical.
 */
export const STATUS_RAIL: Record<StatusLevel, string> = {
  ok: "bg-healthy",
  watch: "bg-watch",
  warn: "bg-watch",
  critical: "bg-risk",
};

export const STATUS_TEXT: Record<StatusLevel, string> = {
  ok: "text-healthy",
  watch: "text-watch",
  warn: "text-watch",
  critical: "text-risk",
};

/**
 * The tinted-surface counterpart to STATUS_RAIL/STATUS_TEXT — a status a
 * reader can see without reading.
 *
 * These use the region-scale `--h-status-*` tokens, NOT the `-bg` chip
 * tints: a badge-strength tint stretched across a whole Bento region stops
 * registering as status at all. See the note beside those tokens in
 * globals.css for why they are a separate scale rather than the same values
 * at higher alpha.
 *
 * Applied to a REGION, never to individual values inside one. A parent
 * surface tinted amber with two green patches inside it gives a reader two
 * competing answers to "is this fine?" — so a multi-value region resolves a
 * single status with worstStatus() below and tints once.
 */
export const STATUS_SURFACE: Record<StatusLevel, string> = {
  ok: "bg-status-normal",
  watch: "bg-status-warning",
  warn: "bg-status-warning",
  critical: "bg-status-critical",
};

/** Severity order, worst last — the comparison worstStatus() ranks against. */
const SEVERITY: StatusLevel[] = ["ok", "watch", "warn", "critical"];

/**
 * The status a region takes when it holds several readings: the worst one
 * present. A box showing a healthy signal beside a nearly-flat battery is
 * not a healthy box, and colouring it green because one of its two values
 * is fine would be the same kind of dishonesty statusFor() exists to
 * refuse — just at region scale.
 *
 * Returns null when nothing in the region has a defensible status at all,
 * which is the common case in real mode and renders neutral.
 */
export function worstStatus(statuses: (MetricStatus | null | undefined)[]): MetricStatus | null {
  let worst: MetricStatus | null = null;
  for (const status of statuses) {
    if (!status) continue;
    if (!worst || SEVERITY.indexOf(status.level) > SEVERITY.indexOf(worst.level)) worst = status;
  }
  return worst;
}
