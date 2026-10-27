import type { ObservationPoint, ObservatoryMetric, TrendMetric } from "./types";
import type { QualityState } from "@/components/ui/status-indicator";
import type { ThresholdRow } from "./thresholdTypes";
import {
  assessMetric,
  DEFAULT_EXPECTED_INTERVAL_MS,
  resolveDisplay,
  type DisplayKey,
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
 * `MetricStatus.level` keeps its four tints; the new fields say WHY.
 *   green  -> "ok"       yellow -> "watch"      red -> "critical"      gray -> null (neutral)
 * Warning-severity exceedances now read as red (the 4-colour convention has no
 * orange); the wording ("alert threshold exceeded") is the same for both.
 */

export interface VerdictContext {
  rows: readonly ThresholdRow[];
  nowMs: number | null;
  stationQuality?: QualityState | null;
  isDemo?: boolean;
  series?: readonly ObservationPoint[];
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
    stationQuality: stationQualityOf(ctx.stationQuality),
    isDemo: ctx.isDemo,
    expectedIntervalMs: ctx.expectedIntervalMs,
    recent: value !== null && Number.isFinite(value) ? recentSamples(ctx.series, quantity, value, observedAt, ctx.expectedIntervalMs, ctx.confirmations ?? 2) : undefined,
    baseline: [], // no quality-vetted baseline is supplied to the browser yet -> anomaly stays INSUFFICIENT/NOT_EVALUATED
  });
  return { assessment, display: resolveDisplay(assessment) };
}

export type StatusWithReason = MetricStatus & { labelKey: DisplayKey };

export function toMetricStatus(v: MetricVerdict | null): StatusWithReason | null {
  if (!v) return null;
  const { tone, key } = v.display;
  if (tone === "green") return { level: "ok", basis: "configured", labelKey: key };
  if (tone === "yellow") return { level: "watch", basis: v.display.basis === "history" ? "pilot" : "configured", labelKey: key };
  if (tone === "red") return { level: "critical", basis: "configured", labelKey: key };
  return null;
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
 * - any red/yellow wins (worst first);
 * - otherwise a data problem in ANY metric keeps the region from being green;
 * - otherwise green only if something actually earned green.
 */
export function regionVerdict(verdicts: readonly (MetricVerdict | null)[]): RegionVerdict {
  const present = verdicts.filter((v): v is MetricVerdict => !!v);
  const red = present.find((v) => v.display.tone === "red");
  if (red) return { status: toMetricStatus(red), grayReason: null };
  const yellow = present.find((v) => v.display.tone === "yellow");
  if (yellow) return { status: toMetricStatus(yellow), grayReason: null };
  const problems = present.filter((v) => v.display.tone === "gray" && DATA_PROBLEM.has(v.display.key));
  if (problems.length > 0) {
    const reason = PROBLEM_ORDER.find((k) => problems.some((p) => p.display.key === k)) ?? problems[0].display.key;
    return { status: null, grayReason: reason };
  }
  const green = present.find((v) => v.display.tone === "green");
  return { status: green ? toMetricStatus(green) : null, grayReason: null };
}
