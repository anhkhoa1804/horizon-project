import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { ApplicationProfile, ThresholdRow, SoilWaterModel, WaterLevelContext } from "./thresholdTypes";

/**
 * Server-side reads of the threshold registry (migration 023).
 *
 * The loaders live apart from the types and pure helpers in
 * `thresholdTypes.ts`, because they hold a service-role client and must never
 * be bundled for the browser — while the public registry table is a client
 * component that still needs to format a band.
 *
 * THE INTERLOCK, restated where it matters: `is_active` decides whether a row
 * produces status. A row can carry an impeccable citation and colour nothing;
 * that is the normal state for published guidance, and the database itself
 * refuses to activate anything still marked REFERENCE.
 */

export async function loadThresholdRegistry(): Promise<ThresholdRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("threshold_registry")
    .select(
      "id, metric_key, quantity, unit, threshold_value, upper_value, comparison, severity, basis, source_title, source_url, source_locator, scope, validation_status, is_active, notes, effective_from",
    )
    .order("metric_key")
    .order("threshold_value");
  if (error) return [];
  return (data ?? []) as ThresholdRow[];
}

export async function loadSoilWaterModels(): Promise<SoilWaterModel[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("soil_water_models")
    .select(
      "station_id, field_capacity_pct, permanent_wilting_point_pct, management_allowed_depletion_pct, irrigation_trigger_pct, source_note",
    )
    .order("station_id");
  if (error) return [];
  return (data ?? []) as SoilWaterModel[];
}

export async function loadApplicationProfiles(): Promise<ApplicationProfile[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("application_profiles")
    .select("key, title, description, available_metrics, needed_metrics, available_thresholds, unvalidated_thresholds, maturity")
    .order("key");
  if (error) return [];
  return (data ?? []) as ApplicationProfile[];
}

export async function loadWaterLevelContexts(): Promise<WaterLevelContext[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("water_level_contexts")
    .select("station_id, sensor_datum_cm, shore_bank_elevation_cm, critical_infrastructure_elevation_cm, survey_note, validation_status")
    .order("station_id");
  if (error) return [];
  return (data ?? []) as WaterLevelContext[];
}
