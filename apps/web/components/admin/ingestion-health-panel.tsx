import type { IngestionHealth } from "@/lib/admin/ingestionHealth";
const LABELS: Record<string, string> = { accepted: "Đã nhận", duplicate: "Gói trùng", invalid_signature: "Chữ ký bị từ chối", expired_timestamp: "Thời gian không hợp lệ", sensor_fault: "Lỗi cảm biến", device_not_registered: "Thiết bị chưa đăng ký", value_out_of_range: "Ngoài dải đo", missing_field: "Thiếu trường", contract_mismatch: "Sai phiên bản", internal_error: "Lỗi tiếp nhận" };
export function IngestionHealthPanel({ data }: { data: IngestionHealth }) {
  return <section className="ingestion-health mt-6 rounded-lg border border-border bg-surface p-4 md:p-6">
    <h2 className="text-lg font-semibold">Tiếp nhận dữ liệu</h2>
    <p className="mt-1 text-sm text-muted">12 sự kiện gần nhất từ nhật ký tiếp nhận. ACK gói đo không xác nhận cấu hình.</p>
    {data.unavailable ? <p role="status" className="mt-3 text-sm text-critical">Một phần nhật ký chưa tải được.</p> : null}
    <ul className="mt-4 divide-y divide-border">{data.rows.map((row) => <li key={row.id} className="ingestion-health__row">
      <span className="text-xs [font-family:var(--font-data)]">{row.device_id}</span>
      <span className={`text-sm ${["accepted", "duplicate"].includes(row.status) ? "text-foreground-muted" : "text-critical"}`}>{LABELS[row.status] ?? row.status}</span>
      <time dateTime={row.timestamp} className="text-xs text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.timestamp))}</time>
    </li>)}</ul>
    {!data.rows.length && !data.unavailable ? <p className="mt-3 text-sm text-muted">Chưa có sự kiện tiếp nhận.</p> : null}
    <p className="mt-4 text-xs leading-relaxed text-muted">Yêu cầu bị chặn trước khi nhận diện thiết bị không có trong nhật ký theo thiết bị; cần đối chiếu log máy chủ.</p>
  </section>;
}
