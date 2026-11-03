import type { ObservatoryMetric, ObservatoryStation, ObservatoryViewModel } from "@/lib/monitoring/types";
import type { DataProvenance } from "@/lib/dataState";

/**
 * DEVELOPMENT-ONLY soil fixture for STATION_02.
 *
 * Purpose: let the dashboard layout be judged while the physical station is down for a battery
 * replacement. It is NOT telemetry and never pretends to be.
 *
 * Guarantees (each one is enforced by tests/devSoilFixture.test.ts):
 *   1. OFF by default. One explicit flag turns it on: HORIZON_DEV_SOIL_FIXTURE=1.
 *   2. Impossible in production: NODE_ENV === "production" or any Vercel deployment disables it
 *      even if the flag is set, and nothing in this module reads Supabase or writes anything.
 *   3. It is applied in exactly one place - the dashboard page's view model - AFTER the real data is
 *      loaded. It is not wired into repositories, API routes, exports, alert generation, Admin,
 *      history/charts, the gateway ingestion path or the public API.
 *   4. Real data always wins: if STATION_02 has any genuine soil reading the fixture does nothing,
 *      so when the station resumes reporting the live path takes over with no code change.
 *   5. Every fixture value carries origin "demo" and a "DEV FIXTURE" source label, and the page shows
 *      a development-preview banner whenever the fixture is active.
 *
 * The values are one internally consistent profile of a saline-affected Mekong-delta orchard bed
 * (moisture 34.2 %, soil 28.6 C, bulk EC 1.46 mS/cm, pH 6.4, air 30.1 C / 72 %). They are
 * illustrative, not a prediction of what the sensor will read.
 */

export const DEV_SOIL_FIXTURE_FLAG = "HORIZON_DEV_SOIL_FIXTURE";
export const DEV_SOIL_FIXTURE_STATION = "STATION_02";
export const DEV_SOIL_FIXTURE_SOURCE = "DEV FIXTURE - synthetic, not a measurement";

type Env = Record<string, string | undefined>;

export function soilFixtureEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return env[DEV_SOIL_FIXTURE_FLAG] === "1";
}

const FIXTURE = {
  moisture: { value: "34.2", unit: "%" },
  ec: { value: "1.46", unit: "mS/cm" },
  ph: { value: "6.4", unit: undefined },
  soilTemp: { value: "28.6", unit: "°C" },
  airTemp: { value: "30.1", unit: "°C" },
  airHumidity: { value: "72.0", unit: "%" },
} as const;

function hasRealSoilData(station: ObservatoryStation): boolean {
  const values = [station.primary, ...station.environment.flatMap((g) => g.metrics)];
  return values.some((m) => m.value !== null);
}

/**
 * Returns the model unchanged unless the flag is on AND STATION_02 has no genuine soil value.
 * `active` tells the page whether to show the development banner.
 */
export function applyDevSoilFixture(
  model: ObservatoryViewModel,
  env: Env = process.env,
  now: Date = new Date(),
): { model: ObservatoryViewModel; active: boolean } {
  if (!soilFixtureEnabled(env) || model.mode !== "real") return { model, active: false };
  const index = model.stations.findIndex((s) => s.id === DEV_SOIL_FIXTURE_STATION && s.kind === "soil");
  if (index < 0 || hasRealSoilData(model.stations[index])) return { model, active: false };

  const provenance: DataProvenance = { origin: "demo", source: DEV_SOIL_FIXTURE_SOURCE, observedAt: now.toISOString() };
  const fill = (m: ObservatoryMetric): ObservatoryMetric => {
    const f =
      m.labelKey === "moisture" ? FIXTURE.moisture
      : m.labelKey === "ec" ? FIXTURE.ec
      : m.labelKey === "ph" ? FIXTURE.ph
      : m.labelKey === "temperature" ? undefined // soil vs air disambiguated by group below
      : undefined;
    return f ? { ...m, value: f.value, unit: f.unit ?? m.unit, provenance } : m;
  };
  const station = model.stations[index];
  const next: ObservatoryStation = {
    ...station,
    primary: fill(station.primary),
    environment: station.environment.map((group) => ({
      ...group,
      metrics: group.metrics.map((m) => {
        if (m.labelKey === "temperature") {
          const f = group.domain === "soil" ? FIXTURE.soilTemp : FIXTURE.airTemp;
          return { ...m, value: f.value, unit: f.unit, provenance };
        }
        if (m.labelKey === "humidity") return { ...m, value: FIXTURE.airHumidity.value, unit: FIXTURE.airHumidity.unit, provenance };
        return fill(m);
      }),
    })),
  };
  const stations = model.stations.slice();
  stations[index] = next;
  return { model: { ...model, stations }, active: true };
}
