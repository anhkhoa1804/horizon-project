import Image from "next/image";
import { CONFIG_STATIONS, deriveConfigState } from "@/lib/gateway/remoteProtocol";
import { saveRemoteConfig, type SaveResult } from "@/lib/gateway/remoteConfigService";
import { remoteConfigStore } from "@/lib/gateway/remoteConfigStore";
import { RuntimeConfigForm } from "@/components/admin/runtime-config-form";
import { IngestionHealthPanel } from "@/components/admin/ingestion-health-panel";
import { loadIngestionHealth } from "@/lib/admin/ingestionHealth";
import { OperationsNavigation } from "@/components/layout/operations-navigation";
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
  loadAlertConfigs,
  loadAuditEvents,
  loadCalibrationRecords,
  loadMaintenanceLogs,
} from "@/lib/admin/operations";
import {
  mutateAddAdminEmail, mutateRemoveAdminEmail, mutateMarkReportViewed,
  mutateSaveAlertConfig, mutateAddMaintenanceLog, mutateAddCalibrationRecord,
  mutateSaveSoilWaterModel, mutateSaveWaterLevelContext, mutateResolveReport,
  type AdminMutationResult,
} from "@/lib/admin/mutations";
import { redirect } from "next/navigation";
import { Bell, ShieldCheck, Trash2, UserPlus, ArrowUpRight } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { loadAdminAllowedEmailEntries } from "@/lib/auth/adminAllowlist";
import { loadAdminCommunityReportRows } from "@/lib/admin/reports";
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
import { createServiceClient } from "@/lib/supabase/service";
import { filterSnapshotsToPilotStations, filterToPilotStations } from "@/lib/publicStations";
import type { Station, StationReadingSnapshot } from "@/types";

const managedStationIds = ["STATION_01", "STATION_02", "STATION_03"];

interface RuntimeConfig {
  station_id: string;
  sample_interval_seconds: number;
  sleep_interval_seconds: number;
  mode: string;
  updated_at?: string;
  config_revision?: number;
  delivery_state?: string;
  applied_revision?: number;
  last_delivery_at?: string;
  last_failure_reason?: string;
}

interface CommunityReport {
  id: string;
  description: string | null;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
  viewed_at: string | null;
  media: ReportMedia[];
}

interface ReportMedia {
  id: string;
  media_type: "photo" | "video" | "audio";
  mime_type: string;
  file_size: number;
  signed_url: string | null;
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
  const intervalSeconds = stationId === "STATION_01" || stationId === "STATION_02" ? 60 : 300;

  return {
    station_id: stationId,
    sample_interval_seconds: intervalSeconds,
    sleep_interval_seconds: intervalSeconds,
    mode: "normal",
  };
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
    return [];
  }

  const { data, error } = await supabase
    .from("device_runtime_configs")
    .select("station_id, sample_interval_seconds, sleep_interval_seconds, mode, updated_at, config_revision, delivery_state, applied_revision, last_delivery_at, last_failure_reason")
    .in("station_id", CONFIG_STATIONS)
    .order("station_id");

  if (error) {
    return [];
  }

  return CONFIG_STATIONS.map(
    (stationId) => data?.find((row) => row.station_id === stationId) ?? defaultConfig(stationId),
  );
}

async function loadAdminStations(
  repos: ReturnType<typeof createRepositories> | null,
  scope: Awaited<ReturnType<typeof requireAdmin>>["scope"],
): Promise<{ stations: Station[]; demo: boolean; unavailable: boolean }> {
  if (!repos) {
    return { stations: [], demo: false, unavailable: true };
  }

  try {
    return { stations: filterToPilotStations(await repos.stations.getAll(scope)), demo: false, unavailable: false };
  } catch {
    return { stations: [], demo: false, unavailable: true };
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
    return filterSnapshotsToPilotStations(await repos.readings.getSnapshots(scope));
  } catch {
    return fallbackStations.map((station) => ({ station, reading: null, health: null }));
  }
}

async function loadAdminMetrics(
  repos: ReturnType<typeof createRepositories> | null,
  scope: Awaited<ReturnType<typeof requireAdmin>>["scope"],
): Promise<{ active: number; total: number; demo: boolean; unavailable: boolean }> {
  if (!repos) {
    return { active: 0, total: 0, demo: false, unavailable: true };
  }

  try {
    const stations = filterToPilotStations(await repos.stations.getAll(scope));
    return { active: stations.filter((station) => station.status === "active").length, total: stations.length, demo: false, unavailable: false };
  } catch {
    return { active: 0, total: 0, demo: false, unavailable: true };
  }
}

