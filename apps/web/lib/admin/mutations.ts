import "server-only";

import { adminAllowedEmails, normalizeEmail } from "@/lib/auth/adminAllowlist";
import { asManagedStationId, optionalText, runAuditedAdminWrite, type AdminWriteOutcome } from "@/lib/admin/operations";
import { createServiceClient } from "@/lib/supabase/service";

export interface AdminMutationActor { id: string; email: string | null; }
export type AdminMutationResult = AdminWriteOutcome | "invalid_input" | "unavailable";

function nullableUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function readOptionalNumber(formData: FormData, name: string): { valid: boolean; value: number | null } {
  const raw = formData.get(name);
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return { valid: true, value: null };
  if (typeof raw !== "string") return { valid: false, value: null };
  const value = Number(raw);
  return Number.isFinite(value) ? { valid: true, value } : { valid: false, value: null };
}
function client() { return createServiceClient(); }

export async function mutateAddAdminEmail(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!email || !email.includes("@")) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  const { data: existingRows, error: lookupError } = await supabase.from("admin_allowed_emails").select("id").eq("email", email).order("created_at", { ascending: false }).limit(1);
  if (lookupError) return "write_failed";
  const existing = existingRows?.[0] as { id: string } | undefined;
  return runAuditedAdminWrite(async () => {
    const result = existing
      ? await supabase.from("admin_allowed_emails").update({ active: true, note, created_by: nullableUuid(user.id), revoked_at: null }).eq("id", existing.id).select("id")
      : await supabase.from("admin_allowed_emails").insert({ email, note, created_by: nullableUuid(user.id), active: true }).select("id");
    return { error: result.error, count: result.data?.length ?? 0 };
  }, { actor: user.email, action: "admin.allowlist.saved", entity: "admin_allowed_emails", entityId: email, metadata: { active: true } });
}

export async function mutateRemoveAdminEmail(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email || adminAllowedEmails().includes(email)) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => {
    const result = await supabase.from("admin_allowed_emails").update({ active: false, revoked_at: new Date().toISOString() }).eq("email", email).eq("active", true).select("id");
    return { error: result.error, count: result.data?.length ?? 0 };
  }, { actor: user.email, action: "admin.allowlist.revoked", entity: "admin_allowed_emails", entityId: email, metadata: { active: false } });
}

export async function mutateMarkReportViewed(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const reportId = String(formData.get("report_id") ?? ""); if (!reportId) return "not_found";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => {
    const result = await supabase.from("damage_logs").update({ viewed_at: new Date().toISOString(), viewed_by: nullableUuid(user.id), status: "reviewing" }).eq("id", reportId).select("id");
    return { error: result.error, count: result.data?.length ?? 0 };
  }, { actor: user.email, action: "report.viewed", entity: "damage_logs", entityId: reportId });
}

