import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { NetworkOverview } from "@/components/admin/network-overview";
import {
  AlertConfigPanel,
  ApplicationProfilesPanel,
  ThresholdRegistryPanel,
  AuditPanel,
  CalibrationPanel,
  DataExportPanel,
  MaintenancePanel,
  SiteModelsPanel,
} from "@/components/admin/operations-panels";
import { loadApplicationProfiles, loadThresholdRegistry, loadSoilWaterModels, loadWaterLevelContexts } from "@/lib/monitoring/thresholds";
import {
  asManagedStationId,
  loadAlertConfigs,
  loadAuditEvents,
  loadCalibrationRecords,
  loadMaintenanceLogs,
  optionalNumber,
  optionalText,
  recordAuditEvent,
} from "@/lib/admin/operations";
import { redirect } from "next/navigation";
import { Bell, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  adminAllowedEmails,
  loadAdminAllowedEmailEntries,
  normalizeEmail,
} from "@/lib/auth/adminAllowlist";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getSessionContext } from "@/lib/auth/session";
import { createRepositories } from "@/lib/repositories";
import { listDemoReports, markDemoReportViewed } from "@/lib/reports/demoReportStore";
import { createServiceClient } from "@/lib/supabase/service";
import type { Station, StationReadingSnapshot } from "@/types";

const managedStationIds = ["STATION_01", "STATION_02", "STATION_03"];

interface RuntimeConfig {
  station_id: string;
  sample_interval_seconds: number;
  sleep_interval_seconds: number;
  mode: string;
  updated_at?: string;
}

interface CommunityReport {
  id: string;
  description: string | null;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
  viewed_at: string | null;
}

function stationStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Đang hoạt động";
    case "maintenance":
      return "Bảo trì";
    case "offline":
    case "inactive":
      return "Ngoại tuyến";
    default:
      return status;
  }
}

function defaultConfig(stationId: string): RuntimeConfig {
  return {
    station_id: stationId,
    sample_interval_seconds: 300,
    sleep_interval_seconds: 300,
    mode: "normal",
  };
}

function nullableUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function demoAdminStations(): Station[] {
  const now = new Date().toISOString();
  return [
    {
      id: "STATION_01",
      name: "Trạm Nước",
      lat: 10.0,
      lng: 106.0,
      status: "active",
      created_at: now,
    },
    {
      id: "STATION_02",
      name: "Trạm Đất",
      lat: 10.0,
      lng: 106.0,
      status: "active",
      created_at: now,
    },
    {
      id: "STATION_03",
      name: "Gateway",
      lat: 10.0,
      lng: 106.0,
      status: "active",
      created_at: now,
    },
  ];
}

async function requireAdmin() {
  const { user, profile, scope } = await getSessionContext();

  if (!user) {
    redirect("/admin/login");
  }

  if (!profile || profile.role !== "admin" || !scope) {
    redirect("/admin/login?error=unauthorized");
  }

  return { user, profile, scope };
}

async function loadRuntimeConfigs(): Promise<RuntimeConfig[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return managedStationIds.map(defaultConfig);
  }

  const { data, error } = await supabase
    .from("device_runtime_configs")
    .select("station_id, sample_interval_seconds, sleep_interval_seconds, mode, updated_at")
    .in("station_id", managedStationIds)
    .order("station_id");

  if (error) {
    return managedStationIds.map(defaultConfig);
  }

  return managedStationIds.map(
    (stationId) => data?.find((row) => row.station_id === stationId) ?? defaultConfig(stationId),
  );
}

async function loadAdminStations(
  repos: ReturnType<typeof createRepositories> | null,
  scope: Awaited<ReturnType<typeof requireAdmin>>["scope"],
): Promise<{ stations: Station[]; demo: boolean }> {
  if (!repos) {
    return { stations: demoAdminStations(), demo: true };
  }

  try {
    return { stations: await repos.stations.getAll(scope), demo: false };
  } catch {
    return { stations: demoAdminStations(), demo: true };
  }
}

