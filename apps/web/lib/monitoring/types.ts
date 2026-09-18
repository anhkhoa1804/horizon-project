import type { FreshnessState, QualityState } from "@/components/ui/status-indicator";
import type { DataProvenance } from "@/lib/dataState";
import type { StationKind } from "@/lib/stationProfile";

/**
 * One coherent observatory model — the Monitoring page never assembles
 * dozens of unrelated repository results itself. Both the real and demo
 * builders (buildObservatory.ts) return exactly this shape, so the canvas
 * components render identically regardless of mode; only the data (and its
 * per-field DataProvenance) differs. This is what makes "never mix real
 * salinity with demo battery inside the same station" enforceable — the
 * whole model carries one `mode`, not a per-field flag a component could
 * forget to check.
 */

/**
 * Stable identifier for a measurement label, so the UI can render it in the
 * reader's language.
 *
 * These are deliberately CONTEXTUAL short forms — "temperature", not "soil
 * temperature" — because the metric-first canvas always renders them beneath
 * a domain heading that supplies the missing word. Repeating "soil" on every
 * reading inside a group already labelled "Soil" is noise in both languages.
 * A caller rendering a metric outside its group should fall back to `label`,
 * which keeps the fully-qualified wording.
 */
export type MetricLabelKey =
  | "salinity"
  | "waterLevel"
  | "waterEc"
  | "waterTemp"
  | "moisture"
  | "ec"
  | "ph"
  | "temperature"
  | "humidity"
  | "signal"
  | "battery"
  /* Regional context, supplied by the external weather adapter rather than
     by a HORIZON sensor. They are ordinary label keys because the canvas
     renders them with the same cell component; what marks them as external
     is their provenance, never their label. */
  | "wind"
  | "precipitation";

export interface ObservatoryMetric {
  /** Fully-qualified Vietnamese label. The fallback when no `labelKey` is set. */
  label: string;
  /** Preferred for display — resolved through the dictionary so it translates. */
  labelKey?: MetricLabelKey;
  value: string | null;
  unit?: string;
  provenance: DataProvenance;
}

export interface LocalGatewayReading {
  gateway_id?: string | null;
  station_id?: string | null;
  message_id?: string | null;
  timestamp?: number | null;
  air_temp_c?: number | null;
  soil_temp_c?: number | null;
  air_humidity_pct?: number | null;
  receivedAt?: string | null;
}

/**
 * Which physical domain a group of readings belongs to.
 *
 * A stable key, not the display label: the metric-first canvas groups
 * readings across stations by domain (all water readings together, all soil
 * readings together), and doing that by matching the Vietnamese strings
 * "Đất"/"Không khí" would break the moment the interface rendered in English.
 * The label is now derived from this key through the dictionary.
 */
export type MetricDomain = "water" | "soil" | "air";

export interface ObservatoryEnvironmentGroup {
  domain: MetricDomain;
  /** Display label. Kept for callers that render a group standalone; prefer deriving from `domain`. */
  label: string;
  metrics: ObservatoryMetric[];
}

export interface ObservatoryStation {
  id: string;
  kind: StationKind;
  name: string;
  location: string;
  lat: number;
  lng: number;
  freshness: FreshnessState;
  quality: QualityState | null;
  needsAttention: boolean;
  timestamp: string | null;
  /** The station's headline instrument reading. */
  primary: ObservatoryMetric;
  /** Kind-specific supporting readings, grouped by domain — never a uniform shape across water/soil/gateway. */
  environment: ObservatoryEnvironmentGroup[];
  /**
   * Battery/signal. Structurally separate from `environment` because its
   * real-mode behaviour differs in kind, not just value: no current firmware
   * populates these for a relayed station, so real mode always leaves this
   * empty and the UI shows one honest capability note instead of a row of
   * blanks. Demo mode fills it normally, always origin "demo".
   */
  device: ObservatoryMetric[];
  /**
   * Gateway only — a short statement of what this node does and what can
   * currently be known about it. Never a fabricated uptime/throughput.
   */
  capabilityNote: string | null;
}