export async function mutateSaveAlertConfig(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const stationId = asManagedStationId(formData.get("station_id")); const metric = optionalText(formData.get("metric")); const comparison = formData.get("comparison");
  const warning = readOptionalNumber(formData, "warning_threshold"); const critical = readOptionalNumber(formData, "critical_threshold");
  if (!stationId || !metric || (comparison !== "above" && comparison !== "below") || !warning.valid || !critical.valid ||
    (warning.value !== null && critical.value !== null && (comparison === "above" ? warning.value > critical.value : warning.value < critical.value))) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  const row = { station_id: stationId, metric, comparison, warning_threshold: warning.value, critical_threshold: critical.value, unit: optionalText(formData.get("unit")), enabled: formData.get("enabled") === "on", note: optionalText(formData.get("note")), updated_by: nullableUuid(user.id) };
  return runAuditedAdminWrite(async () => { const result = await supabase.from("alert_configs").upsert(row, { onConflict: "station_id,metric" }).select("id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "alert.config.saved", entity: "alert_configs", entityId: `${stationId}:${metric}`, metadata: { comparison: row.comparison, warning: row.warning_threshold, critical: row.critical_threshold, enabled: row.enabled } });
}

export async function mutateAddMaintenanceLog(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const stationId = asManagedStationId(formData.get("station_id")); const kind = optionalText(formData.get("kind")); if (!stationId || !kind) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => { const result = await supabase.from("maintenance_logs").insert({ station_id: stationId, kind, operator: optionalText(formData.get("operator")) ?? user.email, note: optionalText(formData.get("note")), next_due_at: optionalText(formData.get("next_due_at")) }).select("id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "maintenance.recorded", entity: "maintenance_logs", entityId: stationId, metadata: { kind } });
}

export async function mutateAddCalibrationRecord(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const stationId = asManagedStationId(formData.get("station_id")); const sensor = optionalText(formData.get("sensor")); const reference = readOptionalNumber(formData, "reference_value"); const measured = readOptionalNumber(formData, "measured_value");
  if (!stationId || !sensor || !reference.valid || !measured.valid) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => { const result = await supabase.from("calibration_records").insert({ station_id: stationId, sensor, reference_value: reference.value, measured_value: measured.value, unit: optionalText(formData.get("unit")), operator: optionalText(formData.get("operator")) ?? user.email, note: optionalText(formData.get("note")) }).select("id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "calibration.recorded", entity: "calibration_records", entityId: `${stationId}:${sensor}`, metadata: { sensor } });
}

export async function mutateSaveSoilWaterModel(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const fc = readOptionalNumber(formData, "field_capacity_pct"); const pwp = readOptionalNumber(formData, "permanent_wilting_point_pct"); const mad = readOptionalNumber(formData, "management_allowed_depletion_pct");
  if (!fc.valid || !pwp.valid || !mad.valid || fc.value === null || pwp.value === null || mad.value === null || pwp.value >= fc.value) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => { const result = await supabase.from("soil_water_models").upsert({ station_id: "STATION_02", field_capacity_pct: fc.value, permanent_wilting_point_pct: pwp.value, management_allowed_depletion_pct: mad.value, source_note: optionalText(formData.get("source_note")), updated_by: nullableUuid(user.id) }).select("station_id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "site.soil_water_model.saved", entity: "soil_water_models", entityId: "STATION_02", metadata: { fieldCapacity: fc.value, wiltingPoint: pwp.value, mad: mad.value, availableWater: fc.value - pwp.value } });
}

export async function mutateSaveWaterLevelContext(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const datum = readOptionalNumber(formData, "sensor_datum_cm"); const shore = readOptionalNumber(formData, "shore_bank_elevation_cm"); const infrastructure = readOptionalNumber(formData, "critical_infrastructure_elevation_cm");
  if (!datum.valid || !shore.valid || !infrastructure.valid) return "invalid_input";
  const supabase = client(); if (!supabase) return "unavailable";
  const row = { station_id: "STATION_01", sensor_datum_cm: datum.value, shore_bank_elevation_cm: shore.value, critical_infrastructure_elevation_cm: infrastructure.value, survey_note: optionalText(formData.get("survey_note")), validation_status: "PILOT", updated_by: nullableUuid(user.id) };
  return runAuditedAdminWrite(async () => { const result = await supabase.from("water_level_contexts").upsert(row).select("station_id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "site.water_level_context.saved", entity: "water_level_contexts", entityId: "STATION_01", metadata: { validationStatus: "PILOT", geometryRecorded: true } });
}

export async function mutateResolveReport(formData: FormData, user: AdminMutationActor): Promise<AdminMutationResult> {
  const reportId = String(formData.get("report_id") ?? ""); if (!reportId) return "not_found";
  const supabase = client(); if (!supabase) return "unavailable";
  return runAuditedAdminWrite(async () => { const result = await supabase.from("damage_logs").update({ status: "resolved" }).eq("id", reportId).select("id"); return { error: result.error, count: result.data?.length ?? 0 }; },
    { actor: user.email, action: "report.resolved", entity: "damage_logs", entityId: reportId });
}
