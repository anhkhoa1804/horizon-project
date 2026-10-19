import test from "node:test";
import assert from "node:assert/strict";
import { applyLiveReading, parseLiveReading, type LiveReading } from "../lib/monitoring/liveReadings";
import type { ObservatoryViewModel, ObservatoryMetric } from "../lib/monitoring/types";
import { stationTrendSeries } from "../lib/monitoring/stationSeries";

const metric = (labelKey: ObservatoryMetric["labelKey"], value: string | null = null): ObservatoryMetric => ({ label: String(labelKey), labelKey, value, provenance: { origin: "unavailable" } });
function model(): ObservatoryViewModel {
  const base = { name: "Test instrument", location: "Test fixture", lat: 0, lng: 0, timestamp: null, freshness: "unavailable" as const, quality: null, device: [], needsAttention: false, capabilityNote: null };
  const series = { points: [], availableMetrics: [], provenance: { origin: "unavailable" as const } };
  return { mode: "real", salinityThreshold: null, alerts: [], reference: [], network: { total: 2, live: 0, offline: 0, noData: 2, alertsNeedingAttention: 0, lastObservationAt: null, provenance: { origin: "unavailable" } }, stations: [
    { ...base, id: "STATION_01", kind: "water", primary: metric("salinity"), environment: [{ domain: "water", label: "Water", metrics: [metric("waterLevel"), metric("waterEc"), metric("waterTemp")] }] },
    { ...base, id: "STATION_02", kind: "soil", primary: metric("moisture"), environment: [{ domain: "soil", label: "Soil", metrics: [metric("ec"), metric("ph"), metric("temperature")] }, { domain: "air", label: "Air", metrics: [metric("temperature"), metric("humidity")] }] },
  ], series: { "24h": series, "7d": series, "30d": series } };
}
const water = (timestamp = new Date().toISOString()): LiveReading => ({ station_id: "STATION_01", kind: "water", observation_id: "fixture", timestamp, measurements: { salinity: 1.24, water_level: 52, water_ec_ms_cm: 2.8, water_temp_c: 28.5, fault_flags: 0 } });
test("live rows are restricted to canonical station and domain pairs", () => {
  assert.ok(parseLiveReading(water()));
  assert.equal(parseLiveReading({ ...water(), station_id: "STATION_03" }), null);
  assert.equal(parseLiveReading({ ...water(), kind: "soil" }), null);
  assert.equal(parseLiveReading({ ...water(), timestamp: "invalid" }), null);
});
test("water updates the instrument and trend without changing soil or daily aggregates", () => {
  const before = model(); const after = applyLiveReading(before, water());
  assert.equal(after.stations[0].primary.value, "1.24");
  assert.equal(after.stations[0].environment[0].metrics[0].value, "52");
  assert.equal(after.stations[1], before.stations[1]);
  assert.equal(after.series["24h"].points[0].salinity, 1.24);
  assert.equal(after.series["7d"], before.series["7d"]);
  assert.equal(after.network.noData, 1);
});
test("late packets are ignored, same-time corrections replace the trend point", () => {
  const now = new Date().toISOString(); const before = applyLiveReading(model(), water(now));
  assert.equal(applyLiveReading(before, water(new Date(Date.now() - 60000).toISOString())), before);
  const corrected = applyLiveReading(before, { ...water(now), measurements: { ...water(now).measurements, salinity: 2 } });
  assert.equal(corrected.stations[0].primary.value, "2.00");
  assert.equal(corrected.series["24h"].points.length, 1);
});
test("partial packets preserve old water probe provenance and do not carry values into new trend samples", () => {
  const before = applyLiveReading(model(), water(new Date(Date.now() - 60000).toISOString()));
  const oldProbe = before.stations[0].environment[0].metrics[1];
  const after = applyLiveReading(before, { ...water(), measurements: { water_level: 0, fault_flags: 1 } });
  assert.equal(after.stations[0].primary.value, null);
  assert.equal(after.stations[0].environment[0].metrics[0].value, "0");
  assert.equal(after.stations[0].environment[0].metrics[1], oldProbe);
  assert.equal(after.stations[0].quality, "error");
  assert.equal(after.series["24h"].points.at(-1)?.waterEc, null);
});
test("soil and air temperatures are independent and demo mode never receives live values", () => {
  const row: LiveReading = { station_id: "STATION_02", kind: "soil", observation_id: "fixture", timestamp: new Date().toISOString(), measurements: { soil_moisture_pct: 31, soil_temp_c: 27, air_temp_c: 32, air_humidity_pct: 68, fault_flags: 0 } };
  const after = applyLiveReading(model(), row);
  assert.equal(after.stations[1].primary.value, "31.0");
  assert.equal(after.stations[1].environment[0].metrics[2].value, "27.0");
  assert.equal(after.stations[1].environment[1].metrics[0].value, "32.0");
  const demo = { ...model(), mode: "demo" as const }; assert.equal(applyLiveReading(demo, row), demo);
});
test("an old reconnect snapshot updates the last measurement but never enters the 24-hour plot", () => {
  const after = applyLiveReading(model(), water(new Date(Date.now() - 3 * 86400000).toISOString()));
  assert.equal(after.stations[0].primary.value, "1.24");
  assert.equal(after.series["24h"].points.length, 0);
  assert.equal(after.series["24h"].availableMetrics.length, 0);
});
test("each instrument's trend excludes other stations and external weather", () => {
  let network = applyLiveReading(model(), water());
  network = applyLiveReading(network, { station_id: "STATION_02", kind: "soil", observation_id: "soil", timestamp: new Date().toISOString(), measurements: { soil_moisture_pct: 31 } });
  assert.deepEqual(stationTrendSeries(network.series, "water")["24h"].availableMetrics, ["salinity", "waterLevel", "waterEc", "waterTemp"]);
  assert.deepEqual(stationTrendSeries(network.series, "soil")["24h"].availableMetrics, ["soilMoisture"]);
  assert.equal(stationTrendSeries(network.series, "soil")["24h"].points.length, 1);
  assert.equal(stationTrendSeries(network.series, "gateway")["24h"].points.length, 0);
});
