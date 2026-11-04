import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { recentSamples, regionVerdict, toMetricStatus, verdictFor } from "@/lib/monitoring/displayStatus";
import type { ObservatoryMetric, ObservationPoint } from "@/lib/monitoring/types";
import type { ThresholdRow } from "@/lib/monitoring/thresholdTypes";
import { vi } from "@/lib/i18n/vi";
import { en } from "@/lib/i18n/en";

const NOW = Date.parse("2026-10-27T05:00:00Z");
const MIN = 60_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const row = (over: Partial<ThresholdRow>): ThresholdRow => ({
  id: "r", metric_key: "k", quantity: "water_salinity", unit: "ppt", threshold_value: 2, upper_value: null,
  comparison: "above", severity: "warning", basis: "SITE_CALIBRATED", source_title: "Project config", source_url: null,
  source_locator: null, scope: "STATION_01", validation_status: "OPERATIONAL", is_active: true, notes: null, effective_from: null, ...over,
});
const rows = [row({ threshold_value: 1.5, severity: "watch" }), row({ threshold_value: 2, severity: "warning" }), row({ id: "c", threshold_value: 3, severity: "critical" })];

const metric = (value: string | null, ageMs: number, origin: ObservatoryMetric["provenance"]["origin"] = "telemetry"): ObservatoryMetric => ({
  label: "x", value, provenance: { origin, observedAt: iso(ageMs) },
});
const pt = (ageMs: number, salinity: number | null): ObservationPoint => ({
  timestamp: iso(ageMs), label: "", salinity, waterLevel: null, waterEc: null, waterTemp: null, soilMoisture: null, soilEc: null,
  soilPh: null, soilTemp: null, airTemp: null, airHumidity: null, weatherTemp: null, weatherHumidity: null, weatherWind: null, weatherPrecipitation: null,
});
const ctx = (over = {}) => ({ rows, nowMs: NOW, stationQuality: "valid" as const, ...over });

const DAYMS = 86_400_000;
/** 30 daily points ending 2 days ago, salinity 0.40 .. 0.48 (a quiet history). */
const history = Array.from({ length: 30 }, (_, i) => pt(2 * DAYMS + i * DAYMS, 0.4 + (i % 5) * 0.02));