async function loadCommunityReports(): Promise<CommunityReport[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }

  const reports = (await loadAdminCommunityReportRows()).map((row) => ({ ...row, media: [] as ReportMedia[] }));
  if (reports.length === 0) return reports;

  const { data: mediaRows } = await supabase
    .from("report_media")
    .select("id, report_id, storage_path, media_type, mime_type, file_size")
    .in("report_id", reports.map((report) => report.id))
    .order("created_at");
  const mediaByReport = new Map<string, ReportMedia[]>();
  for (const row of mediaRows ?? []) {
    const { data: signed } = await supabase.storage.from("report-evidence").createSignedUrl(row.storage_path as string, 60 * 30);
    const item: ReportMedia = {
      id: row.id as string,
      media_type: row.media_type as ReportMedia["media_type"],
      mime_type: row.mime_type as string,
      file_size: Number(row.file_size),
      signed_url: signed?.signedUrl ?? null,
    };
    const list = mediaByReport.get(row.report_id as string) ?? [];
    list.push(item);
    mediaByReport.set(row.report_id as string, list);
  }
  return reports.map((report) => ({ ...report, media: mediaByReport.get(report.id) ?? [] }));
}

async function updateRuntimeConfig(_previous: SaveResult | null, formData: FormData): Promise<SaveResult> {
  "use server";
  const { user } = await requireAdmin();
  const expectedText = String(formData.get("expected_revision") ?? "");
  const sampleText = String(formData.get("sample_interval_seconds") ?? "");
  const sleepText = String(formData.get("sleep_interval_seconds") ?? "");
  if (![expectedText, sampleText, sleepText].every((value) => /^(0|[1-9][0-9]*)$/.test(value))) return { kind: "validation_error", message: "Điền đầy đủ giá trị nguyên hợp lệ." };
  const expected = Number(expectedText);
  const result = await saveRemoteConfig(remoteConfigStore(createServiceClient()), {
    contract_version: 1, config_revision: expected + 1, station_id: String(formData.get("station_id") ?? ""),
    sample_interval_seconds: Number(sampleText), sleep_interval_seconds: Number(sleepText), mode: String(formData.get("mode") ?? ""),
  }, expected, user.email ?? "admin");
  if (result.kind === "success") revalidatePath("/admin");
  return result;
}

async function addAdminEmail(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateAddAdminEmail(formData,user), "invalid-email");
}
async function removeAdminEmail(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateRemoveAdminEmail(formData,user), "cannot-remove-env-email");
}
async function markReportViewed(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateMarkReportViewed(formData,user), "report-not-found");
}
function finishMutation(result: AdminMutationResult, invalidCode: string): void {
  if (result === "saved") { revalidatePath("/admin"); return; }
  if (result === "invalid_input") redirect("/admin?error=" + invalidCode);
  if (result === "unavailable") redirect("/admin?error=missing-supabase");
  redirect("/admin?error=" + outcomeError(result));
}

function outcomeError(outcome: "write_failed" | "not_found" | "audit_failed"): string {
  if (outcome === "not_found") return "admin-row-not-found";
  if (outcome === "audit_failed") return "admin-audit-failed";
  return "admin-write-failed";
}


/**
 * Operator-workflow writes (migration 022).
 *
 * Each one persists to Postgres and appends an audit line. None of them sends
 * anything to a device: the firmware has no command or acknowledgement path,
 * so these record what an operator DID or DECIDED, never what a node applied.
 */
