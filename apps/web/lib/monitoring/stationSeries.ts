import type { StationKind } from "@/lib/stationProfile";
import type { ObservationSeries, TrendMetric, TrendRange } from "./types";

const METRICS: Record<StationKind, TrendMetric[]> = {
  water: ["salinity", "waterLevel", "waterEc", "waterTemp"],
  soil: ["soilMoisture", "soilEc", "soilPh", "soilTemp", "airTemp", "airHumidity"],
  gateway: [],
};

/** Instrument trends never inherit another station or external provider. */
export function stationTrendSeries(series: Record<TrendRange, ObservationSeries>, kind: StationKind): Record<TrendRange, ObservationSeries> {
  const scope = METRICS[kind];
  const filter = (range: TrendRange): ObservationSeries => {
    const source = series[range];
    const points = source.points.filter((point) => scope.some((metric) => point[metric] !== null));
    return { ...source, points, availableMetrics: source.availableMetrics.filter((metric) => scope.includes(metric) && points.some((point) => point[metric] !== null)) };
  };
  return { "24h": filter("24h"), "7d": filter("7d"), "30d": filter("30d") };
}
