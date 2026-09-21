import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  AlertConfig,
  AuditEvent,
  CalibrationRecord,
  MaintenanceLog,
} from "@/lib/admin/operations";

/**
 * The operator workflows, all backed by migration 022.
 *
 * ONE HONESTY RULE runs through every panel here: these record what an
 * OPERATOR did or decided. None of them reach a device. The firmware exposes
 * no command endpoint and returns no acknowledgement, so there is no state in
 * this system that could truthfully say "the node applied this" — and rather
 * than invent one, each panel says plainly what its rows mean.
 *
 * Composition follows Monitoring rather than a settings page: full-width
 * operational surfaces, hairline-divided rows, data font for values. Deliberately
 * not a wall of small bordered cards.
 */

const STATIONS = [
  { id: "STATION_01", label: "Nước" },
  { id: "STATION_02", label: "Đất" },
  { id: "STATION_03", label: "Gateway" },
] as const;

const MAINTENANCE_KINDS = [
  { value: "inspection", label: "Kiểm tra" },
  { value: "cleaning", label: "Vệ sinh cảm biến" },
  { value: "battery_replacement", label: "Thay pin" },
  { value: "enclosure_check", label: "Kiểm tra vỏ hộp" },
  { value: "sensor_replacement", label: "Thay cảm biến" },
  { value: "firmware_update", label: "Cập nhật firmware" },
  { value: "calibration", label: "Hiệu chuẩn" },
] as const;

// Widened to `string` keys on purpose: both maps are looked up with values
// that come back from Postgres, which TypeScript only knows as `string`. The
// DB constraint is the real guarantee; the fallbacks below cover drift.
const KIND_LABEL = new Map<string, string>(MAINTENANCE_KINDS.map((k) => [k.value, k.label]));
const STATION_LABEL = new Map<string, string>(STATIONS.map((s) => [s.id, s.label]));

function stationName(id: string): string {
  return STATION_LABEL.get(id) ?? id;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

function StationSelect({ name = "station_id" }: { name?: string }) {
  return (
    <select
      name={name}
      required
      className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
    >
      {STATIONS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label} · {s.id}
        </option>
      ))}
    </select>
  );
}

function SectionShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-6 md:p-7">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}