async function saveAlertConfig(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateSaveAlertConfig(formData,user), "invalid-alert");
}
async function addMaintenanceLog(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateAddMaintenanceLog(formData,user), "invalid-maintenance");
}
async function addCalibrationRecord(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateAddCalibrationRecord(formData,user), "invalid-calibration");
}
async function saveSoilWaterModel(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateSaveSoilWaterModel(formData,user), "invalid-site-model");
}
async function saveWaterLevelContext(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateSaveWaterLevelContext(formData,user), "invalid-water-context");
}
async function resolveReport(formData: FormData) {
  "use server"; const { user } = await requireAdmin(); finishMutation(await mutateResolveReport(formData,user), "report-not-found");
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
    case "invalid-runtime":
      return "Chu kỳ phải là số nguyên hợp lệ; chu kỳ đo 5–86.400 giây, ngủ 0–86.400 giây.";
    case "config-save-failed":
      return "Không thể lưu cấu hình. Giá trị trước đó được giữ nguyên.";
    case "config-audit-failed":
      return "Cấu hình đã lưu nhưng nhật ký chưa ghi được. Thiết bị chưa xác nhận áp dụng.";
    case "invalid-email":
      return "Email chưa hợp lệ. Vui lòng nhập đúng địa chỉ Gmail/email.";
    case "cannot-remove-env-email":
      return "Email gốc trong ADMIN_ALLOWED_EMAILS không thể thu hồi từ giao diện.";
    case "missing-supabase":
      return "Supabase chưa cấu hình đủ nên chưa thể lưu thay đổi.";
    case "admin-write-failed":
      return "Không lưu được thay đổi vào cơ sở dữ liệu. Chưa ghi nhận thành công.";
    case "admin-audit-failed":
      return "Dữ liệu đã lưu nhưng nhật ký kiểm toán bị lỗi. Kiểm tra bản ghi trước khi gửi lại.";
    case "admin-row-not-found":
    case "report-not-found":
      return "Bản ghi không còn tồn tại hoặc không thể cập nhật.";
    case "invalid-alert":
      return "Cấu hình cảnh báo chưa hợp lệ. Kiểm tra trạm, hướng so sánh và các ngưỡng.";
    case "invalid-maintenance":
      return "Bản ghi bảo trì chưa hợp lệ. Kiểm tra trạm và loại công việc.";
    case "invalid-calibration":
      return "Bản ghi hiệu chuẩn chưa hợp lệ. Kiểm tra trạm, cảm biến và giá trị số.";
    case "invalid-water-context":
      return "Bối cảnh mực nước chưa hợp lệ. Các giá trị phải là số hữu hạn.";
    case "invalid-site-model":
      return "Mô hình đất chưa hợp lệ: PWP phải nhỏ hơn FC và mọi giá trị phải là số.";
    default:
      return null;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { profile, scope } = await requireAdmin();
  const { dict } = await getI18n();

  const supabase = createServiceClient();
  const repos = supabase ? createRepositories(supabase) : null;
  const [{ stations, demo: stationsAreDemo, unavailable: stationsUnavailable }, metrics, runtimeConfigs, reports, allowedEmailEntries] = await Promise.all([
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
  const ingestionHealth = await loadIngestionHealth();
  const unreadReports = reports.filter((report) => !report.viewed_at).length;
  const errorMessage = adminErrorMessage(params.error);
  const isDemoMode = stationsAreDemo || metrics.demo;
  const operationalDataUnavailable = stationsUnavailable || metrics.unavailable;

  const reportQueue = (
      <div className="admin-report-queue">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-semibold">Báo cáo hiện trường</p>
          <p className="text-xs text-muted">{unreadReports} chưa xem</p>
        </div>
        <div className="space-y-3">
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
                        </div>
                        <p className="mt-1 text-xs text-muted">{formatReportTime(report.timestamp)}</p>
                      </div>
                      {unread ? <Badge variant="risk">Mới</Badge> : <Badge>Đã xem</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{cleanReportDescription(report.description)}</p>
                    <p className="text-xs text-muted">
                      Vị trí: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                    </p>
                    {report.media.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {report.media.map((media) => (
                          <div key={media.id} className="overflow-hidden rounded-md border border-border bg-wash-sunken p-2">
                            {media.signed_url && media.media_type === "photo" ? (
                              // eslint-disable-next-line @next/next/no-img-element -- expiring private Storage URL
                              <img src={media.signed_url} alt="Bằng chứng ảnh của báo cáo" className="aspect-video w-full object-cover" />
                            ) : null}
                            {media.signed_url && media.media_type === "video" ? <video src={media.signed_url} controls className="aspect-video w-full" /> : null}
                            {media.signed_url && media.media_type === "audio" ? <audio src={media.signed_url} controls className="w-full pt-4" /> : null}
                            <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                              {media.media_type} · {Math.ceil(media.file_size / 1024)} KB
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
  );
  const reportBell = <a href="#reports" className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-sm"><Bell className="h-4 w-4" aria-hidden />{dict.admin.navigation.reports}{unreadReports ? <span>{unreadReports}</span> : null}</a>;

  const operationsNavigation = <OperationsNavigation label={dict.admin.title} items={[
    { id: "network", label: dict.admin.navigation.overview }, { id: "devices", label: dict.admin.navigation.devices },
    { id: "thresholds", label: dict.admin.navigation.thresholds }, { id: "profiles", label: dict.admin.navigation.applications },
    { id: "calibration", label: dict.admin.navigation.calibration }, { id: "maintenance", label: dict.admin.navigation.maintenance },
    { id: "reports", label: dict.admin.navigation.reports }, { id: "export", label: dict.admin.navigation.data },
    { id: "audit", label: dict.admin.navigation.audit }, { id: "runtime", label: dict.admin.navigation.configuration },
  ]} />;

  return (
    <AdminShell
      title={dict.admin.title}
      description={dict.admin.description}
      email={profile.email}
      navigation={operationsNavigation}
      actions={
        <>
          {reportBell}
          <SignOutButton />
        </>
      }
    >
      <section className="admin-field-board" aria-label={dict.admin.navigation.overview}>
        <div className="admin-field-place">
          <Image src="/assets/hero/hero.png" alt="" fill sizes="(max-width: 767px) 100vw, 540px" className="object-cover" />
          <div><span>Cồn Hô</span><h2>{dict.admin.navigation.overview}</h2><a href="#audit">{dict.admin.navigation.audit}<ArrowUpRight aria-hidden /></a></div>
        </div>
        <div className="admin-board-links">
          <a href="#network"><span className="admin-keyword">{dict.admin.navigation.devices}</span><strong>{stations.length}</strong><ArrowUpRight aria-hidden /></a>
          <a href="#reports"><span className="admin-keyword">{dict.admin.navigation.reports}</span><strong>{reports.length}</strong><ArrowUpRight aria-hidden /></a>
          <a href="#thresholds"><span className="admin-keyword">{dict.admin.navigation.thresholds}</span><strong>{thresholds.length}</strong><ArrowUpRight aria-hidden /></a>
        </div>
      </section>
      {errorMessage ? <Alert tone="critical">{errorMessage}</Alert> : null}
      {params.status === "config-stored" || params.status === "config-unchanged" ? <Alert tone="info">{params.status === "config-unchanged" ? "Cấu hình không đổi." : "Đã lưu cấu hình mong muốn."} Thiết bị chưa xác nhận áp dụng.</Alert> : null}

      {operationalDataUnavailable ? (
        <Alert tone="critical">
          Không thể tải dữ liệu vận hành từ Supabase. Không có dữ liệu minh họa nào được thay thế; thử lại sau khi kiểm tra kết nối và cấu hình server.
        </Alert>
      ) : null}

      {isDemoMode ? (
        <Alert tone="warning">
          <strong className="font-semibold">Dữ liệu mẫu — chưa kết nối Supabase.</strong> Số liệu trạm và số trạm
          hoạt động bên dưới không phải dữ liệu thật; chúng sẽ được thay bằng dữ liệu thực khi backend được cấu
          hình và kết nối.
        </Alert>
      ) : null}

      {/* The operator's first question — is the network up, and which node is
          not? Above the settings forms, because "what is wrong right now" is
          needed before "what can I configure". */}
      <div id="network" className="scroll-mt-36"><NetworkOverview snapshots={snapshots} soilTimestamp={soilTimestamp} /><IngestionHealthPanel data={ingestionHealth} /></div>
      <section id="reports" className="scroll-mt-36">{reportQueue}</section>

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
              <p className="text-sm text-muted">trạm được đánh dấu hoạt động</p>
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
              Cấu hình mong muốn được lưu trong cơ sở dữ liệu. Firmware hiện tắt thăm dò cấu hình thiết bị;
              chỉ bật sau kiểm chứng ngoài hiện trường. Trạng thái theo revision và bằng chứng xác nhận, không theo việc lưu dữ liệu. GATEWAY_01 không phải đích cấu hình STATION_03.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {runtimeConfigs.length === 0 ? <p role="alert" className="text-sm text-critical lg:col-span-2">Không đọc được cấu hình vận hành. Kiểm tra kết nối và migration 034 trước khi lưu.</p> : null}
            {runtimeConfigs.map((config) => (
              <div key={config.station_id} className="border-t border-border/60 pt-4">
                <div className="mb-4 space-y-2">
                  <p className="font-semibold">{config.station_id}</p>
                  <Tag>{deriveConfigState(config)}{config.config_revision ? ` · r${config.config_revision}` : ""}</Tag>
                  <p className="text-sm text-muted">Chế độ mong muốn: {modeLabel(config.mode)}</p>
                  <p className="text-xs text-muted">Revision áp dụng được trạm báo cáo: {config.applied_revision ?? "—"}. Chưa kiểm chứng phần cứng ngoài hiện trường.</p>
                  {config.last_failure_reason ? <p className="text-xs text-critical">{config.last_failure_reason}</p> : null}
                  <p className="text-xs text-muted">{config.updated_at ? `Cập nhật: ${formatReportTime(config.updated_at)}` : "Chưa lưu · giá trị khởi tạo gợi ý"}</p>
                </div>
                <RuntimeConfigForm config={config} action={updateRuntimeConfig} />
              </div>
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