describe("display status: freshness, quality, threshold and history decide the colour", () => {
  it("is neutral before the browser knows the time", () => {
    assert.equal(verdictFor(metric("0.4", MIN), "water_salinity", ctx({ nowMs: null })), null);
  });
  it("white for a fresh, valid value inside a configured threshold", () => {
    const v = verdictFor(metric("0.4", MIN), "water_salinity", ctx())!;
    assert.equal(v.display.tone, "white");
    assert.equal(toMetricStatus(v)?.level, "ok");
  });
  it("NEVER coloured from a stale reading, even when the number is inside the band", () => {
    const v = verdictFor(metric("0.4", 30 * MIN), "water_salinity", ctx())!;
    assert.equal(v.display.tone, "gray");
    assert.equal(v.display.key, "stale");
    assert.equal(toMetricStatus(v), null);
    assert.equal(verdictFor(metric("0.4", 3 * 60 * MIN), "water_salinity", ctx())!.display.key, "offline");
  });
  it("soil is stale only after a day, not after 30 minutes", () => {
    const soil = (ageMs: number) => verdictFor(metric("30", ageMs), "soil_moisture", ctx({ rows: [] }))!;
    assert.notEqual(soil(30 * MIN).display.key, "stale");
    assert.notEqual(soil(20 * 60 * MIN).display.key, "stale");
    assert.equal(soil(30 * 60 * MIN).display.key, "stale");
  });
  it("no configured threshold and no history is gray 'noThreshold'", () => {
    const v = verdictFor(metric("0.4", MIN), "water_salinity", ctx({ rows: [] }))!;
    assert.equal(v.display.tone, "gray");
    assert.equal(v.display.key, "noThreshold");
  });
  it("a station fault makes the value gray, not green or red", () => {
    const v = verdictFor(metric("5", MIN), "water_salinity", ctx({ stationQuality: "error" }))!;
    assert.equal(v.display.tone, "gray");
    assert.equal(v.display.key, "sensorFault");
  });
  it("missing value is 'missing', never 0", () => {
    assert.equal(verdictFor(metric(null, MIN), "water_salinity", ctx())!.display.key, "missing");
  });
  it("no quality evidence is gray", () => {
    assert.equal(verdictFor(metric("0.4", MIN), "water_salinity", ctx({ stationQuality: null }))!.display.key, "unknownQuality");
  });
  it("external weather and reference values are never assessed", () => {
    assert.equal(verdictFor(metric("30", MIN, "external"), "water_salinity", ctx()), null);
    assert.equal(verdictFor(metric("30", MIN, "reference"), "water_salinity", ctx()), null);
  });
  it("one exceeding sample is a light red 'confirming'; two consecutive are a strong red", () => {
    const one = verdictFor(metric("2.4", MIN), "water_salinity", ctx({ series: [] }))!;
    assert.deepEqual([one.display.tone, one.display.key, one.display.strength], ["red", "confirming", 1]);
    const two = verdictFor(metric("2.4", MIN), "water_salinity", ctx({ series: [pt(3 * MIN, 2.3)] }))!;
    assert.deepEqual([two.display.tone, two.display.strength], ["red", 2]);
    assert.equal(toMetricStatus(two)?.level, "critical");
  });
  it("a spike between two normal samples does not reach the strong red", () => {
    const v = verdictFor(metric("2.4", MIN), "water_salinity", ctx({ series: [pt(3 * MIN, 0.5)] }))!;
    assert.notEqual(v.display.strength, 2);
  });
  it("history colours by z-score: usual = white, lower = green, higher = red", () => {
    const base = { rows: [], history };
    const usual = verdictFor(metric("0.44", MIN), "water_salinity", ctx({ ...base, series: [pt(3 * MIN, 0.44)] }))!;
    assert.equal(usual.display.tone, "white");
    const high = verdictFor(metric("0.9", MIN), "water_salinity", ctx({ ...base, series: [pt(3 * MIN, 0.9)] }))!;
    assert.deepEqual([high.display.tone, high.display.basis], ["red", "history"]);
    const low = verdictFor(metric("0.05", MIN), "water_salinity", ctx({ ...base, series: [pt(3 * MIN, 0.05)] }))!;
    assert.deepEqual([low.display.tone, low.display.basis], ["green", "history"]);
    const spike = verdictFor(metric("0.9", MIN), "water_salinity", ctx({ ...base, series: [pt(3 * MIN, 0.44)] }))!;
    assert.equal(spike.display.tone, "white");
  });
  it("too little history cannot colour: the anomaly layer is insufficient", () => {
    const v = verdictFor(metric("0.4", MIN), "soil_moisture", ctx({ rows: [], history: history.slice(0, 5) }))!;
    assert.equal(v.assessment.anomaly.level, "INSUFFICIENT_BASELINE");
    assert.equal(v.display.tone, "gray");
  });
  it("tide-driven metrics are compared with history too (the panel carries a caveat)", () => {
    const v = verdictFor(metric("0.4", MIN), "water_level", ctx())!;
    assert.notEqual(v.assessment.anomaly.reason, "policy");
  });
});

describe("recent samples used for confirmation", () => {
  it("ignores null, future, and samples older than the freshness window", () => {
    const cur = iso(MIN);
    const r = recentSamples([pt(2 * MIN, null), pt(-10 * MIN, 9), pt(60 * MIN, 9), pt(3 * MIN, 2.2)], "water_salinity", 2.4, cur);
    assert.deepEqual(r, [2.2, 2.4]);
  });
  it("returns only the current value for quantities the series does not carry", () => {
    assert.deepEqual(recentSamples([pt(MIN, 1)], "unknown_q", 5, iso(0)), [5]);
  });
});

describe("a region never hides a data problem", () => {
  const white = verdictFor(metric("0.4", MIN), "water_salinity", ctx())!;
  const stale = verdictFor(metric("0.4", 30 * MIN), "water_level", ctx({ rows: [row({ quantity: "water_level" })] }))!;
  const red = verdictFor(metric("2.4", MIN), "water_salinity", ctx({ series: [pt(3 * MIN, 2.3)] }))!;
  it("one stale reading keeps a white region from looking fine", () => {
    const r = regionVerdict([white, stale]);
    assert.equal(r.status, null);
    assert.equal(r.grayReason, "stale");
  });
  it("red outranks everything", () => {
    assert.equal(regionVerdict([white, stale, red]).status?.level, "critical");
  });
  it("all-white region is white; empty region is neutral", () => {
    assert.equal(regionVerdict([white]).status?.tone, "white");
    assert.equal(regionVerdict([null, null]).status, null);
  });
});