// ---------------------------------------------------------------------------
// Observation log
// ---------------------------------------------------------------------------

/** Ranges backed by real repository methods — see buildObservatory for the mapping. */
export type TrendRange = "24h" | "7d" | "30d";

/**
 * Chartable metrics. Water metrics come from `environmental_readings`; the
 * six soil/air metrics come from `soil_readings` via getSoilTrend.
 *
 * A metric appearing here does not mean it will be offered — the series
 * declares `availableMetrics` per range, and the selector only renders
 * options that actually have values behind them.
 */
export type TrendMetric =
  | "waterEc"
  | "waterTemp"
  | "salinity"
  | "waterLevel"
  | "soilMoisture"
  | "soilEc"
  | "soilPh"
  | "soilTemp"
  | "airTemp"
  | "airHumidity"
  | "weatherTemp"
  | "weatherHumidity"
  | "weatherWind"
  | "weatherPrecipitation";

export interface ObservationPoint {
  /** Pre-formatted x-axis label — hour for 24h, date for 7d/30d. */
  label: string;
  salinity: number | null;
  waterLevel: number | null;
  waterEc: number | null;
  waterTemp: number | null;
  soilMoisture: number | null;
  soilEc: number | null;
  soilPh: number | null;
  soilTemp: number | null;
  airTemp: number | null;
  airHumidity: number | null;
  weatherTemp: number | null;
  weatherHumidity: number | null;
  weatherWind: number | null;
  weatherPrecipitation: number | null;
}

export interface ObservationSeries {
  points: ObservationPoint[];
  /** Metrics with at least one real value in this range — drives which toggles render. */
  availableMetrics: TrendMetric[];
  provenance: DataProvenance;
}

export interface ObservatoryAlert {
  id: string;
  stationName: string;
  severity: "info" | "warning" | "critical";
  /**
   * Raw fallback, shown only when the event type has no dictionary entry —
   * an unmapped code is more useful to an operator than an invented phrase.
   */
  title: string;
  /**
   * Preferred for display, resolved through the dictionary at render time.
   * Same pattern as ObservatoryMetric.labelKey, and for the same reason: the
   * view model is built once on the server and must not bake in a language.
   */
  titleKey?: "highSalinity" | "sensorFault" | "lowBattery" | "offline";
  message: string;
  timestamp: string;
  provenance: DataProvenance;
}

/**
 * A reference entry's evidentiary standing. Kept distinct from DataOrigin:
 * that describes where a *measurement* came from; this describes how well a
 * *guideline* is supported. Collapsing them would let an internal engineering
 * assumption inherit the visual authority of a cited standard.
 */
export type ReferenceStanding = "external" | "internal" | "unverified";

export interface ObservatoryReferenceItem {
  title: string;
  standing: ReferenceStanding;
  /** Threshold rows. Empty when no number can be responsibly shown. */
  rows: { range: string; meaning: string }[];
  /** Prose shown when rows are empty, or as a caveat alongside them. */
  detail: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
}

export interface ObservatoryNetworkState {
  total: number;
  live: number;
  offline: number;
  noData: number;
  alertsNeedingAttention: number;
  /** Newest observation across the whole network, or null when nothing has ever arrived. */
  lastObservationAt: string | null;
  provenance: DataProvenance;
}

export interface ObservatoryViewModel {
  mode: "real" | "demo";
  /**
   * The project's configured salinity warning/critical levels, or null when
   * no crop row is configured.
   *
   * Carried on the model rather than re-derived in the UI because it is the
   * ONLY basis this system has for colouring an environmental reading. A
   * component that guessed a band would be inventing a claim; a null here
   * means the canvas renders that metric neutral, which is the truthful
   * result when nothing has been configured.
   */
  salinityThreshold: { warningLevel: number; criticalLevel: number } | null;
  network: ObservatoryNetworkState;
  stations: ObservatoryStation[];
  /** Precomputed for every range so switching is instant and refetch-free. */
  series: Record<TrendRange, ObservationSeries>;
  alerts: ObservatoryAlert[];
  reference: ObservatoryReferenceItem[];
}
