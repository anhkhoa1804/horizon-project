import type {
  EnvironmentalEventRow,
  EnvironmentalReadingRow,
  IngestionAuditLogRow,
  OtaInfo,
  SoilReadingRow,
  StationHealthRow,
} from "./types.js";

export interface DbPort {
  /** Whether a device_id is a known, active row — used to check the attributed station is real even when a different device (a relaying gateway) authenticates the request. */
  isDeviceRegistered(deviceId: string): Promise<boolean>;
  insertEnvironmental(row: EnvironmentalReadingRow): Promise<"inserted" | "duplicate_ignored">;
  insertSoilReading(row: SoilReadingRow): Promise<"inserted" | "duplicate_ignored">;
  insertEvent(row: EnvironmentalEventRow): Promise<void>;
  insertAuditLog(row: IngestionAuditLogRow): Promise<void>;
  insertHealth(row: StationHealthRow): Promise<void>;
  touchDeviceSeen(deviceId: string, firmwareVersion: string, seenAt: number): Promise<void>;
  getActiveOta(deviceId: string): Promise<OtaInfo>;
}
