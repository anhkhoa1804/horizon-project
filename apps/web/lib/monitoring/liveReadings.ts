import { freshnessStatus } from "@/components/ui/status-indicator";
import { resolveTelemetryOrigin } from "@/lib/dataState";
import type { ObservationPoint, ObservatoryMetric, ObservatoryViewModel, TrendMetric } from "./types";

export interface LiveReading {
  station_id: "STATION_01" | "STATION_02";
  kind: "water" | "soil";
  observation_id: string;
  timestamp: string;
  measurements: Record<string, unknown>;
}

export function parseLiveReading(value: unknown): LiveReading | null {
  if (!value || typeof value !== "object") return null;
  const row = value as LiveReading;
  if ((row.station_id !== "STATION_01" || row.kind !== "water") && (row.station_id !== "STATION_02" || row.kind !== "soil")) return null;
  if (typeof row.observation_id !== "string" || typeof row.timestamp !== "string" || !Number.isFinite(Date.parse(row.timestamp))) return null;
  if (!row.measurements || typeof row.measurements !== "object" || Array.isArray(row.measurements)) return null;
  return row;
}

const WATER = { salinity: ["salinity", 2], waterLevel: ["water_level", 0], waterEc: ["water_ec_ms_cm", 3], waterTemp: ["water_temp_c", 1] } as const;
const SOIL = { moisture: ["soil_moisture_pct", 1], ec: ["soil_ec_ms_cm", 2], ph: ["soil_ph", 1], temperature: ["soil_temp_c", 1], humidity: ["air_humidity_pct", 1] } as const;
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export function applyLiveReading(model: ObservatoryViewModel, row: LiveReading): ObservatoryViewModel {
  if (model.mode !== "real") return model;
  const target = model.stations.find((s) => s.id === row.station_id);
  // Reconnect snapshots and late packets must not roll an instrument backwards.
  if (!target || (target.timestamp && Date.parse(row.timestamp) < Date.parse(target.timestamp))) return model;
  const freshness = freshnessStatus(row.timestamp);
  const updateMetric = (metric: ObservatoryMetric, domain?: string): ObservatoryMetric => {
    const mapping = row.kind === "water" ? WATER : SOIL;
    const spec = metric.labelKey ? mapping[metric.labelKey as keyof typeof mapping] as readonly [string, number] | undefined : undefined;
    if (!spec) return metric;
    const field = domain === "air" && metric.labelKey === "temperature" ? "air_temp_c" : spec[0];
    const value = number(row.measurements[field]);
    // Partial water packets retain the last probe measurement and its own timestamp.
    if (value === null && (field === "water_ec_ms_cm" || field === "water_temp_c") && metric.value !== null) return metric;
    return { ...metric, value: value?.toFixed(spec[1]) ?? null, provenance: { origin: resolveTelemetryOrigin(freshness, value !== null), source: row.kind === "water" ? "environmental_readings" : "soil_readings", observedAt: row.timestamp } };
  };
  const faults = number(row.measurements.fault_flags) ?? 0;
  const failed = faults > 0 || row.measurements.ec_probe_status === "fault" || row.measurements.ultrasonic_status === "fault";
  const stations = model.stations.map((station) => station.id !== row.station_id ? station : {
    ...station, timestamp: row.timestamp, freshness,
    quality: failed ? "error" as const : row.measurements.ec_probe_status === "unknown" || row.measurements.ultrasonic_status === "unknown" ? "estimated" as const : "valid" as const,
    primary: updateMetric(station.primary), environment: station.environment.map((group) => ({ ...group, metrics: group.metrics.map((metric) => updateMetric(metric, group.domain)) })),
  });
  const point: ObservationPoint = {
    timestamp: row.timestamp, stationId: row.station_id,
    label: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.timestamp)),
    salinity: null, waterLevel: null, waterEc: null, waterTemp: null, soilMoisture: null, soilEc: null, soilPh: null, soilTemp: null, airTemp: null, airHumidity: null, weatherTemp: null, weatherHumidity: null, weatherWind: null, weatherPrecipitation: null,
  };
  const fields: Partial<Record<TrendMetric, string>> = row.kind === "water" ? { salinity: "salinity", waterLevel: "water_level", waterEc: "water_ec_ms_cm", waterTemp: "water_temp_c" } : { soilMoisture: "soil_moisture_pct", soilEc: "soil_ec_ms_cm", soilPh: "soil_ph", soilTemp: "soil_temp_c", airTemp: "air_temp_c", airHumidity: "air_humidity_pct" };
  for (const [metric, field] of Object.entries(fields)) point[metric as TrendMetric] = number(row.measurements[field]);
  const since = Date.now() - 86400000;
  const points = [...model.series["24h"].points.filter((p) => (!p.timestamp || Date.parse(p.timestamp) >= since) && !(p.timestamp === row.timestamp && p.stationId === row.station_id)), ...(Date.parse(row.timestamp) >= since ? [point] : [])].sort((a, b) => Date.parse(a.timestamp ?? row.timestamp) - Date.parse(b.timestamp ?? row.timestamp));
  const availableMetrics = [...new Set([...model.series["24h"].availableMetrics, ...Object.keys(fields) as TrendMetric[]])].filter((key) => points.some((p) => p[key] !== null));
  const lastObservationAt = stations.map((s) => s.timestamp).filter((t): t is string => !!t).sort().at(-1) ?? null;
  return { ...model, stations, network: { ...model.network, lastObservationAt, live: stations.filter((s) => ["live", "recent"].includes(s.freshness)).length, offline: stations.filter((s) => ["stale", "offline"].includes(s.freshness)).length, noData: stations.filter((s) => !s.timestamp).length }, series: { ...model.series, "24h": { ...model.series["24h"], points, availableMetrics } } };
}
