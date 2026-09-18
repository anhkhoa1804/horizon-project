import "server-only";

import { freshnessStatus } from "@/components/ui/status-indicator";
import type { DataProvenance } from "@/lib/dataState";
import { resolveTelemetryOrigin } from "@/lib/dataState";
import {
  DEMO_ALERTS,
  DEMO_ENVIRONMENT_WEEK,
  DEMO_SOIL_TREND,
  DEMO_STATION_SNAPSHOTS,
  DEMO_WATER_TREND,
} from "@/lib/demo/observatoryDemoData";
import { getExternalWeatherHistory24h } from "@/lib/external/weather";
import type { DemoStationSnapshot } from "@/lib/demo/types";
import { getPublicRepositories } from "@/lib/publicRead";
import {
  filterSnapshotsToPilotStations,
  isPilotStation,
  latestPilotTimestamp,
  PILOT_STATION_IDS,
  type PilotStationId,
} from "@/lib/publicStations";
import { qualityFor, stationProfiles, stationText } from "@/lib/stationProfile";
import { eventTitleKey } from "@/lib/utils";
import type {
  DailyComparisonPoint,
  DailySoilPoint,
  EnvironmentalEvent,
  SoilReading,
  SoilTrendPoint,
  StationReadingSnapshot,
  TrendPoint,
} from "@/types";
import { buildReference } from "./reference";
import type { Dictionary } from "@/lib/i18n/vi";
import type {
  ObservationPoint,
  ObservationSeries,
  ObservatoryAlert,
  ObservatoryMetric,
  ObservatoryNetworkState,
  ObservatoryStation,
  ObservatoryViewModel,
  TrendMetric,
  TrendRange,  MetricLabelKey,
} from "./types";
import { mergeWeather24hSeries, weatherHistoryToObservationSeries } from "./weatherSeries";

const TELEMETRY: DataProvenance = { origin: "telemetry", source: "Quan trắc trực tiếp" };
const HISTORICAL: DataProvenance = { origin: "historical" };
const DEMO: DataProvenance = { origin: "demo" };



function unavailable(note?: string): DataProvenance {
  return { origin: "unavailable", note };
}

function bucketFreshness(freshness: ReturnType<typeof freshnessStatus>): "live" | "offline" | "noData" {
  if (freshness === "live" || freshness === "recent") return "live";
  if (freshness === "stale" || freshness === "offline") return "offline";
  return "noData";
}

function metric(
  label: string,
  value: number | null | undefined,
  decimals: number,
  unit: string | undefined,
  provenance: DataProvenance,
  labelKey?: MetricLabelKey,
): ObservatoryMetric {
  return {
    label,
    labelKey,
    value: value === null || value === undefined ? null : value.toFixed(decimals),
    unit,
    provenance,
  };
}

const ALL_METRICS: TrendMetric[] = [
  "waterEc",
  "waterTemp",
  "salinity",
  "waterLevel",
  "soilMoisture",
  "soilEc",
  "soilPh",
  "soilTemp",
  "airTemp",
  "airHumidity",
  "weatherTemp",
  "weatherHumidity",
  "weatherWind",
  "weatherPrecipitation",
];

/** Metrics with at least one real value — drives which chart toggles appear. */
function availableMetrics(points: ObservationPoint[]): TrendMetric[] {
  return ALL_METRICS.filter((metric) => points.some((p) => p[metric] !== null));
}

/** An observation point with every metric absent; callers fill what they have. */
function blankPoint(label: string): ObservationPoint {
  return {
    label,
    waterEc: null,
    waterTemp: null,
    salinity: null,
    waterLevel: null,
    soilMoisture: null,
    soilEc: null,
    soilPh: null,
    soilTemp: null,
    airTemp: null,
    airHumidity: null,
    weatherTemp: null,
    weatherHumidity: null,
    weatherWind: null,
    weatherPrecipitation: null,
  };
}

/**
 * All x-axis labels are formatted in Asia/Ho_Chi_Minh explicitly.
 *
 * Without the timeZone option these would render in the *server's* zone, so
 * a reading taken at 14:00 in Vĩnh Long would be labelled 07:00 on a
 * UTC-hosted deployment. The repository layer already pins this zone for its
 * daily bucketing (see dateKey/shortDateLabel in readingRepository.ts); this
 * keeps the presentation layer consistent with it.
 */
const TZ = "Asia/Ho_Chi_Minh";
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));

function emptySeries(provenance: DataProvenance): ObservationSeries {
  return { points: [], availableMetrics: [], provenance };
}

