import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANOMALY_POLICY, assessAnomaly, assessFreshness, assessMetric, assessQuality, assessThreshold,
  resolveDisplay, usableThresholdRows, type BaselineSample, type MetricAssessment,
} from "@/lib/monitoring/assessment";
import type { ThresholdRow } from "@/lib/monitoring/thresholdTypes";

const NOW = Date.parse("2026-10-27T05:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

const row = (over: Partial<ThresholdRow>): ThresholdRow => ({
  id: "r", metric_key: "k", quantity: "water_salinity", unit: "ppt", threshold_value: 2, upper_value: null,
  comparison: "above", severity: "warning", basis: "SITE_CALIBRATED", source_title: "Project config", source_url: null,
  source_locator: null, scope: "STATION_01", validation_status: "OPERATIONAL", is_active: true, notes: null, effective_from: null, ...over,
});
const salinityRows = [row({ threshold_value: 1.5, severity: "watch" }), row({ threshold_value: 2, severity: "warning" }), row({ id: "c", threshold_value: 3, severity: "critical" })];

function baseline(n: number, spanMs: number, value = (i: number) => 10 + (i % 5) * 0.2, valid = true): BaselineSample[] {
  return Array.from({ length: n }, (_, i) => ({ t: NOW - spanMs + (i * spanMs) / n - 1000, value: value(i), valid }));
}

describe("freshness follows the device cadence, not a fixed 5 minutes", () => {
  it("is FRESH through one missed upload cycle and one failed session", () => {
    assert.equal(assessFreshness({ observedAt: iso(158_000), nowMs: NOW }).level, "FRESH");   // observed cycle
    assert.equal(assessFreshness({ observedAt: iso(8 * MIN), nowMs: NOW }).level, "FRESH");   // 3 x 180 s = 9 min
  });
  it("turns STALE then OFFLINE only after many missed cycles", () => {
    assert.equal(assessFreshness({ observedAt: iso(20 * MIN), nowMs: NOW }).level, "STALE");
    assert.equal(assessFreshness({ observedAt: iso(61 * MIN), nowMs: NOW }).level, "OFFLINE");
  });
  it("honours a different configured interval", () => {
    assert.equal(assessFreshness({ observedAt: iso(40 * MIN), nowMs: NOW, expectedIntervalMs: 30 * MIN }).level, "FRESH");
  });
  it("never calls missing or future timestamps fresh", () => {
    assert.equal(assessFreshness({ observedAt: null, nowMs: NOW }).level, "UNKNOWN");
    assert.equal(assessFreshness({ observedAt: "garbage", nowMs: NOW }).level, "UNKNOWN");
    assert.equal(assessFreshness({ observedAt: iso(-30 * MIN), nowMs: NOW }).level, "UNKNOWN");
  });
});

describe("quality", () => {
  it("treats null as MISSING and never as 0", () => {
    assert.equal(assessQuality({ value: null }), "MISSING");
    assert.equal(assessQuality({ value: Number.NaN }), "MISSING");
    assert.equal(assessQuality({ value: undefined, stationQuality: "valid" }), "MISSING");
  });
  it("needs evidence to be VALID", () => {
    assert.equal(assessQuality({ value: 1.2 }), "UNKNOWN");
    assert.equal(assessQuality({ value: 1.2, stationQuality: "valid" }), "VALID");
    assert.equal(assessQuality({ value: 1.2, stationQuality: "error" }), "SENSOR_FAULT");
    assert.equal(assessQuality({ value: 1.2, stationQuality: "error", sensorFault: false }), "VALID"); // another probe faulted, not this one
  });
  it("flags physically impossible values as SUSPECT and demo data as unproven", () => {
    assert.equal(assessQuality({ value: 140, stationQuality: "valid", plausibleRange: [0, 100] }), "SUSPECT");
    assert.equal(assessQuality({ value: 5, stationQuality: "valid", isDemo: true }), "UNKNOWN");
  });
});

describe("threshold assessment never equates 'no threshold' with 'safe'", () => {
  const fresh = "FRESH" as const, valid = "VALID" as const;
  it("is NOT_CONFIGURED without an active, validated row", () => {
    assert.equal(assessThreshold({ quantity: "soil_ph", value: 5.6, rows: salinityRows, freshness: fresh, quality: valid }).level, "NOT_CONFIGURED");
    assert.equal(assessThreshold({ quantity: "water_salinity", value: 1, rows: [row({ is_active: false })], freshness: fresh, quality: valid }).level, "NOT_CONFIGURED");
    assert.equal(assessThreshold({ quantity: "water_salinity", value: 1, rows: [row({ validation_status: "REFERENCE" })], freshness: fresh, quality: valid }).level, "NOT_CONFIGURED");
    assert.equal(assessThreshold({ quantity: "water_salinity", value: 1, rows: [row({ basis: "DEVICE_HEALTH" })], freshness: fresh, quality: valid }).level, "NOT_CONFIGURED");
  });
  it("is NOT_APPLICABLE where the concept does not exist", () => {
    assert.equal(assessThreshold({ quantity: "weather_wind", value: 3, rows: [], freshness: fresh, quality: valid, applicable: false }).level, "NOT_APPLICABLE");
  });
  it("refuses to compare stale or untrusted values with a threshold", () => {
    const stale = assessThreshold({ quantity: "water_salinity", value: 9, rows: salinityRows, freshness: "STALE", quality: valid });
    assert.deepEqual([stale.level, stale.blockedBy], ["NOT_APPLICABLE", "freshness"]);
    const bad = assessThreshold({ quantity: "water_salinity", value: 9, rows: salinityRows, freshness: fresh, quality: "SENSOR_FAULT" });
    assert.deepEqual([bad.level, bad.blockedBy], ["NOT_APPLICABLE", "quality"]);
  });
  it("classifies WITHIN / APPROACHING / EXCEEDED from sourced rows only", () => {
    const a = (value: number, recent?: number[]) => assessThreshold({ quantity: "water_salinity", value, rows: salinityRows, freshness: fresh, quality: valid, recent });
    assert.equal(a(0.4).level, "WITHIN_REFERENCE_THRESHOLD");
    assert.equal(a(1.7).level, "APPROACHING_THRESHOLD");
    assert.equal(a(2.4, [2.3, 2.4]).level, "THRESHOLD_EXCEEDED");
    assert.equal(a(2.4, [2.3, 2.4]).source?.title, "Project config");
  });
  it("does not raise an alarm on one noisy sample (anti-flicker)", () => {
    const spike = assessThreshold({ quantity: "water_salinity", value: 4, rows: salinityRows, freshness: "FRESH", quality: "VALID", recent: [0.4, 0.5, 4] });
    assert.equal(spike.level, "APPROACHING_THRESHOLD");
    assert.equal(spike.pendingConfirmation, true);
    const sustained = assessThreshold({ quantity: "water_salinity", value: 4, rows: salinityRows, freshness: "FRESH", quality: "VALID", recent: [0.5, 3.8, 4] });
    assert.equal(sustained.level, "THRESHOLD_EXCEEDED");
  });
  it("honours effective_from", () => {
    const future = [row({ effective_from: "2027-01-01T00:00:00Z" })];
    assert.equal(usableThresholdRows(future, iso(0)).length, 0);
  });
});

describe("historical anomaly (median / MAD)", () => {
  const policy = { evaluate: true };
  it("needs enough samples AND enough time coverage", () => {
    assert.equal(assessAnomaly({ value: 10, observedAtMs: NOW, baseline: baseline(20, 14 * DAY), policy }).level, "INSUFFICIENT_BASELINE");
    assert.equal(assessAnomaly({ value: 10, observedAtMs: NOW, baseline: baseline(500, 2 * DAY), policy }).reason, "short_coverage");
    assert.equal(assessAnomaly({ value: 10, observedAtMs: NOW, baseline: baseline(200, 14 * DAY), policy }).level, "WITHIN_HISTORICAL_VARIATION");
  });
  it("calls a clear outlier STATISTICALLY_UNUSUAL only when confirmed", () => {
    const b = baseline(300, 14 * DAY);
    assert.equal(assessAnomaly({ value: 25, observedAtMs: NOW, baseline: b, policy, recent: [10, 25] }).level, "WITHIN_HISTORICAL_VARIATION"); // single spike
    const confirmed = assessAnomaly({ value: 25, observedAtMs: NOW, baseline: b, policy, recent: [24, 25] });
    assert.equal(confirmed.level, "STATISTICALLY_UNUSUAL");
    assert.ok(confirmed.robustZ! > 3.5);
  });
  it("excludes invalid, null, demo and FUTURE samples from the baseline", () => {
    const good = baseline(200, 14 * DAY);
    const poisoned: BaselineSample[] = [
      ...good,
      ...baseline(500, 14 * DAY, () => 999, false),                      // faulty readings
      ...Array.from({ length: 300 }, (_, i) => ({ t: NOW - i * 1000 - 1, value: 777, valid: true, isDemo: true })),
      ...Array.from({ length: 300 }, (_, i) => ({ t: NOW - i * 1000 - 1, value: null, valid: true })),
      ...Array.from({ length: 300 }, (_, i) => ({ t: NOW + (i + 1) * 60_000, value: 888, valid: true })), // the future
    ];
    const withJunk = assessAnomaly({ value: 10, observedAtMs: NOW, baseline: poisoned, policy });
    const clean = assessAnomaly({ value: 10, observedAtMs: NOW, baseline: good, policy });
    assert.equal(withJunk.median, clean.median);
    assert.equal(withJunk.samples, clean.samples);
  });
  it("treats unknown quality as ineligible, so thin trust means no verdict", () => {
    const unknown = baseline(300, 14 * DAY, undefined, false);
    assert.equal(assessAnomaly({ value: 10, observedAtMs: NOW, baseline: unknown, policy }).level, "INSUFFICIENT_BASELINE");
  });
  it("says INSUFFICIENT for a constant history instead of dividing by zero", () => {
    const r = assessAnomaly({ value: 11, observedAtMs: NOW, baseline: baseline(300, 14 * DAY, () => 10), policy });
    assert.deepEqual([r.level, r.reason], ["INSUFFICIENT_BASELINE", "zero_variance"]);
  });
  it("compares like with like for diurnal metrics", () => {
    // Warm afternoons vs cool nights: 30 C at 14:00 is normal, 30 C at 03:00 is not.
    const mk = (hourVn: number, base: number) => Array.from({ length: 12 * 10 }, (_, d) => {
      const day = Math.floor(d / 10);
      return { t: Date.parse("2026-10-10T00:00:00Z") - 7 * HOUR + day * DAY + hourVn * HOUR + (d % 10) * 60_000, value: base + (d % 3) * 0.1, valid: true };
    });
    const history: BaselineSample[] = [...mk(14, 30), ...mk(3, 24)];
    const at = (hourVn: number) => Date.parse("2026-10-25T00:00:00Z") - 7 * HOUR + hourVn * HOUR;
    const diurnal = { evaluate: true, diurnal: true, minSamples: 60, minCoverageMs: 5 * DAY };
    assert.equal(assessAnomaly({ value: 30, observedAtMs: at(14), baseline: history, policy: diurnal }).level, "WITHIN_HISTORICAL_VARIATION");
    assert.equal(assessAnomaly({ value: 30, observedAtMs: at(3), baseline: history, policy: diurnal, recent: [30, 30] }).level, "STATISTICALLY_UNUSUAL");
  });
  it("is NOT_EVALUATED for tide-driven metrics", () => {
    for (const q of ["water_level", "water_salinity", "water_ec"]) {
      assert.equal(assessAnomaly({ value: 1, observedAtMs: NOW, baseline: baseline(300, 14 * DAY), policy: ANOMALY_POLICY[q] }).level, "NOT_EVALUATED", q);
    }
  });
});

describe("display resolution (B3) - green is earned, never defaulted", () => {
  const ok = (over: Partial<MetricAssessment> = {}): MetricAssessment => ({
    freshness: "FRESH", quality: "VALID",
    threshold: { level: "WITHIN_REFERENCE_THRESHOLD", severity: null, pendingConfirmation: false, blockedBy: null, source: null },
    anomaly: { level: "NOT_EVALUATED", reason: "policy", robustZ: null, median: null, samples: 0, coverageMs: 0 }, ...over,
  });
  const thr = (level: MetricAssessment["threshold"]["level"], extra = {}) => ({ level, severity: null, pendingConfirmation: false, blockedBy: null, source: null, ...extra });
  const unusual = { level: "STATISTICALLY_UNUSUAL", reason: "ok", robustZ: 5, median: 1, samples: 300, coverageMs: 14 * DAY } as const;
  const inRange = { ...unusual, level: "WITHIN_HISTORICAL_VARIATION" } as const;

  it("green only with threshold + valid + fresh", () => {
    assert.equal(resolveDisplay(ok()).tone, "green");
    assert.equal(resolveDisplay(ok({ freshness: "STALE" })).tone, "gray");
    assert.equal(resolveDisplay(ok({ freshness: "OFFLINE" })).key, "offline");
    assert.equal(resolveDisplay(ok({ quality: "SENSOR_FAULT" })).tone, "gray");
    assert.equal(resolveDisplay(ok({ quality: "UNKNOWN" })).tone, "gray");
    assert.equal(resolveDisplay(ok({ quality: "MISSING" })).key, "missing");
  });
  it("red only for a confirmed configured exceedance", () => {
    assert.deepEqual(resolveDisplay(ok({ threshold: thr("THRESHOLD_EXCEEDED", { severity: "critical" }) })), { tone: "red", key: "thresholdExceeded", basis: "threshold" });
    assert.equal(resolveDisplay(ok({ threshold: thr("APPROACHING_THRESHOLD", { pendingConfirmation: true }) })).tone, "yellow");
    assert.equal(resolveDisplay(ok({ anomaly: unusual })).tone, "yellow");
    assert.notEqual(resolveDisplay(ok({ anomaly: unusual, threshold: thr("NOT_CONFIGURED") })).tone, "red");
  });
  it("an outlier inside a configured band is yellow, never green", () => {
    assert.deepEqual(resolveDisplay(ok({ anomaly: unusual })), { tone: "yellow", key: "unusualVsHistory", basis: "history" });
  });
  it("an exceedance that is not an outlier is still red", () => {
    assert.equal(resolveDisplay(ok({ threshold: thr("THRESHOLD_EXCEEDED", { severity: "warning" }), anomaly: inRange })).tone, "red");
  });
  it("history alone yields gray with its own wording, never green and never 'safe'", () => {
    const v = resolveDisplay(ok({ threshold: thr("NOT_CONFIGURED"), anomaly: inRange }));
    assert.deepEqual(v, { tone: "gray", key: "withinHistoricalRange", basis: "history" });
    assert.equal(resolveDisplay(ok({ threshold: thr("NOT_CONFIGURED") })).key, "noThreshold");
    assert.equal(resolveDisplay(ok({ threshold: thr("NOT_APPLICABLE") })).key, "insufficient");
  });
});

describe("assessMetric end to end", () => {
  const args = { quantity: "water_salinity", observedAt: iso(2 * MIN), nowMs: NOW, rows: salinityRows, stationQuality: "valid" as const };
  it("green for a fresh, valid value inside configured bands", () => {
    assert.equal(resolveDisplay(assessMetric({ ...args, value: 0.4 })).tone, "green");
  });
  it("the same value an hour later renders gray, not green", () => {
    assert.equal(resolveDisplay(assessMetric({ ...args, value: 0.4, observedAt: iso(70 * MIN) })).tone, "gray");
  });
  it("a faulted sensor beats a pretty number", () => {
    assert.equal(resolveDisplay(assessMetric({ ...args, value: 0.4, stationQuality: "error" })).key, "sensorFault");
  });
  it("soil pH with no configured threshold stays gray and says so", () => {
    assert.equal(resolveDisplay(assessMetric({ ...args, quantity: "soil_ph", value: 5.6 })).key, "noThreshold");
  });
});
