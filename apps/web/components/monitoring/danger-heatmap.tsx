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
/**
 * Each day is coloured by where its daily mean sits in the station's own distribution for ONE lead
 * channel - salinity, else water level, else soil moisture (the first with at least 14 days) - so
 * the calendar reads as one story instead of the most extreme of seven unrelated sensors.
 * Position = mid-rank percentile: bottom 25 % green, middle 50 % white, top 25 % red; the outer
 * 10 % at each end is the strong shade. A configured threshold (warning or worse) is strong red.
 */
const LEAD_CHANNELS = ["salinity", "waterLevel", "soilMoisture"] as const;
function percentileOf(sorted: number[], v: number): number {
  let lo = 0, eq = 0;
  for (const x of sorted) { if (x < v) lo++; else if (x === v) eq++; }
  return (lo + eq / 2) / sorted.length;
}
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
    const valuesOf = (k: (typeof LEAD_CHANNELS)[number]) => series.points.map((p) => p[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const lead = LEAD_CHANNELS.find((k) => valuesOf(k).length >= 14) ?? null;
    const leadSorted = lead ? valuesOf(lead).sort((a, b) => a - b) : [];
    const days = Array.from({ length: count }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000); const key = dateKey(date);
      const point = points.get(key); let level = "unknown"; let measured = 0; let classified = 0; let tint = 0;
      for (const channel of CHANNELS) {
        const value = point?.[channel.key];
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        measured++;
        // Signed position in the distribution: -0.5 (lowest day) .. +0.5 (highest day).
        if (channel.key === lead) tint = percentileOf(leadSorted, value) - 0.5;
        const applicable = thresholds.filter(t => t.quantity === channel.quantity && !["SENSOR_QUALITY", "DEVICE_HEALTH"].includes(t.basis) && t.is_active && ["OPERATIONAL", "SITE_VALIDATED"].includes(t.validation_status) && (!t.effective_from || Date.parse(t.effective_from) <= date.getTime()));
        let severity = resolveSeverity(applicable, channel.quantity, value)?.severity;
        // Undated current legacy thresholds cannot retrospectively classify real days.
        if (demo && channel.key === "salinity" && salinityThreshold) severity = value >= salinityThreshold.criticalLevel ? "critical" : value >= salinityThreshold.warningLevel ? "warning" : "normal";
        if (severity) { classified++; if (RANK[severity] > RANK[level]) level = severity; }
      }
      // A configured threshold that is warning or worse always reads as the strongest red.
      if (RANK[level] >= RANK.warning) tint = 0.5;
      return { key, date, level, measured, classified, tint, future: key > today };
    });
    return { lead, year: start.getUTCFullYear() === year ? String(year) : `${start.getUTCFullYear()}–${year}`, today, offset, days, columns: Math.ceil((count + offset) / 7) };
  }, [series, thresholds, salinityThreshold, demo, wide]);
  const legend = [
    { cls: "heatmap-day--none", label: vi ? "Chưa có dữ liệu" : "No data" },
    { cls: "heatmap-day--neg", label: vi ? "Thấp hơn thường lệ" : "Lower than usual", style: { "--a": 0.7 } },
    { cls: "heatmap-day--data", label: vi ? "Trong khoảng thường lệ" : "Usual range" },
    { cls: "heatmap-day--pos", label: vi ? "Cao hơn thường lệ" : "Higher than usual", style: { "--a": 0.7 } },
  ];
  const toneOf = (day: { measured: number; tint: number }) => day.measured === 0 ? "none" : Math.abs(day.tint) < 0.25 ? "data" : day.tint < 0 ? "neg" : "pos";
  const alphaOf = (t: number) => (Math.abs(t) >= 0.4 ? 0.8 : 0.4);
  const phrase = (day: { measured: number; tint: number }) => ({ none: vi ? "Chưa có dữ liệu" : "No data", data: vi ? "Trong khoảng thường lệ" : "Usual range", neg: vi ? "Thấp hơn thường lệ" : "Lower than usual", pos: vi ? "Cao hơn thường lệ" : "Higher than usual" })[toneOf(day)];
  const active = calendar.days.find(d => d.key === (selected ?? calendar.today)) ?? calendar.days[0];
  const LEAD_NAME: Record<string, [string, string]> = { salinity: ["độ mặn", "salinity"], waterLevel: ["mực nước", "water level"], soilMoisture: ["độ ẩm đất", "soil moisture"] };
  const leadName = calendar.lead ? LEAD_NAME[calendar.lead][vi ? 0 : 1] : null;
  const describe = (day: typeof active) => day.future ? (vi ? "Ngày sắp tới" : "Future date") : day.measured > 0 && leadName && toneOf(day) !== "none" ? `${phrase(day)} · ${leadName}` : phrase(day);
  return <div className="danger-heatmap" style={{ "--calendar-cols": calendar.columns } as import("react").CSSProperties}>
    <header className="heatmap-heading"><Grid3X3 aria-hidden /><h2>{vi ? "Lịch sử" : "History"}</h2><LiveSignalIndicator historical /><div className="heatmap-legend" aria-label={vi ? "Thang màu so với mức thường lệ" : "Colour scale against the usual range"}>{legend.map(item=><span key={item.cls} className="heatmap-legend-level" title={item.label}><i className={item.cls} style={item.style as import("react").CSSProperties} /><span className="heatmap-legend-label">{item.label}</span></span>)}</div><span className="heatmap-year">{calendar.year}{demo ? " · Demo" : ""}</span></header>
    <div className="heatmap-centered"><div className="heatmap-year-grid">
      <div className="heatmap-months" aria-hidden style={{ gridTemplateColumns: "repeat(" + calendar.columns + ", minmax(0,1fr))" }}>{Array.from({ length:wide ? 12 : 6 }, (_, month) => { const date = new Date(Date.UTC(calendar.days[0].date.getUTCFullYear(), calendar.days[0].date.getUTCMonth() + month, 1, 5)); const column = Math.floor((Math.round((date.getTime() - calendar.days[0].date.getTime()) / 86400000) + calendar.offset) / 7) + 1; return <span key={month} style={{ gridColumn: column + " / span 3" }}>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en",{ month:"short",timeZone:TZ }).format(date)}</span>; })}</div>
      <div className="heatmap-calendar" role="group" aria-label={calendar.year + (vi ? " · So với mức thường lệ, theo trung bình ngày" : " · Against the usual range, from daily means")} style={{ gridTemplateColumns: "repeat(" + calendar.columns + ", minmax(0,1fr))" }}>
        {Array.from({length:calendar.offset},(_,i)=><span key={"pad-"+i} aria-hidden />)}
        {calendar.days.map(day => <button key={day.key} type="button" className={"heatmap-day heatmap-day--" + (day.future ? "none" : toneOf(day)) + (day.future ? " heatmap-day--future" : "")} style={{ "--a": alphaOf(day.tint) } as import("react").CSSProperties} data-date={day.key} tabIndex={active.key === day.key ? 0 : -1} aria-pressed={active.key === day.key} onKeyDown={event => {
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

