export type StationStatus = "active" | "inactive" | "maintenance";
export type AlertSeverity = "info" | "warning" | "critical";
export type EventType = "HIGH_SALINITY" | "SENSOR_FAULT" | "LOW_BATTERY" | "OFFLINE";
export type SensorStatus = "ok" | "warn" | "fault" | "unknown";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: StationStatus;
  created_at: string;
}

export interface EnvironmentalReading {
  id: string;
  message_id: string;
  station_id: string;
  salinity: number;
  water_level: number;
  /** Raw water conductivity reported by Station 01. Never inferred from salinity. */
  water_ec_ms_cm?: number | null;
  /** Water temperature reported by the EC probe. */
  water_temp_c?: number | null;
  fault_flags: number;
  ec_probe_status: SensorStatus;
  ultrasonic_status: SensorStatus;
  timestamp: string;
  created_at: string;
}

export interface SoilReading {
  id: string;
  message_id: string;
  station_id: string;
  /** Six independent Trạm 2 sensors — each nullable; a faulted probe reports null, never a substituted number (infra/supabase/migrations/019_soil_readings.sql). */
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ph: number | null;
  fault_flags: number;
  timestamp: string;
  created_at: string;
}

export interface StationHealthLog {
  id: string;
  station_id: string;
  /** Not every station can report these (see docs/ARCHITECTURE_DECISIONS.md) — null means genuinely unmeasured, never fabricated. */
  battery_voltage: number | null;
  signal_strength_dbm: number | null;
  firmware_version: string;
  timestamp: string;
  created_at: string;
}

export interface EnvironmentalEvent {
  id: string;
  station_id: string;
  event_type: EventType;
  severity: AlertSeverity;
  message_id: string | null;
  details: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface StationReadingSnapshot {
  station: Station;
  reading: EnvironmentalReading | null;
  health: StationHealthLog | null;
}

export interface DashboardMetrics {
  activeStations: number;
  totalStations: number;
  averageSalinity: number | null;
  criticalAlerts: number;
  weakSignalNodes: number;
}

export interface DailyComparisonPoint {
  date: string;
  tideLevel: number | null;
  salinity: number | null;
  waterEc: number | null;
  waterTemp: number | null;
  soilEc: number | null;
  readingCount: number;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "farmer" | "admin" | null;
  phone: string | null;
  assignedStationIds: string[];
}

export interface TrendPoint {
  timestamp: string;
  salinity: number;
  water_level: number;
  water_ec_ms_cm: number | null;
  water_temp_c: number | null;
}

/**
 * One soil observation in a time series. Mirrors `soil_readings`' column
 * names and nullability exactly (migration 019): all six measurements come
 * from independent sensors on Trạm 2, and any one of them can be null while
 * the others report normally. Null means "this sensor did not report" — it
 * is never collapsed to 0.
 *
 * Units are carried in the column names and fixed by the schema:
 *   air_temp_c, soil_temp_c    → °C        numeric(5,1)
 *   air_humidity_pct,
 *   soil_moisture_pct          → %         numeric(5,1)
 *   soil_ec_ms_cm              → mS/cm     numeric(6,2)
 *   soil_ph                    → unitless  numeric(4,1)
 *
 * `timestamp` is the observation time recorded by the gateway, not the
 * database insertion time (`created_at`) — see getSoilTrend.
 */
export interface SoilTrendPoint {
  timestamp: string;
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ph: number | null;
}

/**
 * One calendar day of soil observations, averaged per metric.
 *
 * Days are bucketed in Asia/Ho_Chi_Minh (the repository-wide convention —
 * see dateKey in readingRepository.ts), so a reading at 23:30 local belongs
 * to that local day rather than the following UTC one.
 *
 * Each metric averages independently: a day where the pH probe was silent
 * but the moisture probe reported yields a real `soil_moisture_pct` and a
 * null `soil_ph`. Null always means "no observation", never zero, and days
 * with no readings at all appear with every metric null rather than being
 * dropped — the caller needs the gap to be visible.
 */
export interface DailySoilPoint {
  /** Short display label, same formatting as DailyComparisonPoint.date. */
  date: string;
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ph: number | null;
  /** Rows that fell in this day, across all metrics. 0 for an empty day. */
  readingCount: number;
}

export interface SalinityThreshold {
  cropName: string;
  warningLevel: number;
  criticalLevel: number;
}

export type UserRole = "farmer" | "admin";

export interface RepositoryScope {
  userId: string;
  /**
   * "public" is the anon/public-read path (see lib/publicRead.ts) — never
   * a genuinely authenticated user's role. Treated the same as "admin" for
   * read-scoping purposes (no application-layer station filter — the real
   * boundary there is Postgres RLS), but kept as its own distinct,
   * honestly-named value so it's never mistaken for a real admin session
   * by future code that checks scope.role.
   */
  role: UserRole | "public";
  /** Assigned station IDs for farmers; ignored for admins/public (full read access). */
  stationIds: string[];
}
