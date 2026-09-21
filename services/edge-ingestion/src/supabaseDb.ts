import type { DbPort } from "./dbPort.js";
import type { EnvironmentalEventRow, EnvironmentalReadingRow, IngestionAuditLogRow, OtaInfo, SoilReadingRow, StationHealthRow } from "./types.js";

interface RestResult {
  ok: boolean;
  status: number;
  text: string;
}

export class SupabaseDb implements DbPort {
  public constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
  ) {}

  public static fromEnv(env: Record<string, string | undefined> = process.env): SupabaseDb {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing Supabase env vars");
    }
    return new SupabaseDb(url.replace(/\/$/, ""), key);
  }

  private async request(table: string, method: string, body?: unknown, query = ""): Promise<RestResult> {
    const headers: Record<string, string> = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}${query}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return { ok: response.ok, status: response.status, text: await response.text() };
  }

  public async isDeviceRegistered(deviceId: string): Promise<boolean> {
    const result = await this.request(
      "devices",
      "GET",
      undefined,
      `?device_id=eq.${encodeURIComponent(deviceId)}&select=status&limit=1`,
    );

    if (!result.ok) {
      return false;
    }

    const rows = JSON.parse(result.text) as Array<{ status?: string }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }

    return !rows[0].status || rows[0].status === "active";
  }

  public async insertEnvironmental(row: EnvironmentalReadingRow): Promise<"inserted" | "duplicate_ignored"> {
    const result = await this.request("environmental_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      salinity: row.salinity,
      salinity_ppm: row.salinity_ppm,
      water_level: row.water_level,
      sensor_height_cm: row.sensor_height_cm,
      distance_cm: row.distance_cm,
      ec_ms_cm: row.ec_ms_cm,
      ec_us_cm: row.ec_us_cm,
      temperature_c: row.temperature_c,
      tds_ppm: row.tds_ppm,
      sequence: row.sequence,
      summary_minutes: row.summary_minutes,
      fault_flags: row.fault_flags,
      ec_probe_status: row.ec_probe_status,
      ultrasonic_status: row.ultrasonic_status,
      timestamp: new Date(row.timestamp * 1000).toISOString(),
      raw_station_payload: row.raw_station_payload,
    });

    if (result.ok) {
      return "inserted";
    }

    if (result.status === 409 || result.text.includes("duplicate") || result.text.includes("23505")) {
      return "duplicate_ignored";
    }

    throw new Error(result.text || `insert failed with status ${result.status}`);
  }

  public async insertSoilReading(row: SoilReadingRow): Promise<"inserted" | "duplicate_ignored"> {
    const result = await this.request("soil_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      air_temp_c: row.air_temp_c,
      air_humidity_pct: row.air_humidity_pct,
      soil_temp_c: row.soil_temp_c,
      soil_moisture_pct: row.soil_moisture_pct,
      soil_ec_ms_cm: row.soil_ec_ms_cm,
      soil_ec_us_cm: row.soil_ec_us_cm,
      soil_salinity: row.soil_salinity,
      soil_tds: row.soil_tds,
      soil_ph: row.soil_ph,
      sequence: row.sequence,
      summary_minutes: row.summary_minutes,
      crop: row.crop,
      fault_flags: row.fault_flags,
      timestamp: new Date(row.timestamp * 1000).toISOString(),
      raw_station_payload: row.raw_station_payload,
    });

    if (result.ok) {
      return "inserted";
    }

    if (result.status === 409 || result.text.includes("duplicate") || result.text.includes("23505")) {
      return "duplicate_ignored";
    }

    throw new Error(result.text || `insert failed with status ${result.status}`);
  }

  public async insertEvent(row: EnvironmentalEventRow): Promise<void> {
    const result = await this.request("environmental_events", "POST", {
      station_id: row.station_id,
      event_type: row.event_type,
      severity: row.severity,
      message_id: row.message_id,
      details: row.details ?? {},
      timestamp: new Date(row.timestamp * 1000).toISOString(),
    });

    if (!result.ok) {
      throw new Error(result.text || `event insert failed with status ${result.status}`);
    }
  }

  public async insertAuditLog(row: IngestionAuditLogRow): Promise<void> {
    await this.request("ingestion_audit_logs", "POST", {
      message_id: row.message_id,
      device_id: row.device_id,
      status: row.status,
      reason: row.reason,
      timestamp: new Date(row.timestamp * 1000).toISOString(),
    }).catch(() => undefined);
  }

  public async insertHealth(row: StationHealthRow): Promise<void> {
    const result = await this.request("station_health_logs", "POST", {
      station_id: row.station_id,
      battery_voltage: row.battery_voltage,
      battery_percent: row.battery_percent,
      signal_strength_dbm: row.signal_strength_dbm,
      firmware_version: row.firmware_version,
      timestamp: new Date(row.timestamp * 1000).toISOString(),
    });

    if (!result.ok) {
      throw new Error(result.text || `health insert failed with status ${result.status}`);
    }
  }

  public async touchDeviceSeen(deviceId: string, firmwareVersion: string, seenAt: number): Promise<void> {
    await this.request(
      "devices",
      "PATCH",
      { last_seen_at: new Date(seenAt * 1000).toISOString(), firmware_version: firmwareVersion },
      `?device_id=eq.${encodeURIComponent(deviceId)}`,
    ).catch(() => undefined);
  }

  public async getActiveOta(deviceId: string): Promise<OtaInfo> {
    const result = await this.request(
      "firmware_updates",
      "GET",
      undefined,
      `?device_id=eq.${encodeURIComponent(deviceId)}&active=eq.true&select=target_version,binary_url,sha256,size_bytes&limit=1`,
    );

    if (!result.ok) {
      return { update_available: false };
    }

    const rows = JSON.parse(result.text) as Array<{
      target_version?: string;
      binary_url?: string;
      sha256?: string;
      size_bytes?: number;
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return { update_available: false };
    }

    return {
      update_available: true,
      target_version: rows[0].target_version,
      binary_url: rows[0].binary_url,
      sha256: rows[0].sha256,
      size_bytes: rows[0].size_bytes,
    };
  }
}