// ---------------------------------------------------------------------------
// REAL
// ---------------------------------------------------------------------------

async function buildRealObservatory(dict: Dictionary): Promise<ObservatoryViewModel> {
  const context = getPublicRepositories();
  if (!context) return emptyRealObservatory(dict);

  try {
    const { repos, scope } = context;
    const [allSnapshots, soilReading, recentAlerts, threshold] = await Promise.all([
      repos.readings.getSnapshots(scope),
      repos.readings.getLatestSoilReadingByStation("STATION_02", scope),
      repos.alerts.getRecent(10, scope),
      repos.readings.getDefaultSalinityThreshold(),
    ]);

    // Only STATION_01 (water) has a real per-point trend source —
    // environmental_readings never carries soil/gateway rows.
    // getDailyComparison already accepts a day count, so 30 days is one
    // query and the 7-day view is its tail — no second round-trip.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [trend24h, soil24h, daily30, dailySoil30, weather24h] = await Promise.all([
      repos.readings.getTrend24h("STATION_01", scope),
      repos.readings.getSoilTrend("STATION_02", scope, { sinceIso: since24h }),
      repos.readings.getDailyComparison(scope, 30),
      repos.readings.getDailySoilTrend("STATION_02", scope, 30),
      getExternalWeatherHistory24h(),
    ]);

    const snapshots = filterSnapshotsToPilotStations(allSnapshots);
    const alerts = recentAlerts.filter((alert) => isPilotStation(alert.station_id));
    const alertStationIds = new Set(alerts.map((a) => a.station_id));

    const latestWaterProbe = [...trend24h]
      .reverse()
      .find((point) => point.water_ec_ms_cm !== null || point.water_temp_c !== null) ?? null;
    const stations: ObservatoryStation[] = PILOT_STATION_IDS.map((id) =>
      buildRealStation(dict, id, snapshots, soilReading, alertStationIds.has(id), latestWaterProbe),
    );

    return {
      mode: "real",
      salinityThreshold: threshold ?? null,
      network: buildNetworkState(stations, alerts, TELEMETRY),
      stations,
      series: {
        "24h": mergeWeather24hSeries(
          seriesFromTrend(trend24h, soil24h),
          weatherHistoryToObservationSeries(weather24h),
        ),
        "7d": seriesFromDaily(daily30.slice(-7), dailySoil30.slice(-7)),
        "30d": seriesFromDaily(daily30, dailySoil30),
      },
      alerts: alerts.map((a) => toObservatoryAlert(a, dict)),
      reference: buildReference(threshold, dict),
    };
  } catch {
    return emptyRealObservatory(dict);
  }
}

function emptyRealObservatory(dict: Dictionary): ObservatoryViewModel {
  const stations = PILOT_STATION_IDS.map((id) => buildRealStation(dict, id, [], null, false));
  return {
    mode: "real",
    salinityThreshold: null,
    network: buildNetworkState(stations, [], TELEMETRY),
    stations,
    series: { "24h": emptySeries(TELEMETRY), "7d": emptySeries(HISTORICAL), "30d": emptySeries(HISTORICAL) },
    alerts: [],
    reference: buildReference(null, dict),
  };
}

/**
 * Water and soil are separate physical stations reporting on their own
 * cadences, so their points are concatenated rather than merged into shared
 * rows. Recharts skips null values, which means each metric draws only where
 * it genuinely has observations instead of being interpolated across the
 * other station's timestamps.
 */
function seriesFromTrend(water: TrendPoint[], soil: SoilTrendPoint[]): ObservationSeries {
  const waterPoints: ObservationPoint[] = water.map((p) => ({
    ...blankPoint(timeLabel(p.timestamp)),
    waterEc: p.water_ec_ms_cm,
    waterTemp: p.water_temp_c,
    salinity: Number.isFinite(p.salinity) ? p.salinity : null,
    waterLevel: Number.isFinite(p.water_level) ? p.water_level : null,
  }));

  const soilPoints: ObservationPoint[] = soil.map((p) => ({
    ...blankPoint(timeLabel(p.timestamp)),
    soilMoisture: p.soil_moisture_pct,
    soilEc: p.soil_ec_ms_cm,
    soilPh: p.soil_ph,
    soilTemp: p.soil_temp_c,
    airTemp: p.air_temp_c,
    airHumidity: p.air_humidity_pct,
  }));

  const points = [...waterPoints, ...soilPoints];
  return { points, availableMetrics: availableMetrics(points), provenance: TELEMETRY };
}

