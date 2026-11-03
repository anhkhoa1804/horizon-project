import type {
  DemoAlert,
  DemoEnvironmentPoint,
  DemoStationSnapshot,
  DemoTrendSeries,
} from "./types";

/**
 * Static local demo dataset — never fetched, never mixed with a real
 * repository call. Station identities here are deliberately NOT
 * STATION_01/02/03: using the real pilot IDs with fabricated values would
 * make it look like these numbers were observed at the real Cồn Hô nodes,
 * which is exactly what the redesign brief prohibits ("never imply the
 * data came from Cồn Hô"). Consumers must pair this with a persistent
 * visual disclosure, not just an inline note: Monitoring does that with the
 * page-level "DỮ LIỆU MINH HỌA" banner plus a per-value SourceNote.
 */

const now = () => new Date();
const hoursAgo = (h: number) => new Date(now().getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now().getTime() - d * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_STATION_SNAPSHOTS: DemoStationSnapshot[] = [
  {
    id: "DEMO_WATER",
    kind: "water",
    labelKey: "waterStation",
    observedAt: hoursAgo(0.2),
    salinity: 1.24,
    waterLevel: 47.6,
    batteryVoltage: 3.94,
    signalStrengthDbm: -81,
  },
  {
    id: "DEMO_SOIL",
    kind: "soil",
    labelKey: "soilStation",
    observedAt: hoursAgo(0.5),
    soilMoisturePct: 58.3,
    soilTempC: 29.1,
    soilEcMsCm: 1.32,
    soilPh: 6.1,
    airTempC: 31.4,
    airHumidityPct: 74.2,
    batteryVoltage: 3.87,
    signalStrengthDbm: -88,
  },
  {
    id: "DEMO_GATEWAY",
    kind: "gateway",
    labelKey: "gatewayStation",
    observedAt: hoursAgo(0.1),
    signalStrengthDbm: -74,
    batteryVoltage: 4.01,
  },
];

export const DEMO_WATER_TREND: DemoTrendSeries = {
  stationLabelKey: "waterStation",
  points: Array.from({ length: 24 }, (_, i) => {
    const hour = 23 - i;
    // Gentle tide-like oscillation — illustrative shape only, not a real curve.
    const phase = (hour / 24) * Math.PI * 2;
    return {
      timestamp: hoursAgo(hour),
      salinity: Number((1.1 + Math.sin(phase) * 0.25).toFixed(2)),
      waterLevel: Number((48 + Math.cos(phase) * 6).toFixed(1)),
    };
  }),
};

/**
 * Daily illustrative points, newest last. 30 entries so demo mode can
 * exercise every range the chart offers — the 7-day view is this array's
 * tail, matching how the real builder derives 7d from a single 30-day query.
 *
 * The shape layers a slow drift over a shorter oscillation so the series
 * looks like something worth reading at both ranges rather than a clean sine
 * wave. It is still an invented curve, not a model of Cồn Hô's hydrology.
 */
export const DEMO_ENVIRONMENT_WEEK: DemoEnvironmentPoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  const drift = Math.sin(day / 11) * 0.18;
  const cycle = Math.cos(day / 2.4) * 0.12;
  return {
    date: daysAgo(day),
    tideLevel: Number((46 + Math.sin(day / 3.1) * 5 + Math.cos(day / 9) * 2.5).toFixed(1)),
    salinity: Number(Math.max(0.4, 1.15 + drift + cycle).toFixed(2)),
  };
});

/**
 * Illustrative 24-hour soil series for the soil station's six sensors, on a 90-minute
 * cadence (16 points) — deliberately a different rhythm from the water
 * station's hourly series, since they are independent devices.
 *
 * Exists so demo mode can exercise the soil metric selector; real soil
 * history comes from getSoilTrend and is never blended with this. One point
 * leaves pH and EC null to keep the partial-sensor case visible in review.
 */
export const DEMO_SOIL_TREND: {
  timestamp: string;
  soilMoisturePct: number | null;
  soilEcMsCm: number | null;
  soilPh: number | null;
  soilTempC: number | null;
  airTempC: number | null;
  airHumidityPct: number | null;
}[] = Array.from({ length: 16 }, (_, i) => {
  const hoursBack = 22.5 - i * 1.5;
  const phase = (hoursBack / 24) * Math.PI * 2;
  const partial = i === 6; // one reading with two probes not reporting
  return {
    timestamp: hoursAgo(hoursBack),
    soilMoisturePct: Number((57 + Math.sin(phase) * 4.5).toFixed(1)),
    soilEcMsCm: partial ? null : Number((1.3 + Math.cos(phase) * 0.18).toFixed(2)),
    soilPh: partial ? null : Number((6.1 + Math.sin(phase / 2) * 0.25).toFixed(1)),
    soilTempC: Number((28.8 + Math.sin(phase) * 1.6).toFixed(1)),
    airTempC: Number((30.5 + Math.sin(phase + 0.6) * 3.4).toFixed(1)),
    airHumidityPct: Number((74 - Math.sin(phase + 0.6) * 8).toFixed(1)),
  };
});

export const DEMO_ALERTS: DemoAlert[] = [
  {
    id: "demo-alert-1",
    stationLabelKey: "waterStation",
    severity: "warning",
    titleKey: "alertSalinityTitle",
    // Deliberately cites no threshold number: the project publishes no
    // verified salinity threshold, so even an illustrative alert should not
    // imply one exists.
    messageKey: "alertSalinityMessage",
    timestamp: hoursAgo(3),
  },
  {
    id: "demo-alert-2",
    stationLabelKey: "gatewayStation",
    severity: "info",
    titleKey: "alertSignalTitle",
    messageKey: "alertSignalMessage",
    timestamp: hoursAgo(9),
  },
];
