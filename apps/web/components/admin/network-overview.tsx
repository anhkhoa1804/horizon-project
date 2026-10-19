import { Send, Sprout, Waves } from "lucide-react";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { STATUS_SURFACE } from "@/lib/monitoring/status";
import { cn } from "@/lib/utils";
import type { StationReadingSnapshot } from "@/types";

/**
 * THE OPERATOR'S FIRST QUESTION: is the network up, and if not, which node?
 *
 * Admin opened on a settings form — allowed emails, retention policy, sleep
 * intervals — which is what an operator needs THIRD, after they know whether
 * anything is wrong. This puts the three real nodes at the top, as three
 * surfaces coloured by their own state, so "which one is down" is answerable
 * without reading a single number.
 *
 * WHAT IS REAL HERE. Every value on this panel comes from the same place the
 * public observatory reads: `freshnessStatus()` over the latest reading's
 * timestamp. There is no separate admin threshold engine, and no field is
 * invented — a node with no data says so rather than showing a plausible
 * "Connected".
 *
 * WORST STATUS WINS for the network line, matching the Bento's rule: a
 * network with one dead node is not two-thirds healthy, it is degraded.
 */

const NODES = [
  { id: "STATION_01", role: "Nước", sub: "Quan trắc nước", icon: Waves },
  { id: "STATION_02", role: "Đất", sub: "Quan trắc đất", icon: Sprout },
  { id: "STATION_03", role: "Gateway", sub: "Truyền dữ liệu", icon: Send },
] as const;

type Level = "ok" | "warn" | "critical" | "none";

const LEVEL_LABEL: Record<Level, string> = {
  ok: "Dữ liệu mới",
  warn: "Dữ liệu gần đây",
  critical: "Dữ liệu đã cũ",
  none: "Chưa có bằng chứng hiện tại",
};

/** Maps the shared freshness vocabulary onto this panel's four states. */
function levelFor(timestamp: string | null): Level {
  if (!timestamp) return "none";
  const state = freshnessStatus(timestamp);
  if (state === "live") return "ok";
  if (state === "recent") return "warn";
  return "critical";
}

function relativeTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const RANK: Record<Level, number> = { ok: 0, warn: 1, none: 2, critical: 3 };

/**
 * The shared status surfaces, plus a neutral for "no data".
 *
 * `STATUS_SURFACE` deliberately has no entry for absent data — the public
 * canvas treats "we have never heard from this" as a lack of status rather
 * than a status, and this panel keeps that rule: an untinted surface, not a
 * grey one pretending to be a state.
 */
const SURFACE: Record<Level, string> = {
  ok: STATUS_SURFACE.ok,
  warn: STATUS_SURFACE.warn,
  critical: STATUS_SURFACE.critical,
  none: "bg-background",
};

export function NetworkOverview({
  snapshots,
  soilTimestamp,
}: {
  snapshots: StationReadingSnapshot[];
  /** STATION_02 keeps its time on soil_readings, not environmental_readings. */
  soilTimestamp: string | null;
}) {
  const rows = NODES.map((node) => {
    const snapshot = snapshots.find((s) => s.station.id === node.id);
    const timestamp =
      node.id === "STATION_02"
        ? soilTimestamp
        : node.id === "STATION_03"
          ? null
          : snapshot?.reading?.timestamp ?? null;
    return { ...node, timestamp, level: levelFor(timestamp) };
  });

  const worst = rows.reduce<Level>(
    (acc, row) => (RANK[row.level] > RANK[acc] ? row.level : acc),
    "ok",
  );
  const reporting = rows.filter((r) => r.level === "ok").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Mạng lưới
        </h2>
        <p className="text-sm text-muted">
          {reporting}/{rows.length} nút đang gửi dữ liệu · {LEVEL_LABEL[worst]}
        </p>
      </div>

      {/* Three surfaces, each carrying its own state as a background — the same
          grammar the public Bento uses, so an operator who knows one reads the
          other. Not three tiny dots on three white cards. */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {rows.map(({ id, role, sub, icon: Icon, timestamp, level }) => (
          <div key={id} className={cn("flex flex-col gap-3 p-5 md:p-6", SURFACE[level])}>
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
              <span className="text-[10px] uppercase tracking-[0.12em] opacity-60 [font-family:var(--font-data)]">
                {id}
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight">{role}</p>
              <p className="text-sm opacity-70">{sub}</p>
            </div>

            <dl className="mt-auto space-y-0.5 pt-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="opacity-70">Trạng thái</dt>
                <dd className="font-medium">{LEVEL_LABEL[level]}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="opacity-70">{id === "STATION_03" ? "Gói chuyển tiếp" : "Lần đo cuối"}</dt>
                <dd className="[font-family:var(--font-data)]">{relativeTime(timestamp)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
