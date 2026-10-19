import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCelsius,
  formatPercent,
  formatPh,
  formatSoilEc,
  qualityFor,
  readingSummary,
  stationProfiles,
} from "@/lib/stationProfile";
import type { SoilReading } from "@/types";

const soilProfile = stationProfiles.STATION_02;

function soilReadingFixture(overrides: Partial<SoilReading> = {}): SoilReading {
  return {
    id: "soil-1",
    message_id: "msg-1",
    station_id: "STATION_02",
    air_temp_c: 29.1,
    air_humidity_pct: 64.5,
    soil_temp_c: 27.8,
    soil_moisture_pct: 41.2,
    soil_ec_ms_cm: 1.35,
    soil_ph: 6.4,
    fault_flags: 0,
    timestamp: "2026-08-13T00:00:00Z",
    created_at: "2026-08-13T00:00:01Z",
    ...overrides,
  };
}

describe("station-detail soil wiring", () => {
  it("renders real values from a full soil reading", () => {
    const soilReading = soilReadingFixture();
    const summary = readingSummary(soilProfile, null, null, soilReading);

    assert.equal(summary.soilEc, 1.35);
    assert.match(summary.recommendation, /Dữ liệu đất mới nhất/);
  });

  it("preserves null for individual faulted sensors in a partial reading — never substitutes a number", () => {
    const soilReading = soilReadingFixture({
      soil_ec_ms_cm: null,
      soil_ph: null,
    });
    const summary = readingSummary(soilProfile, null, null, soilReading);

    assert.equal(summary.soilEc, null);
    assert.equal(formatSoilEc(summary.soilEc), "Chưa có dữ liệu");
    // Other fields on the same reading remain real and independently visible.
    assert.equal(formatPercent(soilReading.soil_moisture_pct), "41.2%");
    assert.equal(formatPh(soilReading.soil_ph), "Chưa có dữ liệu");
    assert.equal(formatCelsius(soilReading.air_temp_c), "29.1°C");
  });

  it("falls back to the honest no-data recommendation when there is no soil reading at all", () => {
    const summary = readingSummary(soilProfile, null, null, null);

    assert.equal(summary.soilEc, null);
    assert.match(summary.recommendation, /Chưa có dữ liệu đất thực tế/);
  });

  it("never derives soil values from an unrelated water reading", () => {
    // Regression guard: soilEc must come only from soilReading, never from
    // the water-station EnvironmentalReading shape, even if one is present
    // (which shouldn't happen for a soil station, but the function must not
    // silently misuse it if it did).
    const waterShapedReading = {
      id: "r1",
      message_id: "m1",
      station_id: "STATION_02",
      salinity: 1.2,
      water_level: 50,
      fault_flags: 0,
      ec_probe_status: "ok" as const,
      ultrasonic_status: "ok" as const,
      timestamp: "2026-08-13T00:00:00Z",
      created_at: "2026-08-13T00:00:00Z",
    };
    const summary = readingSummary(soilProfile, waterShapedReading, null, null);

    assert.equal(summary.soilEc, null);
  });

  it("quality is 'valid' for a soil station even with per-field nulls — per-field null is the fault signal, not a combined status", () => {
    // Matches ingest.ts's isFaulty(): soil readings never use the water
    // whole-row fault model, so qualityFor must not flag a soil reading as
    // an "error" just because some individual sensors are null.
    assert.equal(qualityFor(soilProfile, null), "valid");
  });
});