/**
 * Water and soil daily buckets are merged into one row per calendar day.
 *
 * Unlike the 24h series — where the two stations report at unrelated
 * instants and must stay as separate points — both daily aggregates are
 * bucketed by the same Asia/Ho_Chi_Minh day via the same helpers, so a given
 * day is genuinely the same bucket in both. Merging on the day label keeps
 * the x-axis at 7 or 30 points instead of doubling it, and is robust to the
 * two arrays differing in length.
 */
function seriesFromDaily(daily: DailyComparisonPoint[], soil: DailySoilPoint[] = []): ObservationSeries {
  const soilByDate = new Map(soil.map((s) => [s.date, s]));

  const points: ObservationPoint[] = daily.map((d) => {
    const s = soilByDate.get(d.date);
    return {
      ...blankPoint(d.date),
      salinity: d.salinity,
      waterLevel: d.tideLevel,
      waterEc: d.waterEc,
      waterTemp: d.waterTemp,
      soilMoisture: s?.soil_moisture_pct ?? null,
      soilEc: s?.soil_ec_ms_cm ?? null,
      soilPh: s?.soil_ph ?? null,
      soilTemp: s?.soil_temp_c ?? null,
      airTemp: s?.air_temp_c ?? null,
      airHumidity: s?.air_humidity_pct ?? null,
    };
  });

  return { points, availableMetrics: availableMetrics(points), provenance: HISTORICAL };
}

function buildRealStation(
  dict: Dictionary,
  id: PilotStationId,
  snapshots: StationReadingSnapshot[],
  soilReading: SoilReading | null,
  hasAlert: boolean,
  latestWaterProbe: TrendPoint | null = null,
): ObservatoryStation {
  const profile = stationProfiles[id];
  const snapshot = snapshots.find((s) => s.station.id === id);
  const timestamp = latestPilotTimestamp(id, snapshot, soilReading);
  const freshness = freshnessStatus(timestamp);
  const provenance: DataProvenance = {
    origin: resolveTelemetryOrigin(freshness, timestamp !== null),
    source: "Quan trắc trực tiếp",
    observedAt: timestamp ?? undefined,
  };

  const base = {
    id,
    name: stationText(profile.id, dict).name,
    location: stationText(profile.id, dict).location,
    lat: snapshot?.station.lat ?? 0,
    lng: snapshot?.station.lng ?? 0,
    freshness,
    needsAttention: hasAlert,
    timestamp,
    // No current firmware reports battery/signal for a relayed station, so
    // real mode never populates this — the UI states that plainly instead of
    // rendering a row of blanks.
    device: [] as ObservatoryMetric[],
  };

  if (profile.kind === "soil") {
    return {
      ...base,
      kind: "soil",
      quality: soilReading ? "valid" : null,
      primary: metric("Độ ẩm đất", soilReading?.soil_moisture_pct, 1, "%", provenance, "moisture"),
      environment: [
        {
          domain: "soil",
          label: "Đất",
          metrics: [
            metric("EC đất", soilReading?.soil_ec_ms_cm, 2, "mS/cm", provenance, "ec"),
            metric("Độ pH", soilReading?.soil_ph, 1, undefined, provenance, "ph"),
            metric("Nhiệt độ đất", soilReading?.soil_temp_c, 1, "°C", provenance, "temperature"),
          ],
        },
        {
          domain: "air",
          label: "Không khí",
          metrics: [
            metric("Nhiệt độ", soilReading?.air_temp_c, 1, "°C", provenance, "temperature"),
            metric("Độ ẩm", soilReading?.air_humidity_pct, 1, "%", provenance, "humidity"),
          ],
        },
      ],
      capabilityNote: null,
    };
  }

  if (profile.kind === "gateway") {
    const signal = snapshot?.health?.signal_strength_dbm ?? null;
    return {
      ...base,
      kind: "gateway",
      quality: null,
      primary: {
        label: "Tín hiệu",
        // Without labelKey the canvas falls back to `label`, which is how a
        // lone Vietnamese "Tín hiệu" survived on the English observatory.
        labelKey: "signal",
        value: signal !== null ? String(signal) : null,
        unit: "dBm",
        provenance: signal !== null ? provenance : unavailable(dict.reference.gatewayCapability),
      },
      environment: [],
      capabilityNote: signal !== null ? null : dict.reference.gatewayCapability,
    };
  }

  const reading = snapshot?.reading ?? null;
  const probeProvenance: DataProvenance = latestWaterProbe
    ? { origin: "telemetry", source: "Quan trắc trực tiếp", observedAt: latestWaterProbe.timestamp }
    : unavailable("Chưa có quan trắc EC/nhiệt độ nước");
  return {
    ...base,
    kind: "water",
    quality: reading ? qualityFor(profile, reading) : null,
    primary: metric("Độ mặn", reading?.salinity, 2, "‰", provenance, "salinity"),
    environment: [
      {
        domain: "water",
        label: "Nước",
        metrics: [
          metric("Mực nước", reading?.water_level, 0, "cm", provenance, "waterLevel"),
          metric(
            "EC nước",
            reading?.water_ec_ms_cm ?? latestWaterProbe?.water_ec_ms_cm,
            3,
            "mS/cm",
            reading?.water_ec_ms_cm != null ? provenance : probeProvenance,
            "waterEc",
          ),
          metric(
            "Nhiệt độ nước",
            reading?.water_temp_c ?? latestWaterProbe?.water_temp_c,
            1,
            "°C",
            reading?.water_temp_c != null ? provenance : probeProvenance,
            "waterTemp",
          ),
        ],
      },
    ],
    capabilityNote: null,
  };
}

