import type { ObservationPoint, ObservatoryMetric, TrendMetric } from "./types";
import type { QualityState } from "@/components/ui/status-indicator";
import type { ThresholdRow } from "./thresholdTypes";
import {
  assessMetric,
  DEFAULT_EXPECTED_INTERVAL_MS,
  resolveDisplay,
  type BaselineSample,
  type DisplayKey,
  type DisplayTone,
  type DisplayVerdict,
  type MetricAssessment,
} from "./assessment";
import type { MetricStatus } from "./status";

/**
 * Glue between the pure assessment layers and the canvas.
 *
 * Everything here is deterministic given (metric, rows, nowMs, series), so it
 * is unit-tested without React. The canvas only decides WHEN `nowMs` is known.
 *
 * Colour is a diverging scale over the station's own history (green - white - red),
 * with configured, sourced thresholds always winning as red. See assessment.ts.
 */

/**
 * How often a quantity is expected to change enough to matter. Freshness is
 * FRESH for 3 such cycles. Soil probes at 20-30 cm depth are slow and stable,
 * so a soil reading stays valid for 24 h (8 h x 3) before it is called old;
 * everything else keeps the 3-minute upload cadence (about 9 min).
 */
export const SOIL_EXPECTED_INTERVAL_MS = 8 * 60 * 60_000;
export function expectedIntervalFor(quantity: string): number {
  return quantity.startsWith("soil_") ? SOIL_EXPECTED_INTERVAL_MS : DEFAULT_EXPECTED_INTERVAL_MS;
}

export interface VerdictContext {
  rows: readonly ThresholdRow[];
  nowMs: number | null;
  stationQuality?: QualityState | null;
  isDemo?: boolean;
  /** Recent raw points (24 h) - used only to confirm a colour with consecutive samples. */
  series?: readonly ObservationPoint[];
  /** Daily history (year, else 30 d) - the distribution a reading is compared with. */
  history?: readonly ObservationPoint[];
  /** Raw fault bitmask of the station's latest packet; soil metrics read only their own bit. */
  faultFlags?: number | null;
  expectedIntervalMs?: number;
  /** Consecutive agreeing samples before red. */
  confirmations?: number;
}

export interface MetricVerdict {
  assessment: MetricAssessment;
  display: DisplayVerdict;
}

/** Registry quantity -> trend-series key (only quantities the series carries). */
const SERIES_KEY: Record<string, TrendMetric> = {
  water_salinity: "salinity",
  water_level: "waterLevel",
  soil_moisture: "soilMoisture",
  soil_temp: "soilTemp",
  soil_ec_bulk: "soilEc",
  soil_ph: "soilPh",
};

const stationQualityOf = (q: QualityState | null | undefined) => (q === "valid" || q === "error" ? q : q === "estimated" ? "estimated" : null);

/**
 * Earlier samples of the same quantity that may back a confirmation: finite,
 * chronologically before the current observation, and no older than the
 * freshness window (otherwise "two in a row" would span a gap).
 */
export function recentSamples(
  series: readonly ObservationPoint[] | undefined,
  quantity: string,
  current: number,
  observedAt: string | null | undefined,
  expectedIntervalMs = DEFAULT_EXPECTED_INTERVAL_MS,
  keep = 2,
): number[] {
  const key = SERIES_KEY[quantity];
  const obs = observedAt ? Date.parse(observedAt) : Number.NaN;
  if (!key || !series || !Number.isFinite(obs)) return [current];
  const horizon = 3 * expectedIntervalMs;
  const earlier = series
    .filter((p) => {
      const t = p.timestamp ? Date.parse(p.timestamp) : Number.NaN;
      const v = p[key];
      return Number.isFinite(t) && t < obs && obs - t <= horizon && typeof v === "number" && Number.isFinite(v);
    })
    .sort((a, b) => Date.parse(a.timestamp as string) - Date.parse(b.timestamp as string))
    .map((p) => p[key] as number)
    .slice(-Math.max(0, keep - 1));
  return [...earlier, current];
}

/**
 * Baseline = the station's previous DAILY values (the browser is only sent daily
 * buckets for history). The series carries no per-sample quality flag, so a null
 * (no value that day) is the only exclusion; the last 24 h are dropped so today's
 * partial bucket, which contains the reading being judged, never judges itself.
 */
export function baselineFromSeries(
  series: readonly ObservationPoint[] | undefined,
  quantity: string,
  observedAt: string | null | undefined,
): BaselineSample[] {
  const key = SERIES_KEY[quantity];
  const obs = observedAt ? Date.parse(observedAt) : Number.NaN;
  if (!key || !series || !Number.isFinite(obs)) return [];
  const out: BaselineSample[] = [];
  for (const p of series) {
    const t = p.timestamp ? Date.parse(p.timestamp) : Number.NaN;
    const v = p[key];
    if (!Number.isFinite(t) || t > obs - 24 * 3_600_000 || typeof v !== "number" || !Number.isFinite(v)) continue;
    out.push({ t, value: v, valid: true });
  }
  return out;
}

