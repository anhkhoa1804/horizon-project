import { cn } from "@/lib/utils";
import { resolveMeasurementVisualState } from "@/lib/dataState";
import { StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";
import type { Dictionary } from "@/lib/i18n/vi";

interface MeasurementValueProps {
  /** e.g. "Độ mặn", "Độ ẩm đất", "Tín hiệu" — the thing being measured. */
  label: string;
  /** Already-formatted display value (e.g. "1.05"), or null/undefined for no reading. */
  value: string | number | null | undefined;
  unit?: string;
  dict: Dictionary;
  freshness: FreshnessState;
  /** Relative-time or absolute caption, e.g. "Cập nhật 5 phút trước". Shown under the value when live/settled. */
  freshnessDetail?: string;
  /** Explanation shown only in the empty state. Falls back to a generic honest message — never invents a reason. */
  emptyMessage?: string;
  size?: "md" | "lg" | "xl";
  className?: string;
}

const valueSize: Record<NonNullable<MeasurementValueProps["size"]>, string> = {
  md: "text-2xl md:text-3xl",
  lg: "text-4xl md:text-5xl",
  xl: "text-5xl md:text-7xl",
};

/**
 * Generalizes the hero-metric pattern shipped for /s/STATION_01 (stale
 * provenance tied to the value) and /s/STATION_02 (calm empty state) into
 * one reusable primitive, per FRONTEND_REBUILD_SPECIFICATION.md §10. Not
 * yet wired into any live page — station-detail.tsx keeps using the
 * existing Metric component until its own rebuild phase (R6); this is the
 * primitive that phase will consume.
 *
 * Three render modes, driven by resolveMeasurementVisualState — never a
 * bare "—" standing in for missing data (FRONTEND_REBUILD_SPECIFICATION.md
 * §9's explicit rule).
 */
export function MeasurementValue({
  label,
  value,
  unit,
  dict,
  freshness,
  freshnessDetail,
  emptyMessage,
  size = "lg",
  className,
}: MeasurementValueProps) {
  const hasValue = value !== null && value !== undefined && value !== "";
  const state = resolveMeasurementVisualState(freshness, hasValue);

  if (state === "empty") {
    return (
      <div className={cn("space-y-2 rounded-lg border border-dashed border-border bg-muted/10 p-6", className)}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="text-lg font-semibold tracking-tight">Không có dữ liệu</p>
        <p className="text-sm leading-relaxed text-muted">
          {emptyMessage ??
            `Trạm chưa gửi bản ghi nào để hiển thị ${label.toLowerCase()}. Số liệu sẽ xuất hiện ở đây ngay khi có quan trắc mới.`}
        </p>
      </div>
    );
  }

  const isStale = state === "stale";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {isStale ? `Giá trị gần nhất · ${label}` : label}
      </p>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums [font-family:var(--font-data)]",
          valueSize[size],
          isStale && "text-foreground/80",
        )}
      >
        {value}
        {unit ? <span className="ml-1.5 text-base font-normal text-muted [font-family:inherit]">{unit}</span> : null}
      </p>
      {isStale ? (
        <StatusIndicator status={freshness} dict={dict} detail={freshnessDetail} />
      ) : freshnessDetail ? (
        <p className="text-sm text-muted">{freshnessDetail}</p>
      ) : null}
    </div>
  );
}