// ---------------------------------------------------------------------------
// DEMO
// ---------------------------------------------------------------------------

function buildDemoObservatory(dict: Dictionary): ObservatoryViewModel {
  const stations = DEMO_STATION_SNAPSHOTS.map((snap) => buildDemoStation(snap, dict));
  // Illustrative daily soil values derived from the same 30-day demo dates,
  // so demo 7D/30D exercise the soil metrics exactly as real mode will.
  // Purely synthetic and never mixed with repository data.
  const demoDaily: ObservationPoint[] = DEMO_ENVIRONMENT_WEEK.map((d, i) => {
    const phase = i / 4;
    return {
      ...blankPoint(dayLabel(d.date)),
      waterEc: null,
      waterTemp: null,
      salinity: d.salinity ?? null,
      waterLevel: d.tideLevel ?? null,
      soilMoisture: Number((56 + Math.sin(phase) * 5).toFixed(1)),
      soilEc: Number((1.28 + Math.cos(phase / 1.6) * 0.2).toFixed(2)),
      soilPh: Number((6.15 + Math.sin(phase / 2.2) * 0.3).toFixed(1)),
      soilTemp: Number((28.6 + Math.sin(phase / 1.3) * 1.9).toFixed(1)),
      airTemp: Number((30.2 + Math.sin(phase / 1.1 + 0.5) * 3.1).toFixed(1)),
      airHumidity: Number((73 - Math.sin(phase / 1.1 + 0.5) * 7).toFixed(1)),
    };
  });

  // Same concatenation shape as the real 24h series: water points and soil
  // points are separate observations, not merged rows.
  const trendPoints: ObservationPoint[] = [
    ...DEMO_WATER_TREND.points.map((p) => ({
      ...blankPoint(timeLabel(p.timestamp)),
      waterEc: null,
      waterTemp: null,
      salinity: p.salinity ?? null,
      waterLevel: p.waterLevel ?? null,
    })),
    ...DEMO_SOIL_TREND.map((p) => ({
      ...blankPoint(timeLabel(p.timestamp)),
      soilMoisture: p.soilMoisturePct ?? null,
      soilEc: p.soilEcMsCm ?? null,
      soilPh: p.soilPh ?? null,
      soilTemp: p.soilTempC ?? null,
      airTemp: p.airTempC ?? null,
      airHumidity: p.airHumidityPct ?? null,
    })),
  ];

  return {
    mode: "demo",
    // Demo data is synthetic and labelled as such everywhere it appears, so it
    // may carry a threshold in order to exercise the status palette. This is
    // the one place a band exists without a real configuration behind it, and
    // the ~ marker on every value already says the data is not real.
    salinityThreshold: { warningLevel: 1.0, criticalLevel: 2.0 },
    network: buildNetworkState(stations, DEMO_ALERTS, DEMO),
    stations,
    series: {
      "24h": { points: trendPoints, availableMetrics: availableMetrics(trendPoints), provenance: DEMO },
      // 7d is the tail of the same 30-day array, mirroring how the real
      // builder slices one query rather than issuing a second.
      "7d": {
        points: demoDaily.slice(-7),
        availableMetrics: availableMetrics(demoDaily.slice(-7)),
        provenance: DEMO,
      },
      "30d": { points: demoDaily, availableMetrics: availableMetrics(demoDaily), provenance: DEMO },
    },
    alerts: DEMO_ALERTS.map((a) => ({
      id: a.id,
      stationName: dict.demo[a.stationLabelKey],
      severity: a.severity,
      title: dict.demo[a.titleKey],
      message: dict.demo[a.messageKey],
      timestamp: a.timestamp,
      provenance: DEMO,
    })),
    reference: buildReference(null, dict),
  };
}

