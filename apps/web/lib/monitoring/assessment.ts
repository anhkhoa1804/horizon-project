import { resolveSeverity, type ThresholdRow } from "./thresholdTypes";

/**
 * Four INDEPENDENT questions about one measurement. They are answered
 * separately and only combined at the very end, by `resolveDisplay`, under
 * rules that can only make the output more cautious:
 *
 *   1. freshness  - is the reading recent for THIS device's cadence?
 *   2. quality    - may the value be trusted at all?
 *   3. threshold  - where does it sit against a configured, sourced threshold?
 *   4. anomaly    - is it unusual against this station's own validated history?
 *
 * Absence of evidence is never a verdict. No threshold is "not configured",
 * not "safe"; null is "missing", not 0; a thin history is "insufficient",
 * not "normal". Statistical unusualness is NOT a threshold exceedance and is
 * never displayed as danger.
 */

// ---------------------------------------------------------------- 1. freshness

export type FreshnessLevel = "FRESH" | "STALE" | "OFFLINE" | "UNKNOWN";

/**
 * Expected time between two readings reaching the server from one station.
 * Derived, not guessed: stations sample every 60 s and sleep 60 s (runtime
 * config), but the gateway uploads in sessions (batch window 90 s, ~1 min of
 * modem time) and observed production gaps are ~2 min 38 s. 180 s therefore
 * means "one normal upload cycle". It is a parameter: change it when a
 * station's configured interval changes.
 */
export const DEFAULT_EXPECTED_INTERVAL_MS = 180_000;

export interface FreshnessInput {
  observedAt: string | null | undefined;
  nowMs: number;
  expectedIntervalMs?: number;
  /** Cycles tolerated before FRESH ends. 3 survives one failed upload session. */
  freshCycles?: number;
  /** Cycles after which the station is considered OFFLINE (no recent data). */
  offlineCycles?: number;
}

export function assessFreshness(input: FreshnessInput): { level: FreshnessLevel; ageMs: number | null } {
  const interval = input.expectedIntervalMs ?? DEFAULT_EXPECTED_INTERVAL_MS;
  const fresh = (input.freshCycles ?? 3) * interval;
  const offline = (input.offlineCycles ?? 20) * interval;
  const t = input.observedAt ? Date.parse(input.observedAt) : Number.NaN;
  if (!Number.isFinite(t) || !Number.isFinite(input.nowMs)) return { level: "UNKNOWN", ageMs: null };
  const age = input.nowMs - t;
  // A reading dated in the future means a bad clock somewhere; do not call it fresh.
  if (age < -2 * 60_000) return { level: "UNKNOWN", ageMs: age };
  if (age <= fresh) return { level: "FRESH", ageMs: Math.max(0, age) };
  if (age <= offline) return { level: "STALE", ageMs: age };
  return { level: "OFFLINE", ageMs: age };
}

// ------------------------------------------------------------------ 2. quality

export type QualityLevel = "VALID" | "SENSOR_FAULT" | "MISSING" | "SUSPECT" | "UNKNOWN";

export interface QualityInput {
  value: number | null | undefined;
  /** Station-level quality from fault evidence: valid | error | null (no evidence). */
  stationQuality?: "valid" | "estimated" | "error" | null;
  /** Metric-specific verdict when the sensor reports one (true = this sensor faulted). */
  sensorFault?: boolean | null;
  /** Physically possible range; outside it the reading is SUSPECT, not "extreme". */
  plausibleRange?: readonly [number, number] | null;
  isDemo?: boolean;
}

export function assessQuality(input: QualityInput): QualityLevel {
  // Null is a missing measurement, never zero.
  if (input.value === null || input.value === undefined || !Number.isFinite(input.value)) return "MISSING";
  if (input.isDemo) return "UNKNOWN";   // synthetic data proves nothing about an instrument
  if (input.sensorFault === true) return "SENSOR_FAULT";
  if (input.plausibleRange && (input.value < input.plausibleRange[0] || input.value > input.plausibleRange[1])) return "SUSPECT";
  if (input.stationQuality === "error" && input.sensorFault !== false) return "SENSOR_FAULT";
  if (input.stationQuality === "estimated") return "SUSPECT";
  if (input.sensorFault === false || input.stationQuality === "valid") return "VALID";
  return "UNKNOWN";
}

// ----------------------------------------------------------------- 3. threshold

export type ThresholdLevel =
  | "WITHIN_REFERENCE_THRESHOLD"
  | "APPROACHING_THRESHOLD"
  | "THRESHOLD_EXCEEDED"
  | "NOT_CONFIGURED"
  | "NOT_APPLICABLE";

