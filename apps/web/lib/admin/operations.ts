import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * The operator console's persistence layer (migration 022).
 *
 * Everything here records OPERATOR ACTION AND INTENT. Nothing here reports
 * device state, and nothing here can: the firmware has no acknowledgement
 * path, so a stored row means "someone wrote this down", never "the device
 * did this". Every function that could be misread on that point says so at
 * its own definition.
 *
 * All access goes through the service-role client, called only from server
 * code behind `requireAdmin()`. The tables carry no anon/authenticated grants
 * and no policies (see 022), so this module is the only way in.
 */

export const MANAGED_STATION_IDS = ["STATION_01", "STATION_02", "STATION_03"] as const;
export type ManagedStationId = (typeof MANAGED_STATION_IDS)[number];

export interface AlertConfig {
  id: string;
  station_id: string;
  metric: string;
  comparison: "above" | "below";
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string | null;
  enabled: boolean;
  note: string | null;
  updated_at: string;
}

export interface MaintenanceLog {
  id: string;
  station_id: string;
  kind: string;
  performed_at: string;
  operator: string | null;
  note: string | null;
  next_due_at: string | null;
}

export interface CalibrationRecord {
  id: string;
  station_id: string;
  sensor: string;
  reference_value: number | null;
  measured_value: number | null;
  unit: string | null;
  status: string;
  performed_at: string;
  operator: string | null;
  note: string | null;
}

export interface AuditEvent {
  id: string;
  occurred_at: string;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Keys that must never reach the audit table.
 *
 * `metadata` is jsonb and takes whatever a caller passes, so the guard lives
 * here rather than in a convention. A leaked ingest token or session secret in
 * an audit row would be readable by anything with service-role access and
 * would survive in backups.
 */
const FORBIDDEN_METADATA = [
  "token",
  "secret",
  "password",
  "key",
  "authorization",
  "cookie",
];

function scrubMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowered = key.toLowerCase();
    if (FORBIDDEN_METADATA.some((banned) => lowered.includes(banned))) {
      safe[key] = "[redacted]";
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

/**
 * Append one row to the operator trail.
 *
 * Deliberately never throws: an audit write failing must not roll back or mask
 * the operator action that succeeded. A lost audit line is a smaller problem
 * than a config change that appears to have failed and gets applied twice.
 */
export async function recordAuditEvent(event: {
  actor: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("audit_events").insert({
      actor: event.actor,
      action: event.action,
      entity: event.entity ?? null,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ? scrubMetadata(event.metadata) : null,
    });
    if (error) console.error("[audit] Persistence failed", error.code);
    return !error;
  } catch {
    console.error("[audit] Persistence unavailable");
    return false;
  }
}

export async function loadAlertConfigs(): Promise<AlertConfig[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("alert_configs")
    .select("id, station_id, metric, comparison, warning_threshold, critical_threshold, unit, enabled, note, updated_at")
    .order("station_id")
    .order("metric");
  if (error) return [];
  return (data ?? []) as AlertConfig[];
}

export async function loadMaintenanceLogs(limit = 20): Promise<MaintenanceLog[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("id, station_id, kind, performed_at, operator, note, next_due_at")
    .order("performed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as MaintenanceLog[];
}

export async function loadCalibrationRecords(limit = 20): Promise<CalibrationRecord[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("calibration_records")
    .select("id, station_id, sensor, reference_value, measured_value, unit, status, performed_at, operator, note")
    .order("performed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CalibrationRecord[];
}

export async function loadAuditEvents(limit = 25): Promise<AuditEvent[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, occurred_at, actor, action, entity, entity_id, metadata")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AuditEvent[];
}

/** Narrow an untrusted form value to a managed station id. */
export function asManagedStationId(value: unknown): ManagedStationId | null {
  return typeof value === "string" && (MANAGED_STATION_IDS as readonly string[]).includes(value)
    ? (value as ManagedStationId)
    : null;
}

/** Parse an optional numeric form field; empty string means "not set". */
export function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Trim an optional text form field to null when blank. */
export function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