export function AlertConfigPanel({
  configs,
  action,
}: {
  configs: AlertConfig[];
  action: (formData: FormData) => void;
}) {
  return (
    <SectionShell
      title="Ngưỡng cảnh báo"
      lead="Ngưỡng vận hành do người phụ trách đặt cho triển khai này. Đây không phải khuyến nghị khoa học — cơ sở khoa học được ghi riêng trong docs/SCIENTIFIC_REFERENCES.md, và hai thứ đó cố ý tách nhau."
    >
      {configs.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {configs.map((c) => (
            <div key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {stationName(c.station_id)} · {c.metric}
                </p>
                <p className="text-sm text-muted">
                  {c.comparison === "above" ? "Cảnh báo khi vượt" : "Cảnh báo khi thấp hơn"}
                  {c.enabled ? "" : " · đang tắt"}
                </p>
              </div>
              <p className="text-sm [font-family:var(--font-data)]">
                {c.warning_threshold ?? "—"} / {c.critical_threshold ?? "—"} {c.unit ?? ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Chưa có ngưỡng nào được cấu hình.</p>
      )}

      <form action={action} className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="alert-station">Trạm</Label>
          <StationSelect />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-metric">Chỉ số</Label>
          <Input id="alert-metric" name="metric" required placeholder="salinity" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-warning">Ngưỡng cảnh báo</Label>
          <Input id="alert-warning" name="warning_threshold" inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-critical">Ngưỡng nguy hiểm</Label>
          <Input id="alert-critical" name="critical_threshold" inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-unit">Đơn vị</Label>
          <Input id="alert-unit" name="unit" placeholder="‰" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-comparison">Hướng so sánh</Label>
          <select
            id="alert-comparison"
            name="comparison"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="above">Vượt ngưỡng</option>
            <option value="below">Thấp hơn ngưỡng</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
          Bật cảnh báo
        </label>
        <Button type="submit" className="self-end">
          Lưu ngưỡng
        </Button>
      </form>
    </SectionShell>
  );
}

export function MaintenancePanel({
  logs,
  action,
}: {
  logs: MaintenanceLog[];
  action: (formData: FormData) => void;
}) {
  return (
    <SectionShell
      title="Nhật ký bảo trì"
      lead="Ghi lại công việc đã làm trực tiếp trên thiết bị. Đây là nhật ký thao tác của con người — nó không phản ánh trạng thái hiện tại của thiết bị."
    >
      {logs.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {stationName(log.station_id)} · {KIND_LABEL.get(log.kind) ?? log.kind}
                </p>
                {log.note ? <p className="text-sm text-muted">{log.note}</p> : null}
              </div>
              <p className="text-sm text-muted [font-family:var(--font-data)]">
                {formatTime(log.performed_at)}
                {log.operator ? ` · ${log.operator}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Chưa có lần bảo trì nào được ghi.</p>
      )}

      <form action={action} className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="mt-station">Trạm</Label>
          <StationSelect />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mt-kind">Loại công việc</Label>
          <select
            id="mt-kind"
            name="kind"
            required
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {MAINTENANCE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mt-note">Ghi chú</Label>
          <Input id="mt-note" name="note" placeholder="Đã vệ sinh đầu dò, kiểm tra dây" />
        </div>
        <Button type="submit" className="self-end">
          Ghi nhận
        </Button>
      </form>
    </SectionShell>
  );
}

export function CalibrationPanel({
  records,
  action,
}: {
  records: CalibrationRecord[];
  action: (formData: FormData) => void;
}) {
  return (
    <SectionShell
      title="Hiệu chuẩn"
      lead="Lưu lại giá trị tham chiếu và giá trị đo được tại hiện trường. Hệ thống KHÔNG gửi hiệu chuẩn xuống thiết bị: firmware chưa có đường nhận lệnh và cũng chưa có phản hồi, nên bản ghi ở đây là hồ sơ thao tác, không phải xác nhận thiết bị đã áp dụng."
    >
      {records.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {records.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {stationName(r.station_id)} · {r.sensor}
                </p>
                <p className="text-sm text-muted [font-family:var(--font-data)]">
                  tham chiếu {r.reference_value ?? "—"} · đo được {r.measured_value ?? "—"} {r.unit ?? ""}
                </p>
              </div>
              <p className="text-sm text-muted [font-family:var(--font-data)]">
                {formatTime(r.performed_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Chưa có bản ghi hiệu chuẩn nào.</p>
      )}

      <form action={action} className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="cal-station">Trạm</Label>
          <StationSelect />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-sensor">Cảm biến</Label>
          <Input id="cal-sensor" name="sensor" required placeholder="ES-EC-WT-01" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-ref">Giá trị tham chiếu</Label>
          <Input id="cal-ref" name="reference_value" inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-measured">Giá trị đo được</Label>
          <Input id="cal-measured" name="measured_value" inputMode="decimal" />
        </div>
        <Button type="submit" className="self-end">
          Lưu bản ghi
        </Button>
      </form>
    </SectionShell>
  );
}

export function DataExportPanel() {
  return (
    <SectionShell
      title="Xuất dữ liệu"
      lead="Tải về đúng những hàng đang có trong cơ sở dữ liệu, định dạng CSV. Khoảng thời gian không có dữ liệu sẽ xuất ra tệp chỉ có dòng tiêu đề — hệ thống không chèn giá trị thay thế."
    >
      <form action="/admin/export" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="ex-dataset">Bộ dữ liệu</Label>
          <select
            id="ex-dataset"
            name="dataset"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="environmental">Nước &amp; không khí</option>
            <option value="soil">Đất</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-station">Trạm</Label>
          <select
            id="ex-station"
            name="station"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Tất cả</option>
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-from">Từ ngày</Label>
          <Input id="ex-from" name="from" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-to">Đến ngày</Label>
          <Input id="ex-to" name="to" type="date" />
        </div>
        <Button type="submit" className="self-end">
          Tải CSV
        </Button>
      </form>
    </SectionShell>
  );
}

export function AuditPanel({ events }: { events: AuditEvent[] }) {
  return (
    <SectionShell
      title="Lịch sử thao tác"
      lead="Ai đã thay đổi gì trong khu vực quản trị. Không ghi bất kỳ khóa bí mật nào — các trường có tên gợi ý bí mật bị che trước khi lưu."
    >
      {events.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium [font-family:var(--font-data)]">{e.action}</p>
                <p className="text-sm text-muted">
                  {e.actor ?? "—"}
                  {e.entity_id ? ` · ${e.entity_id}` : ""}
                </p>
              </div>
              <p className="text-sm text-muted [font-family:var(--font-data)]">
                {formatTime(e.occurred_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Chưa có thao tác nào được ghi.</p>
      )}
    </SectionShell>
  );
}

/**
 * The threshold registry, as the operator sees it.
 *
 * The one thing this panel must make impossible to miss: which rows are
 * ACTUALLY producing status and which are citations sitting inert. Reference
 * and operational thresholds live in one table on purpose — so an operator can
 * see published guidance beside what the system is doing with it — and that
 * only works if the difference is loud.
 *
 * Provenance is not behind a tooltip. Basis, source, scope and validation
 * status are on the row, because an operator deciding whether to activate a
 * number needs to know it is a grapefruit yield-response reference point
 * rather than a safety limit.
 */
export function ThresholdRegistryPanel({
  rows,
  soilModels,
}: {
  rows: import("@/lib/monitoring/thresholdTypes").ThresholdRow[];
  soilModels: import("@/lib/monitoring/thresholdTypes").SoilWaterModel[];
}) {
  const active = rows.filter((r) => r.is_active);
  const inert = rows.filter((r) => !r.is_active);

  return (
    <SectionShell
      title="Sổ ngưỡng"
      lead="Mọi ngưỡng hệ thống biết, kèm nguồn gốc. Một dòng có trích dẫn đầy đủ vẫn có thể không tô màu gì — đó là trạng thái bình thường của một giá trị tham chiếu. Chỉ dòng ĐANG ÁP DỤNG mới sinh ra trạng thái."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-2xl font-semibold [font-family:var(--font-data)]">{active.length}</p>
          <p className="text-sm text-muted">đang áp dụng — sinh ra trạng thái</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-2xl font-semibold [font-family:var(--font-data)]">{inert.length}</p>
          <p className="text-sm text-muted">tham chiếu — không tạo cảnh báo</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Sổ ngưỡng chưa có dòng nào.</p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {rows.map((r) => (
            <div key={r.id} className="space-y-1 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-medium">
                  {r.quantity}{" "}
                  <span className="text-sm text-muted [font-family:var(--font-data)]">
                    {r.comparison === "between"
                      ? `${r.threshold_value} – ${r.upper_value}`
                      : r.comparison === "outside"
                        ? `ngoài ${r.threshold_value} – ${r.upper_value}`
                        : `${r.comparison === "above" ? ">" : "<"} ${r.threshold_value}`}{" "}
                    {r.unit}
                  </span>
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                    r.is_active ? "bg-safe-bg text-safe" : "bg-neutral-bg text-muted",
                  )}
                >
                  {r.is_active ? "Đang áp dụng" : "Tham chiếu"}
                </span>
              </div>
              <p className="text-sm text-muted">
                {r.severity} · {r.basis} · {r.validation_status}
                {r.scope ? ` · ${r.scope}` : ""}
              </p>
              {r.source_title ? (
                <p className="text-xs text-foreground-subtle">
                  {r.source_title}
                  {r.source_locator ? ` — ${r.source_locator}` : ""}
                </p>
              ) : null}
              {r.notes ? <p className="text-xs leading-relaxed text-muted">{r.notes}</p> : null}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-5">
        <p className="text-sm font-medium">Mô hình nước trong đất</p>
        {soilModels.length === 0 ? (
          <p className="text-sm text-muted">
            Chưa có. Ngưỡng tưới được tính từ FC/PWP/MAD của chính đất Cồn Hô — chưa đo được thì hệ
            thống không đặt ngưỡng, thay vì mượn một con số phần trăm của nơi khác.
          </p>
        ) : (
          <ul className="space-y-1 text-sm [font-family:var(--font-data)]">
            {soilModels.map((m) => (
              <li key={m.station_id}>
                {m.station_id}: FC {m.field_capacity_pct}% · PWP {m.permanent_wilting_point_pct}% ·
                MAD {m.management_allowed_depletion_pct}% → {Number(m.irrigation_trigger_pct).toFixed(1)}%
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionShell>
  );
}

export function ApplicationProfilesPanel({
  profiles,
}: {
  profiles: import("@/lib/monitoring/thresholdTypes").ApplicationProfile[];
}) {
  return (
    <SectionShell
      title="Mô hình ứng dụng"
      lead="Ba hướng sử dụng cùng bộ dữ liệu. Mỗi hướng nêu rõ dữ liệu hiện có, phần còn thiếu và mức độ trưởng thành của mô hình."
    >
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
        {profiles.map((profile) => (
          <article key={profile.key} className="space-y-5 bg-background p-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-accent [font-family:var(--font-data)]">
                {profile.key.replace("_", "–")}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{profile.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{profile.description}</p>
            </div>
            <ProfileList label="Đang có" items={profile.available_metrics} />
            <ProfileList label="Cần tiếp theo" items={profile.needed_metrics} />
            <ProfileList label="Ngưỡng đang có" items={profile.available_thresholds} empty="Chưa có ngưỡng đã kiểm chứng." />
            <ProfileList label="Chưa kiểm chứng" items={profile.unvalidated_thresholds} />
            <p className="border-t border-border pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-subtle">
              {profile.maturity === "BUILDING_EVIDENCE" ? "Đang xây dựng bằng chứng" : profile.maturity === "PILOT" ? "Thí điểm" : "Tương lai"}
            </p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function ProfileList({ label, items, empty = "Chưa có." }: { label: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-subtle">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{items.length > 0 ? items.join(" · ") : empty}</p>
    </div>
  );
}

export function SiteModelsPanel({
  soilModels,
  waterContexts,
  soilAction,
  waterAction,
}: {
  soilModels: import("@/lib/monitoring/thresholdTypes").SoilWaterModel[];
  waterContexts: import("@/lib/monitoring/thresholdTypes").WaterLevelContext[];
  soilAction: (formData: FormData) => void;
  waterAction: (formData: FormData) => void;
}) {
  const soil = soilModels.find((model) => model.station_id === "STATION_02");
  const water = waterContexts.find((model) => model.station_id === "STATION_01");
  return (
    <SectionShell
      title="Hiệu chuẩn bối cảnh tại chỗ"
      lead="Mô hình tưới và mực nước chỉ có ý nghĩa khi gắn với đất và hình học lắp đặt thật. Các phép tính được lưu cùng đầu vào để có thể kiểm tra lại."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <form action={soilAction} className="space-y-4">
          <div>
            <h3 className="font-semibold">Nước hữu dụng trong đất · STATION_02</h3>
            <p className="mt-1 text-sm text-muted">AW = FC − PWP · trigger = FC − MAD × (FC − PWP)</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="field-capacity" name="field_capacity_pct" label="FC (%)" value={soil?.field_capacity_pct} />
            <NumberField id="wilting-point" name="permanent_wilting_point_pct" label="PWP (%)" value={soil?.permanent_wilting_point_pct} />
            <NumberField id="mad" name="management_allowed_depletion_pct" label="MAD (%)" value={soil?.management_allowed_depletion_pct} />
          </div>
          {soil ? (
            <p className="rounded-md bg-neutral-bg p-3 text-sm [font-family:var(--font-data)]">
              AW = {(soil.field_capacity_pct - soil.permanent_wilting_point_pct).toFixed(1)}% · ngưỡng tưới = {Number(soil.irrigation_trigger_pct).toFixed(1)}%
            </p>
          ) : <p className="text-sm text-muted">Chưa có số liệu FC/PWP tại chỗ; chưa đặt ngưỡng tưới.</p>}
          <Input name="source_note" placeholder="Nguồn đo / phương pháp / ghi chú" defaultValue={soil?.source_note ?? ""} />
          <Button type="submit">Lưu mô hình đất</Button>
        </form>

        <form action={waterAction} className="space-y-4">
          <div>
            <h3 className="font-semibold">Mốc cao độ nước · STATION_01</h3>
            <p className="mt-1 text-sm text-muted">Không có quy tắc “ngập = 80 cm”. Ngưỡng tương lai phải suy ra từ cao độ lắp đặt đã khảo sát.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="sensor-datum" name="sensor_datum_cm" label="Mốc cảm biến" value={water?.sensor_datum_cm} />
            <NumberField id="bank-elevation" name="shore_bank_elevation_cm" label="Cao độ bờ" value={water?.shore_bank_elevation_cm} />
            <NumberField id="critical-elevation" name="critical_infrastructure_elevation_cm" label="Hạ tầng trọng yếu" value={water?.critical_infrastructure_elevation_cm} />
          </div>
          <Input name="survey_note" placeholder="Mốc chuẩn, ngày khảo sát, phương pháp" defaultValue={water?.survey_note ?? ""} />
          <Button type="submit">Lưu bối cảnh mực nước</Button>
        </form>
      </div>
    </SectionShell>
  );
}

function NumberField({ id, name, label, value }: { id: string; name: string; label: string; value?: number | null }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" step="0.1" min="0" max="1000" defaultValue={value ?? ""} required />
    </div>
  );
}