export interface ThresholdAssessment {
  level: ThresholdLevel;
  /** Registry severity that fired (warning|critical for EXCEEDED, watch for APPROACHING). */
  severity: "watch" | "warning" | "critical" | null;
  /** True when the value is past a band but not yet confirmed by repeated samples. */
  pendingConfirmation: boolean;
  /** Why evaluation was skipped even though a threshold exists (freshness / quality). */
  blockedBy: "freshness" | "quality" | null;
  source: { title: string | null; version: string | null; scope: string | null } | null;
}

export interface ThresholdInput {
  quantity: string;
  value: number | null | undefined;
  rows: readonly ThresholdRow[];
  observedAt?: string | null;
  freshness: FreshnessLevel;
  quality: QualityLevel;
  /** False for quantities that have no threshold concept (e.g. external weather). */
  applicable?: boolean;
  /**
   * Most recent valid samples of the same quantity, oldest first, INCLUDING the
   * value being assessed as the last element. Used only to stop one noisy
   * sample from flipping a state.
   */
  recent?: readonly number[];
  /** Consecutive samples that must agree before EXCEEDED is declared. Default 2. */
  confirmations?: number;
}

/** Only rows an operator has activated AND a validation status that is allowed to colour anything. */
export function usableThresholdRows(rows: readonly ThresholdRow[], observedAt?: string | null): ThresholdRow[] {
  return rows.filter(
    (row) =>
      row.is_active &&
      ["OPERATIONAL", "SITE_VALIDATED"].includes(row.validation_status) &&
      !["SENSOR_QUALITY", "DEVICE_HEALTH"].includes(row.basis) &&
      (!row.effective_from || (!!observedAt && Date.parse(row.effective_from) <= Date.parse(observedAt))),
  );
}

const rankOf = (s: string) => (s === "critical" ? 3 : s === "warning" ? 2 : s === "watch" ? 1 : 0);

export function assessThreshold(input: ThresholdInput): ThresholdAssessment {
  const base = { severity: null, pendingConfirmation: false, blockedBy: null, source: null } as const;
  if (input.applicable === false) return { ...base, level: "NOT_APPLICABLE" };

  const rows = usableThresholdRows(input.rows, input.observedAt).filter((r) => r.quantity === input.quantity);
  if (rows.length === 0) return { ...base, level: "NOT_CONFIGURED" };

  // A threshold exists, but a stale or untrusted value may not be compared to it.
  if (input.freshness !== "FRESH") return { ...base, level: "NOT_APPLICABLE", blockedBy: "freshness" };
  if (input.quality !== "VALID") return { ...base, level: "NOT_APPLICABLE", blockedBy: "quality" };
  if (input.value === null || input.value === undefined || !Number.isFinite(input.value)) return { ...base, level: "NOT_APPLICABLE", blockedBy: "quality" };

  const need = Math.max(1, input.confirmations ?? 2);
  const severityOf = (v: number) => resolveSeverity(rows as ThresholdRow[], input.quantity, v);
  const hit = severityOf(input.value);
  const source = hit ? { title: hit.row.source_title ?? null, version: hit.row.effective_from ?? null, scope: hit.row.scope ?? null } : null;

  if (!hit || hit.severity === "normal" || hit.severity === "low_confidence") {
    // Inside the configured bands. Not "safe": merely not past a sourced line.
    return { ...base, level: "WITHIN_REFERENCE_THRESHOLD", source };
  }
  if (hit.severity === "watch") return { ...base, level: "APPROACHING_THRESHOLD", severity: "watch", source };

  // warning / critical: require repeated agreement so a single noisy sample cannot raise an alarm.
  const window = (input.recent ?? [input.value]).filter((v) => Number.isFinite(v)).slice(-need);
  const confirmed =
    window.length >= need && window.every((v) => { const r = severityOf(v); return !!r && rankOf(r.severity) >= 2; });
  if (!confirmed) return { ...base, level: "APPROACHING_THRESHOLD", severity: hit.severity, pendingConfirmation: true, source };
  return { ...base, level: "THRESHOLD_EXCEEDED", severity: hit.severity, source };
}

// ------------------------------------------------------------------ 4. anomaly

export type AnomalyLevel = "WITHIN_HISTORICAL_VARIATION" | "STATISTICALLY_UNUSUAL" | "INSUFFICIENT_BASELINE" | "NOT_EVALUATED";

export interface BaselineSample {
  /** Epoch ms of the observation. */
  t: number;
  value: number | null;
  /** Must be TRUE only when the sample passed quality checks. Unknown quality = false. */
  valid: boolean;
  isDemo?: boolean;
}

