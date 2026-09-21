import type { DbPort } from "./dbPort.js";
import type { EnvironmentalEventRow, EnvironmentalReadingRow, IngestionAuditLogRow, OtaInfo, SoilReadingRow, StationHealthRow } from "./types.js";

export class MockDb implements DbPort {
  private readonly messageIds = new Set<string>();
  // Separate from messageIds: soil_readings.message_id (migration 019) is a
  // unique constraint scoped to its own table, independent of
  // environmental_readings.message_id — mirroring the real schema.
  private readonly soilMessageIds = new Set<string>();
  private readonly healthKeys = new Set<string>();
  private readonly eventKeys = new Set<string>();
  private readonly auditKeys = new Set<string>();
  private readonly environmentalReadings: EnvironmentalReadingRow[] = [];
  private readonly soilReadings: SoilReadingRow[] = [];
  private readonly environmentalEvents: EnvironmentalEventRow[] = [];
  private readonly auditLogs: IngestionAuditLogRow[] = [];
  private readonly healthLogs: StationHealthRow[] = [];

  public constructor(
    private readonly registeredDevices: Record<string, string> = {},
    private readonly otaCatalog: Record<string, OtaInfo> = {},
    /** Additional registered device ids for bearer-authenticated tests. */
    private readonly registeredOnlyDevices: string[] = [],
  ) {}

  public async isDeviceRegistered(deviceId: string): Promise<boolean> {
    return deviceId in this.registeredDevices || this.registeredOnlyDevices.includes(deviceId);
  }

  public async insertEnvironmental(row: EnvironmentalReadingRow): Promise<"inserted" | "duplicate_ignored"> {
    if (this.messageIds.has(row.message_id)) {
      return "duplicate_ignored";
    }

    this.messageIds.add(row.message_id);
    this.environmentalReadings.push(row);
    return "inserted";
  }

  public async insertSoilReading(row: SoilReadingRow): Promise<"inserted" | "duplicate_ignored"> {
    if (this.soilMessageIds.has(row.message_id)) {
      return "duplicate_ignored";
    }

    this.soilMessageIds.add(row.message_id);
    this.soilReadings.push(row);
    return "inserted";
  }

  public async insertEvent(row: EnvironmentalEventRow): Promise<void> {
    const key = `${row.station_id}|${row.event_type}|${row.timestamp}|${row.message_id ?? ""}`;
    if (this.eventKeys.has(key)) {
      return;
    }

    this.eventKeys.add(key);
    this.environmentalEvents.push(row);
  }

  public async insertAuditLog(row: IngestionAuditLogRow): Promise<void> {
    const key = `${row.message_id}|${row.device_id}|${row.status}|${row.timestamp}`;
    if (this.auditKeys.has(key)) {
      return;
    }

    this.auditKeys.add(key);
    this.auditLogs.push(row);
  }

  public async insertHealth(row: StationHealthRow): Promise<void> {
    const key = `${row.station_id}|${row.timestamp}|${row.firmware_version}`;
    if (this.healthKeys.has(key)) {
      return;
    }

    this.healthKeys.add(key);
    this.healthLogs.push(row);
  }

  public async touchDeviceSeen(_deviceId: string, _firmwareVersion: string, _seenAt: number): Promise<void> {
    return;
  }

  public async getActiveOta(deviceId: string): Promise<OtaInfo> {
    return this.otaCatalog[deviceId] ?? { update_available: false };
  }

  public getSnapshot(): {
    environmentalReadings: EnvironmentalReadingRow[];
    soilReadings: SoilReadingRow[];
    environmentalEvents: EnvironmentalEventRow[];
    auditLogs: IngestionAuditLogRow[];
    healthLogs: StationHealthRow[];
  } {
    return {
      environmentalReadings: [...this.environmentalReadings],
      soilReadings: [...this.soilReadings],
      environmentalEvents: [...this.environmentalEvents],
      auditLogs: [...this.auditLogs],
      healthLogs: [...this.healthLogs],
    };
  }
}