/**
 * The soil node sets one bit per field it could not read (see simple_telemetry.h): air temperature 1,
 * air humidity 2, soil temperature 4, moisture 8, bulk EC 16, salinity 32, TDS 64, pH 128. A box must
 * only be called faulty for ITS OWN bit: a missing salinity or TDS field (not shown on the site) used to
 * mark every soil reading "sensor fault" although each displayed value had arrived.
 */
export const SOIL_FAULT_BIT: Readonly<Record<string, number>> = {
  air_temp: 1, air_humidity: 2, soil_temp: 4, soil_moisture: 8, soil_ec_bulk: 16, soil_ph: 128,
};

function qualityContext(quantity: string, ctx: VerdictContext): QualityState | null | undefined {
  const bit = SOIL_FAULT_BIT[quantity];
  if (bit !== undefined && typeof ctx.faultFlags === "number" && Number.isFinite(ctx.faultFlags)) {
    return (ctx.faultFlags & bit) !== 0 ? "error" : "valid";
  }
  return ctx.stationQuality;
}

/**
 * Verdict for one metric, or null when assessment does not apply at all:
 * external context (no station behind it), absent metrics, and the pre-mount
 * render where the current time is not known yet (rendering neutral beats
 * guessing freshness on the server).
 */
export function verdictFor(
  metric: ObservatoryMetric | null | undefined,
  quantity: string,
  ctx: VerdictContext,
): MetricVerdict | null {
  if (!metric || ctx.nowMs === null) return null;
  if (metric.provenance.origin === "external" || metric.provenance.origin === "reference") return null;
  const value = metric.value === null ? null : Number(metric.value);
  const observedAt = metric.provenance.observedAt ?? null;
  const assessment = assessMetric({
    quantity,
    value,
    observedAt,
    nowMs: ctx.nowMs,
    rows: ctx.rows,
    stationQuality: stationQualityOf(qualityContext(quantity, ctx)),
    isDemo: ctx.isDemo,
    expectedIntervalMs: ctx.expectedIntervalMs ?? expectedIntervalFor(quantity),
    recent: value !== null && Number.isFinite(value) ? recentSamples(ctx.series, quantity, value, observedAt, ctx.expectedIntervalMs ?? expectedIntervalFor(quantity), ctx.confirmations ?? 2) : undefined,
    baseline: baselineFromSeries(ctx.history, quantity, observedAt),
  });
  return { assessment, display: resolveDisplay(assessment) };
}

export type StatusWithReason = MetricStatus & { labelKey: DisplayKey; tone: DisplayTone; strength: 0 | 1 | 2 };

/**
 * `level` only picks the icon and keeps older callers working; the surface colour
 * comes from `tone` + `strength` (data-tone / data-strength in the canvas).
 * Gray yields null: a neutral box that prints its reason instead.
 */
export function toMetricStatus(v: MetricVerdict | null): StatusWithReason | null {
  if (!v) return null;
  const { tone, key, strength } = v.display;
  if (tone === "gray") return null;
  const basis = v.display.basis === "history" ? "pilot" : "configured";
  if (tone === "white") return { level: "ok", basis, labelKey: key, tone, strength };
  if (tone === "green") return { level: "watch", basis, labelKey: key, tone, strength };
  return { level: strength === 2 ? "critical" : "warn", basis, labelKey: key, tone, strength };
}

/** Gray reasons that mean "the data cannot be trusted right now" (as opposed to "nothing to compare with"). */
const DATA_PROBLEM: ReadonlySet<DisplayKey> = new Set<DisplayKey>([
  "stale", "offline", "unknownFreshness", "sensorFault", "suspect", "unknownQuality",
]);
const PROBLEM_ORDER: DisplayKey[] = ["offline", "stale", "sensorFault", "suspect", "unknownFreshness", "unknownQuality"];

export interface RegionVerdict {
  status: StatusWithReason | null;
  /** Reason shown when the region is neutral because of a data problem. */
  grayReason: DisplayKey | null;
}

/**
 * One status per region, from the metrics it holds.
 * - a tinted metric wins: higher strength first, red before green on a tie;
 * - otherwise a data problem in ANY metric is shown (old data, fault ...);
 * - otherwise white if something is inside its usual range; else neutral.
 */
export function regionVerdict(verdicts: readonly (MetricVerdict | null)[]): RegionVerdict {
  const present = verdicts.filter((v): v is MetricVerdict => !!v);
  const tinted = present
    .filter((v) => v.display.tone === "red" || v.display.tone === "green")
    .sort((a, b) => b.display.strength - a.display.strength || (a.display.tone === "red" ? -1 : 1) - (b.display.tone === "red" ? -1 : 1));
  if (tinted.length > 0) return { status: toMetricStatus(tinted[0]), grayReason: null };
  const problems = present.filter((v) => v.display.tone === "gray" && DATA_PROBLEM.has(v.display.key));
  if (problems.length > 0) {
    const reason = PROBLEM_ORDER.find((k) => problems.some((p) => p.display.key === k)) ?? problems[0].display.key;
    return { status: null, grayReason: reason };
  }
  const white = present.find((v) => v.display.tone === "white");
  return { status: white ? toMetricStatus(white) : null, grayReason: null };
}
