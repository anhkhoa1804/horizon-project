/** Deprecated settings-only helpers. New writes use remoteProtocol.ts contract v1. */
export const RUNTIME_HARDWARE_LIMITATION = {
  polling_enabled: false,
  station_receiver_enabled: true,
  sample_interval_supported: true,
  mode_supported: true,
  acknowledgement_supported: true,
  application_verified: false,
} as const;
export const RUNTIME_STATION_IDS = ["STATION_01", "STATION_02"] as const;
export interface RuntimeSettings {
  station_id: string;
  sample_interval_seconds: number;
  sleep_interval_seconds: number;
  mode: string;
}
export function validateRuntimeSettings(input: RuntimeSettings): boolean {
  return (RUNTIME_STATION_IDS as readonly string[]).includes(input.station_id) &&
    Number.isInteger(input.sample_interval_seconds) && input.sample_interval_seconds >= 5 && input.sample_interval_seconds <= 86400 &&
    Number.isInteger(input.sleep_interval_seconds) && input.sleep_interval_seconds >= 0 && input.sleep_interval_seconds <= 86400 &&
    ["normal", "rain_saver", "maintenance"].includes(input.mode);
}
export function sameRuntimeSettings(a: RuntimeSettings, b: RuntimeSettings): boolean {
  return a.station_id === b.station_id && a.sample_interval_seconds === b.sample_interval_seconds &&
    a.sleep_interval_seconds === b.sleep_interval_seconds && a.mode === b.mode;
}
/** Retrieval is not delivery, a telemetry ACK is not a configuration ACK. */
export function runtimeStorageState(updatedAt?: string): "STORED" | "UNSET" {
  return updatedAt ? "STORED" : "UNSET";
}