async function loadAdminSnapshots(
  repos: ReturnType<typeof createRepositories> | null,
  scope: Awaited<ReturnType<typeof requireAdmin>>["scope"],
  fallbackStations: Station[],
): Promise<StationReadingSnapshot[]> {
  if (!repos) {
    return fallbackStations.map((station) => ({ station, reading: null, health: null }));
  }

  try {
    return await repos.readings.getSnapshots(scope);
  } catch {
    return fallbackStations.map((station) => ({ station, reading: null, health: null }));
  }
}

async function loadAdminMetrics(
  repos: ReturnType<typeof createRepositories> | null,
  scope: Awaited<ReturnType<typeof requireAdmin>>["scope"],
): Promise<{ active: number; total: number; demo: boolean }> {
  if (!repos) {
    return { active: 3, total: 3, demo: true };
  }

  try {
    const counts = await repos.stations.getActiveCount(scope);
    return { ...counts, demo: false };
  } catch {
    return { active: 3, total: 3, demo: true };
  }
}

async function loadCommunityReports(): Promise<CommunityReport[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return listDemoReports();
  }

  const { data, error } = await supabase
    .from("damage_logs")
    .select("id, description, status, lat, lng, timestamp, viewed_at")
    .order("timestamp", { ascending: false })
    .limit(20);

  if (error) {
    return listDemoReports();
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: row.timestamp as string,
    viewed_at: (row.viewed_at as string | null) ?? null,
  }));
}

async function updateRuntimeConfig(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const stationId = String(formData.get("station_id") ?? "");
  if (!managedStationIds.includes(stationId)) {
    redirect("/admin?error=invalid-station");
  }

  const sampleInterval = Number(formData.get("sample_interval_seconds"));
  const sleepInterval = Number(formData.get("sleep_interval_seconds"));
  const mode = String(formData.get("mode") ?? "normal");

  const supabase = createServiceClient();
  if (!supabase) {
    redirect("/admin?error=missing-supabase");
  }

  await supabase.from("device_runtime_configs").upsert({
    station_id: stationId,
    sample_interval_seconds: Math.max(5, Math.min(86400, Math.round(sampleInterval))),
    sleep_interval_seconds: Math.max(0, Math.min(86400, Math.round(sleepInterval))),
    mode: ["normal", "rain_saver", "maintenance"].includes(mode) ? mode : "normal",
    updated_by: nullableUuid(user.id),
  });

  await recordAuditEvent({
    actor: user.email,
    action: "runtime.config.stored",
    entity: "device_runtime_configs",
    entityId: stationId,
    metadata: { state: "stored_awaiting_device_poll", sampleInterval, sleepInterval, mode },
  });

  revalidatePath("/admin");
}