function buildDemoStation(snapshot: DemoStationSnapshot, dict: Dictionary): ObservatoryStation {
  const freshness = freshnessStatus(snapshot.observedAt);
  const provenance: DataProvenance = { origin: "demo", observedAt: snapshot.observedAt };
  const device = [
    metric("Pin", snapshot.batteryVoltage, 2, "V", provenance, "battery"),
    metric("Tín hiệu", snapshot.signalStrengthDbm, 0, "dBm", provenance, "signal"),
  ];

  const base = {
    id: snapshot.id,
    name: dict.demo[snapshot.labelKey],
    location: dict.demo.unplacedLocation,
    // Demo stations carry no coordinates on purpose: the map refuses to
    // plot them rather than showing a plausible-looking pin near Cồn Hô.
    lat: 0,
    lng: 0,
    freshness,
    needsAttention: false,
    timestamp: snapshot.observedAt,
  };

  if (snapshot.kind === "soil") {
    return {
      ...base,
      kind: "soil",
      quality: "valid",
      primary: metric("Độ ẩm đất", snapshot.soilMoisturePct, 1, "%", provenance, "moisture"),
      environment: [
        {
          domain: "soil",
          label: "Đất",
          metrics: [
            metric("EC đất", snapshot.soilEcMsCm, 2, "mS/cm", provenance, "ec"),
            metric("Độ pH", snapshot.soilPh, 1, undefined, provenance, "ph"),
            metric("Nhiệt độ đất", snapshot.soilTempC, 1, "°C", provenance, "temperature"),
          ],
        },
        {
          domain: "air",
          label: "Không khí",
          metrics: [
            metric("Nhiệt độ", snapshot.airTempC, 1, "°C", provenance, "temperature"),
            metric("Độ ẩm", snapshot.airHumidityPct, 1, "%", provenance, "humidity"),
          ],
        },
      ],
      device,
      capabilityNote: null,
    };
  }

  if (snapshot.kind === "gateway") {
    return {
      ...base,
      kind: "gateway",
      quality: null,
      primary: metric("Tín hiệu", snapshot.signalStrengthDbm, 0, "dBm", provenance, "signal"),
      environment: [],
      device: [metric("Pin", snapshot.batteryVoltage, 2, "V", provenance, "battery")],
      capabilityNote: null,
    };
  }

  return {
    ...base,
    kind: "water",
    quality: "valid",
    primary: metric("Độ mặn", snapshot.salinity, 2, "‰", provenance, "salinity"),
    environment: [
      {
        domain: "water" as const,
        label: "Nước",
        metrics: [
          metric("Mực nước", snapshot.waterLevel, 0, "cm", provenance, "waterLevel"),
          metric("EC nước", null, 3, "mS/cm", provenance, "waterEc"),
          metric("Nhiệt độ nước", null, 1, "°C", provenance, "waterTemp"),
        ],
      },
    ],
    device,
    capabilityNote: null,
  };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function buildNetworkState(
  stations: ObservatoryStation[],
  alerts: { severity: "info" | "warning" | "critical" }[],
  provenance: DataProvenance,
): ObservatoryNetworkState {
  const counts = { live: 0, offline: 0, noData: 0 };
  for (const s of stations) counts[bucketFreshness(s.freshness)] += 1;

  const timestamps = stations.map((s) => s.timestamp).filter((t): t is string => t !== null);
  const lastObservationAt =
    timestamps.length > 0 ? timestamps.reduce((a, b) => (a > b ? a : b)) : null;

  return {
    total: stations.length,
    live: counts.live,
    offline: counts.offline,
    noData: counts.noData,
    alertsNeedingAttention: alerts.filter((a) => a.severity === "critical" || a.severity === "warning").length,
    lastObservationAt,
    provenance,
  };
}

function toObservatoryAlert(alert: EnvironmentalEvent, dict: Dictionary): ObservatoryAlert {
  return {
    id: alert.id,
    stationName: stationText(alert.station_id, dict).name,
    severity: alert.severity,
    title: alert.event_type,
    titleKey: eventTitleKey(alert.event_type),
    message: alert.message_id ?? alert.event_type,
    timestamp: alert.timestamp,
    provenance: TELEMETRY,
  };
}

export async function getObservatoryViewModel(
  mode: "real" | "demo",
  dict: Dictionary,
): Promise<ObservatoryViewModel> {
  if (mode === "demo") return buildDemoObservatory(dict);
  return buildRealObservatory(dict);
}

export type { TrendRange };