export interface AnomalyPolicy {
  /** False for metrics whose natural variation this method cannot model (tides, rainfall...). */
  evaluate: boolean;
  /** Compare only against samples from the same hour of day (Asia/Ho_Chi_Minh). */
  diurnal?: boolean;
  minSamples?: number;
  minCoverageMs?: number;
  /** Smallest spread (in the quantity's own unit) a history may be treated as having. */
  minScale?: number;
  /** |robust z| at or above this is "unusual". 3.5 is the Iglewicz-Hoaglin convention. */
  zThreshold?: number;
}

export interface AnomalyInput {
  value: number | null | undefined;
  observedAtMs: number;
  baseline: readonly BaselineSample[];
  policy: AnomalyPolicy;
  /** Last assessed values (oldest first, incl. current) for the confirmation rule. */
  recent?: readonly number[];
  confirmations?: number;
}

export interface AnomalyAssessment {
  level: AnomalyLevel;
  /** Robust z of the current value (signed: negative = below the usual range). */
  robustZ: number | null;
  /**
   * The z that survived the confirmation rule: the smallest-magnitude z among the
   * last `confirmations` samples, and 0 unless all of them lie on the same side.
   * This - not `robustZ` - decides colour, so one noisy sample cannot tint a box.
   */
  confirmedZ: number | null;
  median: number | null;
  samples: number;
  coverageMs: number;
  reason: "ok" | "policy" | "no_value" | "too_few_samples" | "short_coverage" | "zero_variance" | "unconfirmed";
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const DEFAULT_MIN_SAMPLES = 14;
export const DEFAULT_MIN_COVERAGE_MS = 14 * DAY_MS;
/** |confirmed z| thresholds for the two colour strengths. Wider than the textbook 2 / 3.5 because site data barely moves. */
export const Z_NOTABLE = 3;
export const Z_OUTLIER = 5;
/** Even a perfectly flat history is allowed this much natural spread (5 % of the median), so noise cannot colour a box. */
export const MIN_RELATIVE_SCALE = 0.05;

function median(sorted: number[]): number {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
function hourOfDayVn(t: number): number {
  return Math.floor((((t + 7 * HOUR_MS) % DAY_MS) + DAY_MS) % DAY_MS / HOUR_MS);
}

/**
 * Robust z-score against the station's own validated history: median and MAD
 * (scaled 1.4826), IQR as the fallback when MAD is zero. Rules that keep it
 * honest:
 *  - only samples that are valid, finite, non-demo and strictly BEFORE the
 *    observation (no future leakage);
 *  - minimum sample count AND minimum time coverage, else INSUFFICIENT_BASELINE;
 *  - optional same-hour-of-day stratification for diurnal quantities, with the
 *    same minimums applied to the stratum;
 *  - a zero-variance history cannot say anything, so it is INSUFFICIENT;
 *  - metrics the method cannot model are NOT_EVALUATED by policy.
 * Seasonality beyond the day, tides and rainfall events are NOT modelled; the
 * UI says "so với dữ liệu trước đây", never "bất thường nguy hiểm".
 */
export function assessAnomaly(input: AnomalyInput): AnomalyAssessment {
  const none = (level: AnomalyLevel, reason: AnomalyAssessment["reason"], samples = 0, coverageMs = 0): AnomalyAssessment =>
    ({ level, reason, robustZ: null, confirmedZ: null, median: null, samples, coverageMs });
  if (!input.policy.evaluate) return none("NOT_EVALUATED", "policy");
  if (input.value === null || input.value === undefined || !Number.isFinite(input.value)) return none("NOT_EVALUATED", "no_value");

  const minSamples = input.policy.minSamples ?? DEFAULT_MIN_SAMPLES;
  const minCoverage = input.policy.minCoverageMs ?? DEFAULT_MIN_COVERAGE_MS;
  const z = input.policy.zThreshold ?? Z_OUTLIER;
  const hour = hourOfDayVn(input.observedAtMs);

  const eligible = input.baseline.filter(
    (s) => s.valid && !s.isDemo && s.value !== null && Number.isFinite(s.value) && s.t < input.observedAtMs &&
      (!input.policy.diurnal || hourOfDayVn(s.t) === hour),
  );
  if (eligible.length === 0) return none("INSUFFICIENT_BASELINE", "too_few_samples");
  const times = eligible.map((s) => s.t);
  const coverage = Math.max(...times) - Math.min(...times);
  if (eligible.length < minSamples) return none("INSUFFICIENT_BASELINE", "too_few_samples", eligible.length, coverage);
  if (coverage < minCoverage) return none("INSUFFICIENT_BASELINE", "short_coverage", eligible.length, coverage);

  const values = eligible.map((s) => s.value as number).sort((a, b) => a - b);
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  let scale = 1.4826 * mad;
  if (scale === 0) {
    const q1 = median(values.slice(0, Math.floor(values.length / 2)));
    const q3 = median(values.slice(Math.ceil(values.length / 2)));
    scale = (q3 - q1) / 1.349;
  }
  // Floor the spread: a station whose history is nearly flat would otherwise turn every tiny change into a huge z.
  scale = Math.max(scale, input.policy.minScale ?? 0, MIN_RELATIVE_SCALE * Math.abs(med));
  if (!(scale > 0)) return { ...none("INSUFFICIENT_BASELINE", "zero_variance", eligible.length, coverage), median: med };

  const score = (input.value - med) / scale;
  const need = Math.max(1, input.confirmations ?? 2);
  const window = (input.recent ?? [input.value]).filter((v) => Number.isFinite(v)).slice(-need);
  const zs = window.map((v) => (v - med) / scale);
  const sameSide = zs.length >= need && (zs.every((v) => v > 0) || zs.every((v) => v < 0));
  // Smallest magnitude on the shared side; 0 when the window disagrees or is too short.
  const confirmed = sameSide ? zs.reduce((m, v) => (Math.abs(v) < Math.abs(m) ? v : m), zs[0]) : 0;
  const unusual = Math.abs(confirmed) >= z;
  const base = { robustZ: score, confirmedZ: confirmed, median: med, samples: eligible.length, coverageMs: coverage };
  if (Math.abs(score) >= z && !unusual) return { level: "WITHIN_HISTORICAL_VARIATION", reason: "unconfirmed", ...base };
  return { level: unusual ? "STATISTICALLY_UNUSUAL" : "WITHIN_HISTORICAL_VARIATION", reason: "ok", ...base };
}

/**
 * Which metrics are compared with history, and how.
 *
 * The browser receives DAILY buckets (see seriesFromDaily), so the baseline is
 * "the distribution of previous days", not of raw samples: 14 days and 14 days of
 * coverage are the floor, and diurnal stratification is impossible. Water level and
 * salinity follow the tide; comparing today's reading with daily means is therefore
 * only an indication of where the value sits, and the UI says so (notes.tidal).
 * Rainfall is event-driven, not distributional, and is left out.
 */
export const ANOMALY_POLICY: Record<string, AnomalyPolicy> = {
  water_level: { evaluate: true, minScale: 5 },      // cm
  water_salinity: { evaluate: true, minScale: 0.05 }, // per mille
  water_ec: { evaluate: true, minScale: 0.1 },        // mS/cm
  water_temp: { evaluate: true, minScale: 1 },        // deg C
  soil_moisture: { evaluate: true, minScale: 3 },     // %
  soil_temp: { evaluate: true, minScale: 1 },
  soil_ec_bulk: { evaluate: true, minScale: 0.05 },   // mS/cm
  soil_ph: { evaluate: true, minScale: 0.15 },
  air_temp: { evaluate: true, minScale: 1.5 },
  air_humidity: { evaluate: true, minScale: 5 },
};

/** Quantities whose natural variation is tidal: history is shown, with a caveat. */
export const TIDAL_QUANTITIES: ReadonlySet<string> = new Set(["water_level", "water_salinity", "water_ec"]);

// ---------------------------------------------------------------- combination

export interface MetricAssessment {
  freshness: FreshnessLevel;
  quality: QualityLevel;
  threshold: ThresholdAssessment;
  anomaly: AnomalyAssessment;
}

/**
 * green = lower than this station's usual range     (diverging scale: green - white - red)
 * white = inside the usual range / inside a configured reference band
 * red   = higher than usual, OR a configured alert threshold exceeded/approached
 * gray  = no basis: old or missing data, fault, nothing to compare with
 *
 * `strength` 1 = notable (|z| >= 2), 2 = outlier (|z| >= 3.5) or a confirmed threshold exceedance.
 */
export type DisplayTone = "green" | "white" | "red" | "gray";
export type DisplayKey =
  | "withinReference"
  | "approachingThreshold"
  | "confirming"
  | "thresholdExceeded"
  | "lowerThanUsual"
  | "higherThanUsual"
  | "unusuallyLow"
  | "unusuallyHigh"
  | "withinHistoricalRange"
  | "stale"
  | "offline"
  | "unknownFreshness"
  | "sensorFault"
  | "missing"
  | "suspect"
  | "unknownQuality"
  | "noThreshold"
  | "insufficient";

export interface DisplayVerdict {
  tone: DisplayTone;
  key: DisplayKey;
  /** What justified the colour. */
  basis: "threshold" | "history" | "none";
  strength: 0 | 1 | 2;
}

/**
 * Precedence, each step only ever more cautious than the next:
 *  1. Old / missing / faulty / unvetted data is gray, whatever the number says.
 *  2. A configured, sourced threshold that is exceeded (and confirmed) is red - always.
 *     Approaching one is a light red. Thresholds and their sources are unchanged.
 *  3. Otherwise colour is the position against the station's own history:
 *     |z| >= 3.5 strong, |z| >= 2 light, green below / red above, white inside.
 *  4. No usable history: inside a configured band is white; anything else is gray.
 * Position against history is not a statement about safety, and the labels never say it is.
 */
export function resolveDisplay(a: MetricAssessment): DisplayVerdict {
  const gray = (key: DisplayKey): DisplayVerdict => ({ tone: "gray", key, basis: "none", strength: 0 });
  if (a.freshness === "OFFLINE") return gray("offline");
  if (a.freshness === "STALE") return gray("stale");
  if (a.freshness === "UNKNOWN") return gray("unknownFreshness");
  if (a.quality === "MISSING") return gray("missing");
  if (a.quality === "SENSOR_FAULT") return gray("sensorFault");
  if (a.quality === "SUSPECT") return gray("suspect");
  if (a.quality === "UNKNOWN") return gray("unknownQuality");

  const t = a.threshold;
  if (t.level === "THRESHOLD_EXCEEDED") return { tone: "red", key: "thresholdExceeded", basis: "threshold", strength: 2 };
  if (t.level === "APPROACHING_THRESHOLD") return { tone: "red", key: t.pendingConfirmation ? "confirming" : "approachingThreshold", basis: "threshold", strength: 1 };

  const z = a.anomaly.confirmedZ;
  const usable = a.anomaly.reason === "ok" || a.anomaly.reason === "unconfirmed";
  if (usable && z !== null) {
    const mag = Math.abs(z);
    if (mag >= Z_OUTLIER) return { tone: z < 0 ? "green" : "red", key: z < 0 ? "unusuallyLow" : "unusuallyHigh", basis: "history", strength: 2 };
    if (mag >= Z_NOTABLE) return { tone: z < 0 ? "green" : "red", key: z < 0 ? "lowerThanUsual" : "higherThanUsual", basis: "history", strength: 1 };
    return { tone: "white", key: "withinHistoricalRange", basis: "history", strength: 0 };
  }
  if (t.level === "WITHIN_REFERENCE_THRESHOLD") return { tone: "white", key: "withinReference", basis: "threshold", strength: 0 };
  if (t.level === "NOT_CONFIGURED") return gray("noThreshold");
  return gray("insufficient");
}

/** Convenience: assess one metric end to end. */
export function assessMetric(input: {
  quantity: string;
  value: number | null | undefined;
  observedAt: string | null | undefined;
  nowMs: number;
  rows: readonly ThresholdRow[];
  stationQuality?: QualityInput["stationQuality"];
  sensorFault?: boolean | null;
  plausibleRange?: readonly [number, number] | null;
  isDemo?: boolean;
  expectedIntervalMs?: number;
  thresholdApplicable?: boolean;
  recent?: readonly number[];
  baseline?: readonly BaselineSample[];
}): MetricAssessment {
  const { level: freshness } = assessFreshness({ observedAt: input.observedAt, nowMs: input.nowMs, expectedIntervalMs: input.expectedIntervalMs });
  const quality = assessQuality({ value: input.value, stationQuality: input.stationQuality, sensorFault: input.sensorFault, plausibleRange: input.plausibleRange, isDemo: input.isDemo });
  const threshold = assessThreshold({
    quantity: input.quantity, value: input.value, rows: input.rows, observedAt: input.observedAt,
    freshness, quality, applicable: input.thresholdApplicable, recent: input.recent,
  });
  const observedAtMs = input.observedAt ? Date.parse(input.observedAt) : Number.NaN;
  const policy = ANOMALY_POLICY[input.quantity] ?? { evaluate: false };
  const anomaly = Number.isFinite(observedAtMs) && freshness === "FRESH" && quality === "VALID"
    ? assessAnomaly({ value: input.value, observedAtMs, baseline: input.baseline ?? [], policy, recent: input.recent })
    : ({ level: "NOT_EVALUATED", reason: "no_value", robustZ: null, confirmedZ: null, median: null, samples: 0, coverageMs: 0 } as AnomalyAssessment);
  return { freshness, quality, threshold, anomaly };
}