describe("copy and components", () => {
  it("VI and EN dictionaries expose the same assessment/dataScope keys", () => {
    const keys = (o: unknown, p = ""): string[] =>
      o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p];
    assert.deepEqual(keys(vi.assessment).sort(), keys(en.assessment).sort());
    assert.deepEqual(keys(vi.dataScope).sort(), keys(en.dataScope).sort());
  });
  it("the scope statement never says the data is safe or official, and says it is not a substitute", () => {
    for (const d of [vi, en]) {
      const all = JSON.stringify(d.dataScope) + JSON.stringify(d.assessment);
      assert.doesNotMatch(all, /an toàn tuyệt đối|absolutely safe|đã được chứng nhận|officially certified/i);
    }
    assert.match(vi.dataScope.items.reference.body, /không thay thế/i);
    assert.match(en.dataScope.items.reference.body, /not replace/i);
  });
  it("the scope statement sits directly under the observatory, with no scrolling ticker or separate page", () => {
    const canvas = fs.readFileSync("components/monitoring/observatory-canvas.tsx", "utf8");
    assert.match(canvas, /<DataScopeSection dict=\{dict\} \/>/);
    assert.doesNotMatch(canvas, /ProvenancePanel/);
    assert.equal(fs.existsSync("components/monitoring/provenance-panel.tsx"), false);
    assert.equal(fs.existsSync("components/monitoring/scope-ticker.tsx"), false);
    assert.equal(fs.existsSync("app/data-scope"), false);
    const css = fs.readFileSync("app/globals.css", "utf8");
    assert.doesNotMatch(css, /scope-ticker/);
    assert.match(fs.readFileSync("components/monitoring/data-scope-section.tsx", "utf8"), /data-legal-review="pending"/);
  });
  it("coloured status boxes carry no stripe, shadow or coloured outline", () => {
    const css = fs.readFileSync("app/globals.css", "utf8");
    const i = css.indexOf("STATUS TREATMENT");
    const block = css.slice(i, css.indexOf("Collapsed map credits", i));
    assert.doesNotMatch(block, /inset \d+px/);
    assert.match(block, /box-shadow:\s*none/);
    assert.match(block, /border-color:\s*transparent/);
    assert.doesNotMatch(block, /border:\s*1px solid color-mix/);
  });
  it("the canvas no longer colours from the threshold registry directly", () => {
    const src = fs.readFileSync("components/monitoring/observatory-canvas.tsx", "utf8");
    assert.doesNotMatch(src, /resolveSeverity\(applicable/);
    assert.match(src, /verdictFor/);
  });
});

describe("soil faults are read per field", () => {
  it("a missing salinity/TDS bit does not make moisture, temperature, EC or pH faulty", () => {
    const flags = 32 | 64;
    for (const q of ["soil_moisture", "soil_temp", "soil_ec_bulk", "soil_ph", "air_temp"]) {
      const v = verdictFor(metric("30", MIN), q, ctx({ rows: [], stationQuality: "error", faultFlags: flags }))!;
      assert.notEqual(v.display.key, "sensorFault", q);
    }
  });
  it("a set bit for the metric's own field is a sensor fault", () => {
    assert.equal(verdictFor(metric("30", MIN), "soil_ph", ctx({ rows: [], stationQuality: "error", faultFlags: 128 }))!.display.key, "sensorFault");
    assert.equal(verdictFor(metric("30", MIN), "soil_moisture", ctx({ rows: [], stationQuality: "error", faultFlags: 8 }))!.display.key, "sensorFault");
  });
  it("without a bitmask the station-level quality still decides", () => {
    assert.equal(verdictFor(metric("30", MIN), "soil_ph", ctx({ rows: [], stationQuality: "error" }))!.display.key, "sensorFault");
  });
});
