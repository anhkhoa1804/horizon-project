"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { resolveSeverity, type ThresholdRow } from "@/lib/monitoring/thresholdTypes";
import type { ObservationSeries } from "@/lib/monitoring/types";
import { LiveSignalIndicator } from "./live-signal-indicator";
import { Grid3X3 } from "lucide-react";

const CHANNELS = [{ key: "salinity", quantity: "water_salinity" }, { key: "waterLevel", quantity: "water_level" }, { key: "soilTemp", quantity: "soil_temp" }, { key: "waterEc", quantity: "water_ec" }, { key: "soilPh", quantity: "soil_ph" }, { key: "soilMoisture", quantity: "soil_moisture" }, { key: "soilEc", quantity: "soil_ec_bulk" }] as const;
const RANK: Record<string, number> = { unknown: -1, normal: 0, low_confidence: 1, watch: 2, warning: 3, critical: 4 };
const TZ = "Asia/Ho_Chi_Minh";
const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);

export function DangerHeatmap({ series, salinityThreshold, thresholds, demo }: { series: ObservationSeries; salinityThreshold: { warningLevel: number; criticalLevel: number } | null; thresholds: ThresholdRow[]; demo: boolean }) {
  const vi = useLocale() === "vi";
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches); update();
    query.addEventListener("change",update); return () => query.removeEventListener("change",update);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const calendar = useMemo(() => {
    const today = dateKey(new Date()); const year = Number(today.slice(0,4));
    const month = Number(today.slice(5,7)) - 1;
    const start = new Date(Date.UTC(year, wide ? 0 : month - 5, 1, 5));
    const end = new Date(Date.UTC(year, wide ? 12 : month + 1, 1, 5));
    const count = Math.round((end.getTime() - start.getTime()) / 86400000);
    const offset = (start.getUTCDay() + 6) % 7;
    const points = new Map(series.points.filter(p => p.timestamp).map(p => [dateKey(new Date(p.timestamp!)), p]));
    const days = Array.from({ length: count }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000); const key = dateKey(date);
      const point = points.get(key); let level = "unknown"; let measured = 0; let classified = 0;
      for (const channel of CHANNELS) {
        const value = point?.[channel.key];
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        measured++;
        const applicable = thresholds.filter(t => t.quantity === channel.quantity && !["SENSOR_QUALITY", "DEVICE_HEALTH"].includes(t.basis) && t.is_active && ["OPERATIONAL", "SITE_VALIDATED"].includes(t.validation_status) && (!t.effective_from || Date.parse(t.effective_from) <= date.getTime()));
        let severity = resolveSeverity(applicable, channel.quantity, value)?.severity;
        // Undated current legacy thresholds cannot retrospectively classify real days.
        if (demo && channel.key === "salinity" && salinityThreshold) severity = value >= salinityThreshold.criticalLevel ? "critical" : value >= salinityThreshold.warningLevel ? "warning" : "normal";
        if (severity) { classified++; if (RANK[severity] > RANK[level]) level = severity; }
      }
      return { key, date, level, measured, classified, future: key > today };
    });
    return { year: start.getUTCFullYear() === year ? String(year) : `${start.getUTCFullYear()}–${year}`, today, offset, days, columns: Math.ceil((count + offset) / 7) };
  }, [series, thresholds, salinityThreshold, demo, wide]);
  const labels: Record<string,string> = { unknown: vi ? "Chưa phân loại" : "Unclassified", normal: vi ? "Thấp" : "Low", watch: vi ? "Chú ý" : "Watch", warning: vi ? "Cảnh báo" : "Warning", critical: vi ? "Cao" : "High", low_confidence: vi ? "Tin cậy thấp" : "Low confidence" };
  const active = calendar.days.find(d => d.key === (selected ?? calendar.today)) ?? calendar.days[0];
  const describe = (day: typeof active) => day.future ? (vi ? "Ngày sắp tới" : "Future date") : labels[day.level] + " · " + day.classified + "/" + day.measured + (vi ? " chỉ số được phân loại" : " measured metrics classified");
  return <div className="danger-heatmap" style={{ "--calendar-cols": calendar.columns } as import("react").CSSProperties}>
    <header className="heatmap-heading"><Grid3X3 aria-hidden /><h2>{vi ? "Lịch sử" : "History"}</h2><LiveSignalIndicator historical /><div className="heatmap-legend" aria-label={vi ? "Thang màu nguy cơ" : "Risk color scale"}>{["unknown","normal","watch","warning","critical"].map(level=><span key={level} className={"heatmap-legend-level heatmap-legend-level--"+level} aria-label={labels[level]} title={labels[level]}><i className={"heatmap-day--"+level} /><span className="heatmap-legend-label">{labels[level]}</span></span>)}</div><span className="heatmap-year">{calendar.year}{demo ? " · Demo" : ""}</span></header>
    <div className="heatmap-centered"><div className="heatmap-year-grid">
      <div className="heatmap-months" aria-hidden style={{ gridTemplateColumns: "repeat(" + calendar.columns + ", minmax(0,1fr))" }}>{Array.from({ length:wide ? 12 : 6 }, (_, month) => { const date = new Date(Date.UTC(calendar.days[0].date.getUTCFullYear(), calendar.days[0].date.getUTCMonth() + month, 1, 5)); const column = Math.floor((Math.round((date.getTime() - calendar.days[0].date.getTime()) / 86400000) + calendar.offset) / 7) + 1; return <span key={month} style={{ gridColumn: column + " / span 3" }}>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en",{ month:"short",timeZone:TZ }).format(date)}</span>; })}</div>
      <div className="heatmap-calendar" role="group" aria-label={calendar.year + (vi ? " · Nguy cơ tổng hợp từ trung bình ngày" : " · Combined risk from daily means")} style={{ gridTemplateColumns: "repeat(" + calendar.columns + ", minmax(0,1fr))" }}>
        {Array.from({length:calendar.offset},(_,i)=><span key={"pad-"+i} aria-hidden />)}
        {calendar.days.map(day => <button key={day.key} type="button" className={"heatmap-day heatmap-day--" + day.level + (day.future ? " heatmap-day--future" : "")} data-date={day.key} tabIndex={active.key === day.key ? 0 : -1} aria-pressed={active.key === day.key} onKeyDown={event => {
          const delta: Record<string,number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
          const current = calendar.days.indexOf(day);
          const index = event.key === "Home" ? 0 : event.key === "End" ? calendar.days.length - 1 : delta[event.key] !== undefined ? Math.max(0, Math.min(calendar.days.length - 1, current + delta[event.key])) : null;
          if (index === null) return;
          event.preventDefault(); const next = calendar.days[index].key; setSelected(next);
          const target = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(button => button.dataset.date === next); target?.focus();
        }} aria-label={day.key + ": " + describe(day)} title={day.key + " · " + describe(day)} onMouseEnter={() => setSelected(day.key)} onFocus={() => setSelected(day.key)} onClick={() => setSelected(day.key)} />)}
      </div>
    </div>
</div>
  </div>;
}

