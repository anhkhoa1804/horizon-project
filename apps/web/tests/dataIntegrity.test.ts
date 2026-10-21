import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATION_COORDS } from "../lib/geo";
import { qualityFor, stationProfiles, waterQuality } from "../lib/stationProfile";
import { applyLiveReading, type LiveReading } from "../lib/monitoring/liveReadings";
import { getObservatoryViewModel } from "../lib/monitoring/buildObservatory";
import { vi } from "../lib/i18n/vi";
import type { EnvironmentalReading } from "../types";
import type { ObservatoryMetric, ObservatoryViewModel } from "../lib/monitoring/types";

/**
 * Regression tests for audit findings I-09 and I-10.
 * I-09: the absence of fault evidence must never read as "valid" sensor data.
 * I-10: a missing station snapshot must never produce a 0,0 coordinate.
 */

const waterProfile = stationProfiles.STATION_01;
const soilProfile = stationProfiles.STATION_02;
const reading = (over: Partial<EnvironmentalReading> = {}): EnvironmentalReading =>
  ({ station_id: "STATION_01", salinity: 1, water_level: 50, fault_flags: 0, ec_probe_status: "ok", ultrasonic_status: "ok", ...over }) as unknown as EnvironmentalReading;

describe("I-09 quality needs positive evidence", () => {
  it("no reading → no quality claim", () => {
    assert.equal(qualityFor(waterProfile, null), null);
    assert.equal(qualityFor(soilProfile, null), null);
  });
  it("a reported fault count of 0 is the only path to valid", () => {
    assert.equal(qualityFor(waterProfile, reading()), "valid");
  });
  it("missing / non-numeric fault_flags is not 'valid'", () => {
    for (const bad of [undefined, null, "0", Number.NaN]) {
      assert.equal(qualityFor(waterProfile, reading({ fault_flags: bad as unknown as number, ec_probe_status: undefined, ultrasonic_status: undefined } as never)), null, String(bad));
    }
    assert.equal(waterQuality(undefined, undefined, undefined), null);
  });
  it("a fault is an error even when fault_flags is missing", () => {
    assert.equal(waterQuality(undefined, "fault", undefined), "error");
    assert.equal(waterQuality(undefined, undefined, "fault"), "error");
    assert.equal(waterQuality(2, "ok", "ok"), "error");
  });
  it("unknown probe status stays 'estimated', not valid", () => {
    assert.equal(waterQuality(0, "unknown", "ok"), "estimated");
  });
});

const metric = (labelKey: ObservatoryMetric["labelKey"]): ObservatoryMetric => ({ label: String(labelKey), labelKey, value: null, provenance: { origin: "unavailable" } });
function model(): ObservatoryViewModel {
  const base = { name: "T", location: "T", lat: null, lng: null, timestamp: null, freshness: "unavailable" as const, quality: null, device: [], needsAttention: false, capabilityNote: null };
  const series = { points: [], availableMetrics: [], provenance: { origin: "unavailable" as const } };
  return { mode: "real", salinityThreshold: null, alerts: [], reference: [], network: { total: 2, live: 0, offline: 0, noData: 2, alertsNeedingAttention: 0, lastObservationAt: null, provenance: { origin: "unavailable" } }, stations: [
    { ...base, id: "STATION_01", kind: "water", primary: metric("salinity"), environment: [{ domain: "water", label: "W", metrics: [metric("waterLevel")] }] },
    { ...base, id: "STATION_02", kind: "soil", primary: metric("moisture"), environment: [{ domain: "soil", label: "S", metrics: [metric("ec")] }] },
  ], series: { "24h": series, "7d": series, "30d": series } };
}

describe("I-09 live packets", () => {
  const now = () => new Date().toISOString();
  it("a water packet with no fault evidence has quality null, not valid", () => {
    const row: LiveReading = { station_id: "STATION_01", kind: "water", observation_id: "x", timestamp: now(), measurements: { salinity: 1.2, water_level: 40 } };
    const after = applyLiveReading(model(), row);
    assert.equal(after.stations[0].primary.value, "1.20", "value is still shown");
    assert.equal(after.stations[0].quality, null);
  });
  it("fault_flags 0 is valid; fault_flags>0 or a faulty probe is error", () => {
    const mk = (m: Record<string, unknown>): LiveReading => ({ station_id: "STATION_01", kind: "water", observation_id: "x", timestamp: now(), measurements: m });
    assert.equal(applyLiveReading(model(), mk({ salinity: 1, fault_flags: 0 })).stations[0].quality, "valid");
    assert.equal(applyLiveReading(model(), mk({ salinity: 1, fault_flags: 4 })).stations[0].quality, "error");
    assert.equal(applyLiveReading(model(), mk({ salinity: 1, ultrasonic_status: "fault" })).stations[0].quality, "error");
  });
  it("a soil packet with no fault evidence is not valid either", () => {
    const row: LiveReading = { station_id: "STATION_02", kind: "soil", observation_id: "x", timestamp: now(), measurements: { soil_ec_ms_cm: 1 } };
    assert.equal(applyLiveReading(model(), row).stations[1].quality, null);
  });
  it("a packet with no fault evidence clears a previous 'valid' rather than inheriting it", () => {
    const first = applyLiveReading(model(), { station_id: "STATION_01", kind: "water", observation_id: "a", timestamp: new Date(Date.now() - 60000).toISOString(), measurements: { salinity: 1, fault_flags: 0 } });
    assert.equal(first.stations[0].quality, "valid");
    const second = applyLiveReading(first, { station_id: "STATION_01", kind: "water", observation_id: "b", timestamp: now(), measurements: { salinity: 1 } });
    assert.equal(second.stations[0].quality, null);
  });
});

describe("I-10 coordinates", () => {
  it("every pilot station has a surveyed, non-zero position", () => {
    for (const [id, p] of Object.entries(STATION_COORDS)) {
      assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng), id);
      assert.ok(!(p.lat === 0 && p.lng === 0), id);
      assert.ok(p.lat > 9 && p.lat < 11 && p.lng > 105 && p.lng < 107, `${id} is in the Mekong delta`);
    }
  });
  it("with no database snapshots the real model uses surveyed coordinates or null, never 0,0", async () => {
    const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      const real = await getObservatoryViewModel("real", vi);
      assert.ok(real.stations.length > 0);
      for (const s of real.stations) {
        const zero = s.lat === 0 || s.lng === 0;
        assert.equal(zero, false, `${s.id} must not carry a 0 coordinate`);
        assert.ok((s.lat === null) === (s.lng === null));
      }
      const demo = await getObservatoryViewModel("demo", vi);
      for (const s of demo.stations) assert.deepEqual([s.lat, s.lng], [null, null], "demo stations are unplaced");
    } finally {
      if (saved.url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
      if (saved.key !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
    }
  });
});
