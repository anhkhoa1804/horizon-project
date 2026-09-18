import type { DataProvenance } from "@/lib/dataState";
import type { ObservationPoint, ObservationSeries, TrendMetric } from "./types";

const WEATHER_METRICS: TrendMetric[] = [
  "weatherTemp",
  "weatherHumidity",
  "weatherWind",
  "weatherPrecipitation",
];

export interface WeatherHistoryPoint {
  time: string;
  temperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  precipitationMm: number | null;
}

export interface WeatherHistory {
  points: WeatherHistoryPoint[];
  source: string;
  sourceUrl: string;
  area: string;
}

function timeLabel(iso: string) {
  const localTime = iso.match(/T(\d{2}:\d{2})/)?.[1];
  return localTime ?? iso;
}

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

export function weatherHistoryToObservationSeries(
  history: WeatherHistory | null,
): ObservationSeries | null {
  if (!history || history.points.length === 0) return null;

  const provenance: DataProvenance = {
    origin: "external",
    source: history.source,
    sourceUrl: history.sourceUrl,
    observedAt: history.points.at(-1)?.time,
  };

  const points = history.points.map((point) => ({
    ...blankPoint(timeLabel(point.time)),
    weatherTemp: point.temperatureC,
    weatherHumidity: point.humidityPct,
    weatherWind: point.windKph,
    weatherPrecipitation: point.precipitationMm,
  }));

  return {
    points,
    availableMetrics: WEATHER_METRICS.filter((metric) => points.some((point) => point[metric] !== null)),
    provenance,
  };
}

export function mergeWeather24hSeries(
  base: ObservationSeries,
  weather: ObservationSeries | null,
): ObservationSeries {
  if (!weather) return base;

  const basePoints = base.points.filter((point) => WEATHER_METRICS.every((metric) => point[metric] === null));
  const availableMetrics = base.availableMetrics.filter((metric) => !WEATHER_METRICS.includes(metric));
  for (const metric of weather.availableMetrics) {
    if (!availableMetrics.includes(metric)) availableMetrics.push(metric);
  }

  return {
    points: [...basePoints, ...weather.points],
    availableMetrics,
    provenance: base.provenance,
  };
}
