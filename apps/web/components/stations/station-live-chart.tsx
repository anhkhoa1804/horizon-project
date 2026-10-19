"use client";
import { useDict } from "@/lib/i18n/client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface StationLiveChartPoint {
  label: string;
  salinity?: number;
  waterLevel?: number;
  soilEc?: number;
  deliveryRate?: number;
}

export interface StationLiveChartSeries {
  key: keyof Omit<StationLiveChartPoint, "label">;
  name: string;
  color: string;
  unit: string;
}

/**
 * Assumes at most 2 distinct units across `series` (true for every current
 * station profile) — each gets its own Y axis (left/right) rather than
 * sharing one scale, which would visually flatten whichever series has the
 * smaller range (e.g. salinity in ‰ next to water level in cm).
 */
export function StationLiveChart({
  title,
  note,
  data,
  series,
}: {
  title: string;
  note: string;
  data: StationLiveChartPoint[];
  series: StationLiveChartSeries[];
}) {
  const dict = useDict();
  const units = [...new Set(series.map((item) => item.unit))].slice(0, 2);
  const seriesByUnit = new Map(units.map((unit) => [unit, series.filter((item) => item.unit === unit)]));

  return (
    <section className="w-full space-y-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </div>
      <div className="relative h-80 overflow-hidden rounded-xl bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0)_100%)] ring-1 ring-border/70">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">{dict.errors.noRecentData}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e5eaed" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#66707a" fontSize={12} tickLine={false} axisLine={false} />
              {units.map((unit, index) => (
                <YAxis
                  key={unit}
                  yAxisId={unit}
                  orientation={index === 0 ? "left" : "right"}
                  stroke={seriesByUnit.get(unit)?.[0]?.color ?? "#66707a"}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                  label={{ value: unit, position: index === 0 ? "insideTopLeft" : "insideTopRight", fontSize: 11, fill: "#66707a" }}
                />
              ))}
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #dbe3e6",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                }}
                labelStyle={{ color: "#12202a", fontWeight: 600 }}
                formatter={(value, name) => {
                  const matched = series.find((item) => item.name === name);
                  return [`${Number(value).toFixed(2)} ${matched?.unit ?? ""}`, name];
                }}
              />
              {series.map((item) => (
                <Line
                  key={item.key}
                  yAxisId={item.unit}
                  type="monotone"
                  dataKey={item.key}
                  stroke={item.color}
                  strokeWidth={3}
                  dot={false}
                  name={item.name}
                  animationDuration={400}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
