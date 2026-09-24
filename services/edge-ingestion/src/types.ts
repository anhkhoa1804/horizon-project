export type SensorStatusValue = "ok" | "warn" | "fault";

export interface SensorStatus {
  ec_probe: SensorStatusValue;
  ultrasonic: SensorStatusValue;
}

export interface CalibrationInfo {
  k_value?: number;
  last_calibrated_at?: number;
}

/**
 * Per-field measurement for a soil station (Trạm 2 / soil-kind devices).
 * Every field is independently nullable: six independent sensors, each
 * with its own fault status — a broken pH probe shouldn't block otherwise-
 * valid EC/moisture data. Never fabricate a value here — null means the
 * sensor didn't report, not zero.
 */
export interface SoilMeasurements {
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ec_us_cm?: number | null;
  soil_salinity?: number | null;
  soil_tds?: number | null;
  soil_ph: number | null;
}

export interface TelemetryPayloadV1 {
  contract_version: "v1";
  /**
   * Discriminates which measurement shape this payload carries. Optional
   * and defaults to "water" for backward compatibility with every existing
   * caller (tests, scripts/simulator.ts, scripts/mock_ingest.ts) that
   * predates this field and never sets it — omitting it is exactly
   * equivalent to "water", not a different, unvalidated third state.
   */
  reading_kind?: "water" | "soil";
  /** The station this bearer-authenticated gateway reading is attributed to. */
  device_id: string;
  message_id: string;
  timestamp: number;
  /** Required when reading_kind is "water" (the default); absent when "soil". */
  salinity?: number;
  salinity_ppm?: number;
  water_level?: number;
  sensor_height_cm?: number;
  distance_cm?: number;
  ec_ms_cm?: number;
  ec_us_cm?: number;
  temperature_c?: number;
  tds_ppm?: number;
  sensor_status?: SensorStatus;
  /** Required when reading_kind is "soil"; absent when "water". */
  soil?: SoilMeasurements;
  sequence?: number;
  summary_minutes?: number;
  crop?: string;
  fault_flags: number;
  /**
   * Optional: a LoRa-relayed station has no cellular modem of its own and a
   * relaying gateway can't honestly measure a remote station's battery, so
   * these are not always available. Never fabricate a value here — omit
   * the field instead.
   */
  battery_voltage?: number;
  battery_percent?: number;
  signal_strength_dbm?: number;
  firmware_version: string;
  calibration?: CalibrationInfo;
  raw_station_payload?: Record<string, unknown>;
}

export interface IngestHeaders {
  /** Pilot ingress is gateway-only and bearer-authenticated. */
  "x-gateway-token": string;
  "x-contract-version": string;
}

export interface IngestRequest {
  headers: IngestHeaders;
  payload: TelemetryPayloadV1;
}

export interface OtaInfo {
  update_available: boolean;
  target_version?: string;
  binary_url?: string;
  sha256?: string;
  size_bytes?: number;
}

export interface IngestSuccess {
  ok: true;
  status: "inserted" | "duplicate_ignored";
  station_id: string;
  message_id: string;
  server_timestamp: number;
  ota: OtaInfo;
}

export interface IngestFailure {
  ok: false;
  error_code:
    | "MISSING_FIELD"
    | "INVALID_SIGNATURE"
    | "TIMESTAMP_OUT_OF_WINDOW"
    | "DEVICE_NOT_REGISTERED"
    | "VALUE_OUT_OF_RANGE"
    | "SENSOR_FAULT"
    | "INTERNAL_ERROR";
  message: string;
  retryable: boolean;
}

export type IngestResponse = IngestSuccess | IngestFailure;

export interface EnvironmentalReadingRow {
  message_id: string;
  station_id: string;
  salinity: number | null;
  salinity_ppm?: number | null;
  water_level: number | null;
  sensor_height_cm?: number | null;
  distance_cm?: number | null;
  ec_ms_cm?: number | null;
  ec_us_cm?: number | null;
  temperature_c?: number | null;
  tds_ppm?: number | null;
  sequence?: number | null;
  summary_minutes?: number | null;
  fault_flags: number;
  ec_probe_status: SensorStatusValue;
  ultrasonic_status: SensorStatusValue;
  timestamp: number;
  raw_station_payload?: Record<string, unknown> | null;
}

export interface SoilReadingRow {
  message_id: string;
  station_id: string;
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  soil_ec_ms_cm: number | null;
  soil_ec_us_cm?: number | null;
  soil_salinity?: number | null;
  soil_tds?: number | null;
  soil_ph: number | null;
  sequence?: number | null;
  summary_minutes?: number | null;
  crop?: string | null;
  fault_flags: number;
  timestamp: number;
  raw_station_payload?: Record<string, unknown> | null;
}

export interface EnvironmentalEventRow {
  station_id: string;
  event_type: "HIGH_SALINITY" | "SENSOR_FAULT" | "LOW_BATTERY" | "OFFLINE";
  severity: "info" | "warning" | "critical";
  message_id?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface StationHealthRow {
  station_id: string;
  battery_voltage: number | null;
  battery_percent?: number | null;
  signal_strength_dbm: number | null;
  firmware_version: string;
  timestamp: number;
}

export interface IngestionAuditLogRow {
  message_id: string;
  device_id: string;
  status:
    | "accepted"
    | "duplicate"
    | "invalid_signature"
    | "expired_timestamp"
    | "sensor_fault"
    | "device_not_registered"
    | "value_out_of_range"
    | "missing_field"
    | "contract_mismatch"
    | "internal_error";
  reason: string;
  timestamp: number;
}