async function addAdminEmail(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!email || !email.includes("@")) {
    redirect("/admin?error=invalid-email");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect("/admin?error=missing-supabase");
  }

  const { data: existingRows } = await supabase
    .from("admin_allowed_emails")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = existingRows?.[0] as { id: string } | undefined;
  if (existing) {
    await supabase
      .from("admin_allowed_emails")
      .update({
        active: true,
        note,
        created_by: nullableUuid(user.id),
        revoked_at: null,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("admin_allowed_emails").insert({
      email,
      note,
      created_by: nullableUuid(user.id),
      active: true,
    });
  }

  revalidatePath("/admin");
}

async function removeAdminEmail(formData: FormData) {
  "use server";

  await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email || adminAllowedEmails().includes(email)) {
    redirect("/admin?error=cannot-remove-env-email");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect("/admin?error=missing-supabase");
  }

  await supabase
    .from("admin_allowed_emails")
    .update({
      active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("email", email)
    .eq("active", true);

  revalidatePath("/admin");
}

async function markReportViewed(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) {
    redirect("/admin");
  }

  if (reportId.startsWith("demo-")) {
    markDemoReportViewed(reportId);
    revalidatePath("/admin");
    return;
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect("/admin?error=missing-supabase");
  }

  await supabase
    .from("damage_logs")
    .update({
      viewed_at: new Date().toISOString(),
      viewed_by: nullableUuid(user.id),
      status: "reviewing",
    })
    .eq("id", reportId);

  revalidatePath("/admin");
}


/**
 * Operator-workflow writes (migration 022).
 *
 * Each one persists to Postgres and appends an audit line. None of them sends
 * anything to a device: the firmware has no command or acknowledgement path,
 * so these record what an operator DID or DECIDED, never what a node applied.
 */
async function saveAlertConfig(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const stationId = asManagedStationId(formData.get("station_id"));
  const metric = optionalText(formData.get("metric"));
  if (!stationId || !metric) redirect("/admin?error=invalid-alert");

  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");

  const row = {
    station_id: stationId,
    metric,
    comparison: formData.get("comparison") === "below" ? "below" : "above",
    warning_threshold: optionalNumber(formData.get("warning_threshold")),
    critical_threshold: optionalNumber(formData.get("critical_threshold")),
    unit: optionalText(formData.get("unit")),
    enabled: formData.get("enabled") === "on",
    note: optionalText(formData.get("note")),
    updated_by: nullableUuid(user.id),
  };

  await supabase.from("alert_configs").upsert(row, { onConflict: "station_id,metric" });
  await recordAuditEvent({
    actor: user.email,
    action: "alert.config.saved",
    entity: "alert_configs",
    entityId: `${stationId}:${metric}`,
    metadata: {
      comparison: row.comparison,
      warning: row.warning_threshold,
      critical: row.critical_threshold,
      enabled: row.enabled,
    },
  });

  revalidatePath("/admin");
}

async function addMaintenanceLog(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const stationId = asManagedStationId(formData.get("station_id"));
  const kind = optionalText(formData.get("kind"));
  if (!stationId || !kind) redirect("/admin?error=invalid-maintenance");

  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");

  await supabase.from("maintenance_logs").insert({
    station_id: stationId,
    kind,
    operator: optionalText(formData.get("operator")) ?? user.email,
    note: optionalText(formData.get("note")),
    next_due_at: optionalText(formData.get("next_due_at")),
  });

  await recordAuditEvent({
    actor: user.email,
    action: "maintenance.recorded",
    entity: "maintenance_logs",
    entityId: stationId,
    metadata: { kind },
  });

  revalidatePath("/admin");
}

async function addCalibrationRecord(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const stationId = asManagedStationId(formData.get("station_id"));
  const sensor = optionalText(formData.get("sensor"));
  if (!stationId || !sensor) redirect("/admin?error=invalid-calibration");

  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");

  await supabase.from("calibration_records").insert({
    station_id: stationId,
    sensor,
    reference_value: optionalNumber(formData.get("reference_value")),
    measured_value: optionalNumber(formData.get("measured_value")),
    unit: optionalText(formData.get("unit")),
    operator: optionalText(formData.get("operator")) ?? user.email,
    note: optionalText(formData.get("note")),
  });

  await recordAuditEvent({
    actor: user.email,
    action: "calibration.recorded",
    entity: "calibration_records",
    entityId: `${stationId}:${sensor}`,
    metadata: { sensor },
  });

  revalidatePath("/admin");
}

async function saveSoilWaterModel(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const fieldCapacity = optionalNumber(formData.get("field_capacity_pct"));
  const wiltingPoint = optionalNumber(formData.get("permanent_wilting_point_pct"));
  const mad = optionalNumber(formData.get("management_allowed_depletion_pct"));
  if (fieldCapacity === null || wiltingPoint === null || mad === null || wiltingPoint >= fieldCapacity) {
    redirect("/admin?error=invalid-site-model");
  }
  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");
  await supabase.from("soil_water_models").upsert({
    station_id: "STATION_02",
    field_capacity_pct: fieldCapacity,
    permanent_wilting_point_pct: wiltingPoint,
    management_allowed_depletion_pct: mad,
    source_note: optionalText(formData.get("source_note")),
    updated_by: nullableUuid(user.id),
  });
  await recordAuditEvent({
    actor: user.email,
    action: "site.soil_water_model.saved",
    entity: "soil_water_models",
    entityId: "STATION_02",
    metadata: { fieldCapacity, wiltingPoint, mad, availableWater: fieldCapacity - wiltingPoint },
  });
  revalidatePath("/admin");
}

async function saveWaterLevelContext(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");
  const row = {
    station_id: "STATION_01",
    sensor_datum_cm: optionalNumber(formData.get("sensor_datum_cm")),
    shore_bank_elevation_cm: optionalNumber(formData.get("shore_bank_elevation_cm")),
    critical_infrastructure_elevation_cm: optionalNumber(formData.get("critical_infrastructure_elevation_cm")),
    survey_note: optionalText(formData.get("survey_note")),
    validation_status: "PILOT",
    updated_by: nullableUuid(user.id),
  };
  await supabase.from("water_level_contexts").upsert(row);
  await recordAuditEvent({
    actor: user.email,
    action: "site.water_level_context.saved",
    entity: "water_level_contexts",
    entityId: "STATION_01",
    metadata: { validationStatus: "PILOT", geometryRecorded: true },
  });
  revalidatePath("/admin");
}

async function resolveReport(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId || reportId.startsWith("demo-")) redirect("/admin");

  const supabase = createServiceClient();
  if (!supabase) redirect("/admin?error=missing-supabase");

  // The existing damage_logs row is UPDATED, never copied into a parallel
  // store: the public submission stays the source of record.
  await supabase.from("damage_logs").update({ status: "resolved" }).eq("id", reportId);

  await recordAuditEvent({
    actor: user.email,
    action: "report.resolved",
    entity: "damage_logs",
    entityId: reportId,
  });

  revalidatePath("/admin");
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "rain_saver":
      return "Tiết kiệm mùa mưa";
    case "maintenance":
      return "Bảo trì";
    default:
      return "Bình thường";
  }
}

function formatReportTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function reportTitle(description: string | null): string {
  if (!description) {
    return "Báo cáo hiện trường";
  }

  const match = description.match(/^\[([^\]]+)\]/);
  if (!match) {
    return "Báo cáo hiện trường";
  }

  switch (match[1]) {
    case "erosion":
      return "Xói lở bờ sông";
    case "flooding":
      return "Ngập nước / thủy triều";
    case "pollution":
      return "Ô nhiễm";
    case "infrastructure":
      return "Hư hại hạ tầng";
    case "sensor":
      return "Lỗi trạm quan trắc";
    default:
      return "Báo cáo khác";
  }
}

function cleanReportDescription(description: string | null): string {
  if (!description) {
    return "Không có mô tả.";
  }

  return description.replace(/^\[[^\]]+\]\s*/, "").replace(/^\[station:[^\]]+\]\s*/, "");
}

function adminErrorMessage(error?: string): string | null {
  switch (error) {
    case "invalid-email":
      return "Email chưa hợp lệ. Vui lòng nhập đúng địa chỉ Gmail/email.";
    case "cannot-remove-env-email":
      return "Email gốc trong ADMIN_ALLOWED_EMAILS không thể thu hồi từ giao diện.";
    case "missing-supabase":
      return "Supabase chưa cấu hình đủ nên chưa thể lưu thay đổi.";
    case "invalid-site-model":
      return "Mô hình đất chưa hợp lệ: PWP phải nhỏ hơn FC và mọi giá trị phải là số.";
    default:
      return null;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { profile, scope } = await requireAdmin();
  const { dict } = await getI18n();

  const supabase = createServiceClient();
  const repos = supabase ? createRepositories(supabase) : null;
  const [{ stations, demo: stationsAreDemo }, metrics, runtimeConfigs, reports, allowedEmailEntries] = await Promise.all([
    loadAdminStations(repos, scope),
    loadAdminMetrics(repos, scope),
    loadRuntimeConfigs(),
    loadCommunityReports(),
    loadAdminAllowedEmailEntries(),
  ]);
  const snapshots = await loadAdminSnapshots(repos, scope, stations);
  // STATION_02 records its time on soil_readings, not environmental_readings —
  // reading only the snapshot would report the soil node as silent while it is
  // in fact reporting. Same asymmetry the public page handles.
  const [alertConfigs, maintenanceLogs, calibrationRecords, auditEvents, thresholds, soilModels, applicationProfiles, waterContexts] =
    await Promise.all([
      loadAlertConfigs(),
      loadMaintenanceLogs(),
      loadCalibrationRecords(),
      loadAuditEvents(),
      loadThresholdRegistry(),
      loadSoilWaterModels(),
      loadApplicationProfiles(),
      loadWaterLevelContexts(),
    ]);
  const soilTimestamp = repos
    ? await repos.readings
        .getLatestSoilReadingByStation("STATION_02", scope)
        .then((row) => row?.timestamp ?? null)
        .catch(() => null)
    : null;
  const unreadReports = reports.filter((report) => !report.viewed_at).length;
  const errorMessage = adminErrorMessage(params.error);
  const isDemoMode = stationsAreDemo || metrics.demo;

  const reportBell = (
    <details className="relative">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/30">
        <span className="relative flex items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden />
          Báo cáo
          {unreadReports > 0 ? (
            <span className="absolute -right-4 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-xs text-white">
              {unreadReports}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="absolute right-0 z-[var(--z-dropdown)] mt-2 w-[min(92vw,520px)] rounded-lg border border-border bg-background p-3 shadow-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-semibold">Báo cáo hiện trường</p>
          <p className="text-xs text-muted">{unreadReports} chưa xem</p>
        </div>
        <div className="max-h-[520px] overflow-y-auto pr-1">
          {reports.length === 0 ? (
            <p className="p-4 text-sm text-muted">Chưa có báo cáo nào.</p>
          ) : (
            <div className="border-t border-border/60">
              {reports.map((report) => {
                const unread = !report.viewed_at;
                return (
                  <div
                    key={report.id}
                    className={`space-y-2 border-b border-border/60 py-3 ${unread ? "" : "opacity-70"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{reportTitle(report.description)}</p>
                          {report.id.startsWith("demo-") ? <Tag>Lưu tạm — chưa vào Supabase</Tag> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted">{formatReportTime(report.timestamp)}</p>
                      </div>
                      {unread ? <Badge variant="risk">Mới</Badge> : <Badge>Đã xem</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{cleanReportDescription(report.description)}</p>
                    <p className="text-xs text-muted">
                      Vị trí: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                    </p>
                    {unread ? (
                      <form action={markReportViewed}>
                        <input type="hidden" name="report_id" value={report.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Đánh dấu đã xem
                        </Button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </details>
  );

  return (
    <AdminShell
      title="Bảng điều khiển"
      description="Trạng thái mạng lưới, báo cáo hiện trường và cấu hình thiết bị."
      email={profile.email}
      actions={
        <>
          {reportBell}
          <SignOutButton />
        </>
      }
    >
      <span id="reports" className="scroll-mt-36" aria-hidden />
      {errorMessage ? <Alert tone="critical">{errorMessage}</Alert> : null}

      {isDemoMode ? (
        <Alert tone="warning">
          <strong className="font-semibold">Dữ liệu mẫu — chưa kết nối Supabase.</strong> Số liệu trạm và số trạm
          hoạt động bên dưới không phải dữ liệu thật; chúng sẽ được thay bằng dữ liệu thực khi backend được cấu
          hình và kết nối.
        </Alert>
      ) : null}

      <nav aria-label="Khu vực vận hành" className="sticky top-20 z-20 -mx-2 flex gap-1 overflow-x-auto rounded-lg border border-border bg-background/95 p-2 text-xs shadow-sm backdrop-blur">
        {[
          ["network", "Network"], ["devices", "Devices"], ["thresholds", "Thresholds"],
          ["profiles", "Application Profiles"], ["calibration", "Calibration"], ["maintenance", "Maintenance"],
          ["reports", "Reports"], ["export", "Data Export"], ["audit", "Audit"], ["runtime", "Runtime Configuration"],
        ].map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-3 py-2 hover:bg-muted/30">{label}</a>)}
      </nav>

      {/* The operator's first question — is the network up, and which node is
          not? Above the settings forms, because "what is wrong right now" is
          needed before "what can I configure". */}
      <div id="network" className="scroll-mt-36"><NetworkOverview snapshots={snapshots} soilTimestamp={soilTimestamp} /></div>

      {/* Operator workflows, all persisted by migration 022. Each panel states
          in its own lead what its rows do and do not mean — none of them
          reaches a device, because the firmware has no command or
          acknowledgement path. */}
      {/* The registry first: what the system believes, and what it is actually
          acting on. The operator's own thresholds below are a smaller thing and
          read better after it. */}
      <div id="thresholds" className="scroll-mt-36 space-y-4">
        <ThresholdRegistryPanel rows={thresholds} soilModels={soilModels} />
        <AlertConfigPanel configs={alertConfigs} action={saveAlertConfig} />
      </div>
      <div id="profiles" className="scroll-mt-36"><ApplicationProfilesPanel profiles={applicationProfiles} /></div>
      <div id="calibration" className="scroll-mt-36 space-y-4">
        <SiteModelsPanel soilModels={soilModels} waterContexts={waterContexts} soilAction={saveSoilWaterModel} waterAction={saveWaterLevelContext} />
        <CalibrationPanel records={calibrationRecords} action={addCalibrationRecord} />
      </div>
      <div id="maintenance" className="scroll-mt-36"><MaintenancePanel logs={maintenanceLogs} action={addMaintenanceLog} /></div>
      <div id="export" className="scroll-mt-36"><DataExportPanel /></div>
      <div id="audit" className="scroll-mt-36"><AuditPanel events={auditEvents} /></div>

      <div id="devices" className="grid scroll-mt-36 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Tổng quan trạm</CardTitle>
                {isDemoMode ? <Tag>Dữ liệu mẫu</Tag> : null}
              </div>
              <CardDescription>Số trạm đang hiển thị trong phạm vi quản trị</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold">
                {metrics.active}/{metrics.total}
              </p>
              <p className="text-sm text-muted">trạm đang hoạt động</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lối tắt công khai</CardTitle>
              <CardDescription>Đi đến các trang bà con đang xem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href="/dashboard" className="block text-accent hover:underline">
                Bảng quan trắc
              </Link>
              <Link href="/report" className="block text-accent hover:underline">
                Báo cáo hiện trường
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Gmail được phép quản trị</CardTitle>
              <CardDescription>
                Thêm email tại đây để người đó đăng nhập bằng mật khẩu và mở được trang quản trị.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={addAdminEmail} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input id="admin-email" name="email" type="email" placeholder="ten@gmail.com" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-note">Ghi chú</Label>
                  <Input id="admin-note" name="note" placeholder="Ví dụ: phụ trách vận hành" />
                </div>
                <Button type="submit" className="self-end">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Thêm
                </Button>
              </form>

              <div className="border-t border-border">
                {allowedEmailEntries.length > 0 ? (
                  allowedEmailEntries.map((entry) => (
                    <div
                      key={`${entry.source}-${entry.email}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-all text-sm font-medium">{entry.email}</p>
                          <Tag>{entry.source === "env" ? "Gốc" : "Database"}</Tag>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {entry.note ?? "Không có ghi chú"}
                        </p>
                      </div>
                      {entry.source === "database" ? (
                        <form action={removeAdminEmail}>
                          <input type="hidden" name="email" value={entry.email} />
                          <Button type="submit" variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" aria-hidden />
                            Thu hồi
                          </Button>
                        </form>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-xs text-muted">
                          <ShieldCheck className="h-4 w-4" aria-hidden />
                          Sửa trong env
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="border-b border-border py-3 text-sm text-warning">
                    Chưa có email quản trị nào. Hãy thêm email gốc vào ADMIN_ALLOWED_EMAILS trước.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quản lý dung lượng dữ liệu</CardTitle>
              <CardDescription>Giữ dữ liệu đủ lâu nhưng tránh phình chi phí Supabase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>Dữ liệu raw của trạm và gateway đang được thiết kế giữ khoảng 1 năm.</p>
              <p>Log kiểm tra kỹ thuật có thể dọn sớm hơn, khoảng 90 ngày.</p>
              <p>Khi số lượng bản ghi tăng, bật hàm cleanup_horizon_data theo lịch để dọn dữ liệu cũ.</p>
            </CardContent>
          </Card>
        </div>

        <Card id="runtime" className="scroll-mt-36">
          <CardHeader>
            <CardTitle>Cấu hình vận hành</CardTitle>
            <CardDescription>
              Khi mưa kéo dài, tăng thời gian ngủ để ba trạm tiết kiệm pin. Lưu ở đây là{" "}
              <strong className="font-semibold text-foreground">đã ghi vào cơ sở dữ liệu</strong> — gateway sẽ nhận
              cấu hình mới ở lần hỏi tiếp theo. Hệ thống hiện chưa có đường phản hồi từ thiết bị, nên không thể xác
              nhận thiết bị đã áp dụng hay chưa.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {runtimeConfigs.map((config) => (
              <form key={config.station_id} action={updateRuntimeConfig} className="border-t border-border/60 pt-4">
                <input type="hidden" name="station_id" value={config.station_id} />
                <div className="mb-4">
                  <p className="font-semibold">{config.station_id}</p>
                  <p className="mt-1 text-sm text-muted">Chế độ hiện tại: {modeLabel(config.mode)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {config.updated_at ? `Cập nhật lần cuối: ${formatReportTime(config.updated_at)}` : "Chưa từng chỉnh cấu hình"}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${config.station_id}-sample`}>Chu kỳ đo/gửi (giây)</Label>
                    <Input
                      id={`${config.station_id}-sample`}
                      name="sample_interval_seconds"
                      type="number"
                      min={5}
                      max={86400}
                      defaultValue={config.sample_interval_seconds}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${config.station_id}-sleep`}>Thời gian ngủ (giây)</Label>
                    <Input
                      id={`${config.station_id}-sleep`}
                      name="sleep_interval_seconds"
                      type="number"
                      min={0}
                      max={86400}
                      defaultValue={config.sleep_interval_seconds}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${config.station_id}-mode`}>Chế độ</Label>
                    <Select id={`${config.station_id}-mode`} name="mode" defaultValue={config.mode}>
                      <option value="normal">Bình thường</option>
                      <option value="rain_saver">Tiết kiệm mùa mưa</option>
                      <option value="maintenance">Bảo trì</option>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    Lưu cấu hình
                  </Button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách trạm</CardTitle>
              {stationsAreDemo ? <Tag>Dữ liệu mẫu</Tag> : null}
            </div>
            <CardDescription>Thông tin nhanh về mạng lưới trạm công khai</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0">
              {snapshots.map((snapshot) => (
                <li key={snapshot.station.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 text-sm">
                  <div>
                    <span className="font-medium">{snapshot.station.name}</span>
                    <span className="ml-2 text-muted">
                      {snapshot.station.id} · {stationStatusLabel(snapshot.station.status)}
                    </span>
                  </div>
                  <StatusIndicator
                    status={freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null)}
                    dict={dict}
                    compact
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">
            ← Về trang công khai
          </Link>
        </p>
    </AdminShell>
  );
}
