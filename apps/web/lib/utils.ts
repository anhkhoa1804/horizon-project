import type { Dictionary } from "@/lib/i18n/vi";
import { fmt } from "@/lib/i18n";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalinity(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}‰`;
}

export function formatWaterLevel(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)} cm`;
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function severityLabel(severity: string, dict: Dictionary): string {
  switch (severity) {
    case "critical":
      return dict.alerts.critical;
    case "warning":
      return dict.alerts.warning;
    case "info":
      return dict.alerts.info;
    default:
      return dict.alerts.normal;
  }
}

/**
 * Wire event type → dictionary key. Returns undefined for an unmapped code so
 * the caller can fall back to showing the raw type rather than inventing a
 * phrase for an event this build does not know about.
 */
export function eventTitleKey(
  eventType: string,
): "highSalinity" | "sensorFault" | "lowBattery" | "offline" | undefined {
  switch (eventType) {
    case "HIGH_SALINITY":
      return "highSalinity";
    case "SENSOR_FAULT":
      return "sensorFault";
    case "LOW_BATTERY":
      return "lowBattery";
    case "OFFLINE":
      return "offline";
    default:
      return undefined;
  }
}

export function eventTitle(eventType: string, dict: Dictionary): string {
  switch (eventType) {
    case "HIGH_SALINITY":
      return dict.alerts.highSalinity;
    case "SENSOR_FAULT":
      return dict.alerts.sensorFault;
    case "LOW_BATTERY":
      return dict.alerts.lowBattery;
    case "OFFLINE":
      return dict.alerts.offline;
    default:
      // An unmapped event type is shown raw rather than guessed at — the
      // code is more useful to an operator than an invented sentence.
      return eventType;
  }
}

export function formatAlertDetails(details: Record<string, unknown>, dict: Dictionary): string {
  const salinity = details.salinity;
  const threshold = details.threshold;
  const voltage = details.voltage;
  const signal = details.signal_strength_dbm;

  if (salinity !== undefined && threshold !== undefined) {
    return fmt(dict.alerts.salinityDetail, { value: Number(salinity).toFixed(2), threshold: Number(threshold).toFixed(2) });
  }
  if (voltage !== undefined) {
    return fmt(dict.alerts.batteryDetail, { value: Number(voltage).toFixed(2) });
  }
  if (signal !== undefined) {
    return fmt(dict.alerts.signalDetail, { value: String(signal) });
  }

  const parts = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : dict.alerts.noDetail;
}
