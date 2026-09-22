import {
  applyStationIdScope,
  applyStationScope,
  canAccessStation,
  isMissingTableError,
  type AppSupabase,
} from "./base";
import type {
  DailyComparisonPoint,
  DailySoilPoint,
  EnvironmentalReading,
  RepositoryScope,
  SalinityThreshold,
  SoilReading,
  SoilTrendPoint,
  StationHealthLog,
  StationReadingSnapshot,
  TrendPoint,
} from "@/types";
import { StationRepository } from "./stationRepository";

const WEAK_SIGNAL_DBM = -95;

function dateKey(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function shortDateLabel(key: string): string {
  const date = new Date(`${key}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function localCalendarKey(daysAgo: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  // Vietnam has no daylight-saving transition. Build the requested local
  // calendar day first, then convert its midnight to the same dateKey path
  // used for readings; subtracting 24h from a runner-local instant is wrong
  // for UTC CI during Cồn Hô's first seven hours of a day.
  const localDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - daysAgo, -7));
  return dateKey(localDate.toISOString());
}

function mapReading(row: Record<string, unknown>): EnvironmentalReading {
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    station_id: row.station_id as string,
    salinity: Number(row.salinity),
    water_level: Number(row.water_level),
    water_ec_ms_cm: numberOrNull(row.water_ec_ms_cm),
    water_temp_c: numberOrNull(row.water_temp_c),
    fault_flags: Number(row.fault_flags),
    ec_probe_status: row.ec_probe_status as EnvironmentalReading["ec_probe_status"],
    ultrasonic_status: row.ultrasonic_status as EnvironmentalReading["ultrasonic_status"],
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

function numberOrNull(value: unknown): number | null {
  // Number(null) is 0 in JS — that would silently turn "not measured" into
  // a fabricated-looking zero reading, so null must be checked explicitly
  // before coercing.
  return value === null || value === undefined ? null : Number(value);
}

function mapHealth(row: Record<string, unknown>): StationHealthLog {
  return {
    id: row.id as string,
    station_id: row.station_id as string,
    battery_voltage: numberOrNull(row.battery_voltage),
    signal_strength_dbm: numberOrNull(row.signal_strength_dbm),
    firmware_version: row.firmware_version as string,
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

function mapSoilReading(row: Record<string, unknown>): SoilReading {
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    station_id: row.station_id as string,
    air_temp_c: numberOrNull(row.air_temp_c),
    air_humidity_pct: numberOrNull(row.air_humidity_pct),
    soil_temp_c: numberOrNull(row.soil_temp_c),
    soil_moisture_pct: numberOrNull(row.soil_moisture_pct),
    soil_ec_ms_cm: numberOrNull(row.soil_ec_ms_cm),
    soil_ph: numberOrNull(row.soil_ph),
    fault_flags: Number(row.fault_flags),
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

export class ReadingRepository {
  constructor(private readonly supabase: AppSupabase) {}

  /** No fabricated curve — genuinely missing data renders as null, not invented values. */
  private emptyDailyComparison(days: number): DailyComparisonPoint[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return {
        date: shortDateLabel(dateKey(date.toISOString())),
        tideLevel: null,
        salinity: null,
        waterEc: null,
        waterTemp: null,
        soilEc: null,
        readingCount: 0,
      };
    });
  }

  async getLatestByStation(stationId: string, scope: RepositoryScope): Promise<EnvironmentalReading | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("environmental_readings")
      .select("id, message_id, station_id, salinity, water_level, water_ec_ms_cm, water_temp_c, fault_flags, ec_probe_status, ultrasonic_status, timestamp, created_at")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapReading(data) : null;
  }

  async getLatestSoilReadingByStation(stationId: string, scope: RepositoryScope): Promise<SoilReading | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("soil_readings")
      .select("id, message_id, station_id, air_temp_c, air_humidity_pct, soil_temp_c, soil_moisture_pct, soil_ec_ms_cm, soil_ph, fault_flags, timestamp, created_at")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapSoilReading(data) : null;
  }

  /**
   * Soil observations for one station, oldest-first — the time-series
   * counterpart to getLatestSoilReadingByStation.
   *
   * Filters and orders on `timestamp` (the observation time stamped by the
   * gateway), never `created_at` (database insertion time). Those differ
   * whenever the gateway queues and retries a send, so ordering by
   * `created_at` would reorder a backfilled batch into the wrong sequence.
   *
   * `limit` is applied to the NEWEST rows, not the oldest: the query orders
   * descending, takes the cap, then reverses into chronological order. A
   * naive ascending+limit would silently return only the beginning of a wide
   * window and render a chart that looks complete but stops early.
   *
   * Null measurements are preserved as null — a sensor that did not report
   * is not the same as a sensor that reported zero.
   *
   * Uses idx_soil_readings_station_time (station_id, timestamp desc) from
   * migration 019, which already covers this exact filter+order; no new
   * index is required.
   */
  async getSoilTrend(
    stationId: string,
    scope: RepositoryScope,
    options: { sinceIso?: string; untilIso?: string; limit?: number } = {},
  ): Promise<SoilTrendPoint[]> {
    if (!canAccessStation(scope, stationId)) {
      return [];
    }

    const { sinceIso, untilIso, limit = 1000 } = options;

    let query = this.supabase
      .from("soil_readings")
      .select("timestamp, air_temp_c, air_humidity_pct, soil_temp_c, soil_moisture_pct, soil_ec_ms_cm, soil_ph")
      .eq("station_id", stationId);

    if (sinceIso) query = query.gte("timestamp", sinceIso);
    if (untilIso) query = query.lte("timestamp", untilIso);

    const { data, error } = await query.order("timestamp", { ascending: false }).limit(limit);

    if (isMissingTableError(error)) return [];
    if (error) throw error;

    return (data ?? [])
      .map((row) => ({
        timestamp: row.timestamp as string,
        air_temp_c: numberOrNull(row.air_temp_c),
        air_humidity_pct: numberOrNull(row.air_humidity_pct),
        soil_temp_c: numberOrNull(row.soil_temp_c),
        soil_moisture_pct: numberOrNull(row.soil_moisture_pct),
        soil_ec_ms_cm: numberOrNull(row.soil_ec_ms_cm),
        soil_ph: numberOrNull(row.soil_ph),
      }))
      .reverse();
  }

  async getLatestHealthByStation(stationId: string, scope: RepositoryScope): Promise<StationHealthLog | null> {
    if (!canAccessStation(scope, stationId)) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("station_health_logs")
      .select("*")
      .eq("station_id", stationId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapHealth(data) : null;
  }

  async getLatestForAllStations(scope: RepositoryScope): Promise<Map<string, EnvironmentalReading>> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Use resource embedding to get the latest reading PER station.
    // This eliminates the global 500-row truncation problem.
    let query = this.supabase
      .from("stations")
      .select(`
        id,
        environmental_readings (
          id, message_id, station_id, salinity, water_level, water_ec_ms_cm,
          water_temp_c, fault_flags, ec_probe_status, ultrasonic_status,
          timestamp, created_at
        )
      `)
      .gte("environmental_readings.timestamp", since)
      .order("timestamp", { foreignTable: "environmental_readings", ascending: false })
      .limit(1, { foreignTable: "environmental_readings" });

    query = applyStationIdScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return new Map();
    if (error) throw error;

    const map = new Map<string, EnvironmentalReading>();
    for (const row of (data ?? [])) {
      const readings = row.environmental_readings as Record<string, unknown>[];
      if (readings && readings.length > 0) {
        map.set(row.id, mapReading(readings[0]));
      }
    }
    return map;
  }

  async getLatestHealthForAllStations(scope: RepositoryScope): Promise<Map<string, StationHealthLog>> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Use resource embedding to get the latest health log PER station.
    let query = this.supabase
      .from("stations")
      .select(`
        id,
        station_health_logs (
          *
        )
      `)
      .gte("station_health_logs.timestamp", since)
      .order("timestamp", { foreignTable: "station_health_logs", ascending: false })
      .limit(1, { foreignTable: "station_health_logs" });

    query = applyStationIdScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return new Map();
    if (error) throw error;

    const map = new Map<string, StationHealthLog>();
    for (const row of (data ?? [])) {
      const logs = row.station_health_logs as Record<string, unknown>[];
      if (logs && logs.length > 0) {
        map.set(row.id, mapHealth(logs[0]));
      }
    }
    return map;
  }

  async getSnapshots(scope: RepositoryScope): Promise<StationReadingSnapshot[]> {
    const stationRepo = new StationRepository(this.supabase);
    const [stations, readings, healthLogs] = await Promise.all([
      stationRepo.getAll(scope),
      this.getLatestForAllStations(scope),
      this.getLatestHealthForAllStations(scope),
    ]);

    return stations.map((station) => ({
      station,
      reading: readings.get(station.id) ?? null,
      health: healthLogs.get(station.id) ?? null,
    }));
  }

  async getTrend24h(stationId: string, scope: RepositoryScope): Promise<TrendPoint[]> {
    if (!canAccessStation(scope, stationId)) {
      return [];
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from("environmental_readings")
      .select("timestamp, salinity, water_level, water_ec_ms_cm, water_temp_c")
      .eq("station_id", stationId)
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    if (isMissingTableError(error)) return [];
    if (error) throw error;

    return (data ?? []).map((row) => ({
      timestamp: row.timestamp as string,
      salinity: Number(row.salinity),
      water_level: Number(row.water_level),
      water_ec_ms_cm: numberOrNull(row.water_ec_ms_cm),
      water_temp_c: numberOrNull(row.water_temp_c),
    }));
  }

  async getDailyComparison(scope: RepositoryScope, days = 7): Promise<DailyComparisonPoint[]> {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from("environmental_readings")
      .select("timestamp, station_id, salinity, water_level, water_ec_ms_cm, water_temp_c")
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    query = applyStationScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return this.emptyDailyComparison(days);
    if (error) throw error;

    const buckets = new Map<
      string,
      {
        salinity: number[];
        tideLevel: number[];
        waterEc: number[];
        waterTemp: number[];
        soilEc: number[];
      }
    >();

    for (const row of data ?? []) {
      const key = dateKey(row.timestamp as string);
      const bucket = buckets.get(key) ?? { salinity: [], tideLevel: [], waterEc: [], waterTemp: [], soilEc: [] };

      // environmental_readings only carries salinity/water_level — soil EC
      // has no real column here and must never be derived from these fields.
      bucket.salinity.push(Number(row.salinity));
      bucket.tideLevel.push(Number(row.water_level));
      const waterEc = numberOrNull(row.water_ec_ms_cm);
      const waterTemp = numberOrNull(row.water_temp_c);
      if (waterEc !== null) bucket.waterEc.push(waterEc);
      if (waterTemp !== null) bucket.waterTemp.push(waterTemp);

      buckets.set(key, bucket);
    }

    const keys = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 24 * 60 * 60 * 1000);
      return dateKey(date.toISOString());
    });

    const average = (values: number[], decimals: number): number | null =>
      values.length > 0
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(decimals))
        : null;

    return keys.map((key) => {
      const bucket = buckets.get(key);

      return {
        date: shortDateLabel(key),
        tideLevel: average(bucket?.tideLevel ?? [], 1),
        salinity: average(bucket?.salinity ?? [], 2),
        waterEc: average(bucket?.waterEc ?? [], 3),
        waterTemp: average(bucket?.waterTemp ?? [], 1),
        soilEc: average(bucket?.soilEc ?? [], 2),
        readingCount: (bucket?.tideLevel.length ?? 0) + (bucket?.salinity.length ?? 0),
      };
    });
  }

  /**
   * Daily soil averages for one station — the 7D/30D counterpart to
   * getSoilTrend's per-reading series.
   *
   * Deliberately separate from getDailyComparison rather than folded into
   * it: that method is a network-wide aggregate across every accessible
   * station (it takes no stationId) over environmental_readings, whereas
   * soil is per-station and carries six metrics. Merging them would force
   * six permanently-null columns onto every water row — the same modelling
   * smell as the vestigial `soilEc` field already sitting unused there.
   *
   * Buckets by Asia/Ho_Chi_Minh calendar day via the shared dateKey helper,
   * so a 23:30 local reading lands on its local date rather than the next
   * UTC one. Every metric averages independently, so one silent probe never
   * suppresses the others, and days with no readings are still returned with
   * null metrics so a gap stays visible in the series.
   */
  async getDailySoilTrend(stationId: string, scope: RepositoryScope, days = 7): Promise<DailySoilPoint[]> {
    if (!canAccessStation(scope, stationId)) {
      return this.emptyDailySoil(days);
    }

    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from("soil_readings")
      .select("timestamp, air_temp_c, air_humidity_pct, soil_temp_c, soil_moisture_pct, soil_ec_ms_cm, soil_ph")
      .eq("station_id", stationId)
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    if (isMissingTableError(error)) return this.emptyDailySoil(days);
    if (error) throw error;

    const metrics = [
      "air_temp_c",
      "air_humidity_pct",
      "soil_temp_c",
      "soil_moisture_pct",
      "soil_ec_ms_cm",
      "soil_ph",
    ] as const;

    const buckets = new Map<string, { values: Record<(typeof metrics)[number], number[]>; rows: number }>();

    for (const row of data ?? []) {
      const key = dateKey(row.timestamp as string);
      const bucket =
        buckets.get(key) ??
        {
          values: {
            air_temp_c: [],
            air_humidity_pct: [],
            soil_temp_c: [],
            soil_moisture_pct: [],
            soil_ec_ms_cm: [],
            soil_ph: [],
          },
          rows: 0,
        };

      for (const metric of metrics) {
        const value = numberOrNull(row[metric]);
        // A null probe contributes nothing rather than dragging the mean
        // toward zero.
        if (value !== null) bucket.values[metric].push(value);
      }
      bucket.rows += 1;
      buckets.set(key, bucket);
    }

    return this.soilDayKeys(days).map(({ key, label }) => {
      const bucket = buckets.get(key);
      const avg = (metric: (typeof metrics)[number], decimals: number) => {
        const values = bucket?.values[metric] ?? [];
        return values.length > 0
          ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(decimals))
          : null;
      };

      return {
        date: label,
        air_temp_c: avg("air_temp_c", 1),
        air_humidity_pct: avg("air_humidity_pct", 1),
        soil_temp_c: avg("soil_temp_c", 1),
        soil_moisture_pct: avg("soil_moisture_pct", 1),
        soil_ec_ms_cm: avg("soil_ec_ms_cm", 2),
        soil_ph: avg("soil_ph", 1),
        readingCount: bucket?.rows ?? 0,
      };
    });
  }

  /** The last `days` local-calendar days, oldest first. */
  private soilDayKeys(days: number): { key: string; label: string }[] {
    return Array.from({ length: days }, (_, index) => {
      const key = localCalendarKey(days - index - 1);
      return { key, label: shortDateLabel(key) };
    });
  }

  /** Shape-preserving empty result — same day slots, every metric null. */
  private emptyDailySoil(days: number): DailySoilPoint[] {
    return this.soilDayKeys(days).map(({ label }) => ({
      date: label,
      air_temp_c: null,
      air_humidity_pct: null,
      soil_temp_c: null,
      soil_moisture_pct: null,
      soil_ec_ms_cm: null,
      soil_ph: null,
      readingCount: 0,
    }));
  }

  /** null, not 0 — an average of zero readings is undefined, not a measured zero. */
  async getAverageSalinity(scope: RepositoryScope): Promise<number | null> {
    const readings = await this.getLatestForAllStations(scope);
    const values = [...readings.values()].map((r) => r.salinity);
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  async countWeakSignalNodes(scope: RepositoryScope): Promise<number> {
    const health = await this.getLatestHealthForAllStations(scope);
    return [...health.values()].filter(
      (h) => typeof h.signal_strength_dbm === "number" && h.signal_strength_dbm <= WEAK_SIGNAL_DBM,
    ).length;
  }

  async getDefaultSalinityThreshold(): Promise<SalinityThreshold | null> {
    const { data, error } = await this.supabase
      .from("crop_thresholds")
      .select("crop_name, salinity_warning_level, salinity_critical_level")
      .order("salinity_critical_level", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      cropName: data.crop_name as string,
      warningLevel: Number(data.salinity_warning_level),
      criticalLevel: Number(data.salinity_critical_level),
    };
  }
}
