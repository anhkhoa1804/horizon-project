"use client";

import { verdictFor, type MetricVerdict } from "@/lib/monitoring/displayStatus";
import type { ThresholdRow } from "@/lib/monitoring/thresholdTypes";
import type { SignalGroup } from "@/lib/monitoring/signals";
import type { ObservatoryMetric, ObservatoryViewModel } from "@/lib/monitoring/types";
import { useNowMs } from "@/lib/monitoring/useNowMs";
import { useDict } from "@/lib/i18n/client";
import { useLocale } from "@/lib/i18n/client";

/**
 * Where each coloured figure comes from and why it has the colour it has.
 *
 * Shows the four layers separately (freshness, quality, threshold, history),
 * the meaning of the timestamp, and a note when something could not be
 * assessed. It never presents a retained older reading as the latest: a value
 * whose time is past the freshness window says so, in words, on its own line.
 */
const ROWS: { quantity: string; domain: "water" | "soil"; pick: (g: SignalGroup) => ObservatoryMetric | null | undefined; labelKey: "salinity" | "waterLevel" | "moisture" | "soilTemp" | "ec" | "ph" }[] = [
  { quantity: "water_salinity", domain: "water", pick: (g) => g.primary, labelKey: "salinity" },
  { quantity: "water_level", domain: "water", pick: (g) => g.secondary[0], labelKey: "waterLevel" },
  { quantity: "soil_moisture", domain: "soil", pick: (g) => g.primary, labelKey: "moisture" },
  { quantity: "soil_temp", domain: "soil", pick: (g) => g.secondary.find((m) => m.labelKey === "temperature"), labelKey: "soilTemp" },
  { quantity: "soil_ec_bulk", domain: "soil", pick: (g) => g.secondary.find((m) => m.labelKey === "ec"), labelKey: "ec" },
  { quantity: "soil_ph", domain: "soil", pick: (g) => g.secondary.find((m) => m.labelKey === "ph"), labelKey: "ph" },
];

export function ProvenancePanel({
  groups,
  thresholds,
  series,
  isDemo,
}: {
  groups: SignalGroup[];
  thresholds: ThresholdRow[];
  series: ObservatoryViewModel["series"];
  isDemo: boolean;
}) {
  const dict = useDict();
  const locale = useLocale();
  const nowMs = useNowMs();
  const a = dict.assessment;
  const fmt = (iso: string | undefined) =>
    iso
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso))
      : a.panel.noTimestamp;

  const entries = ROWS.map((r) => {
    const group = groups.find((g) => g.domain === r.domain);
    const metric = group ? r.pick(group) : null;
    const verdict: MetricVerdict | null = isDemo
      ? null
      : verdictFor(metric, r.quantity, { rows: thresholds, nowMs, stationQuality: group?.station?.quality ?? null, series: series["24h"]?.points });
    return { ...r, group, metric, verdict };
  }).filter((e) => e.group && e.metric);

  return (
    <details className="provenance-panel mt-4 rounded-xl border border-border bg-surface p-[var(--bento-pad)]" data-testid="provenance-panel">
      <summary className="cursor-pointer text-sm font-medium">{a.panel.title}</summary>
      {isDemo || nowMs === null ? null : (
        <>
          <p className="mt-3 text-xs text-foreground-muted">{a.panel.timestampNote}</p>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {entries.map((e) => {
              const v = e.verdict;
              const note =
                !v ? null
                : v.assessment.freshness === "STALE" || v.assessment.freshness === "OFFLINE" ? a.notes.stale
                : v.assessment.freshness !== "FRESH" || v.assessment.quality === "MISSING" ? null
                : v.assessment.anomaly.reason === "policy" ? a.notes.tidal
                : v.assessment.anomaly.level === "INSUFFICIENT_BASELINE" ? a.notes.noBaselineQuality
                : null;
              return (
                <li key={e.quantity} className="min-w-0 border-t border-border/60 pt-3 text-xs" data-quantity={e.quantity}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">
                    {e.quantity === "soil_ec_bulk" ? dict.monitoring.bulkEc : dict.metricLabels[e.labelKey]} · {e.group!.station?.name ?? e.group!.attribution}
                  </p>
                  <dl className="mt-2 space-y-1">
                    <div><dt className="inline text-foreground-subtle">{a.panel.timestamp}: </dt><dd className="inline">{fmt(e.metric!.provenance.observedAt)}</dd></div>
                    {v ? (
                      <>
                        <div><dt className="inline text-foreground-subtle">{a.panel.freshness}: </dt><dd className="inline">{a.freshnessState[v.assessment.freshness]}</dd></div>
                        <div><dt className="inline text-foreground-subtle">{a.panel.quality}: </dt><dd className="inline">{a.qualityState[v.assessment.quality]}</dd></div>
                        <div><dt className="inline text-foreground-subtle">{a.panel.threshold}: </dt><dd className="inline">{a.thresholdState[v.assessment.threshold.level]}</dd></div>
                        {v.assessment.threshold.source?.title ? (
                          <div><dt className="inline text-foreground-subtle">{a.panel.thresholdSource}: </dt><dd className="inline">{[v.assessment.threshold.source.title, v.assessment.threshold.source.version?.slice(0, 10), v.assessment.threshold.source.scope].filter(Boolean).join(" · ")}</dd></div>
                        ) : null}
                        <div><dt className="inline text-foreground-subtle">{a.panel.history}: </dt><dd className="inline">{a.anomalyState[v.assessment.anomaly.level]}</dd></div>
                      </>
                    ) : null}
                    {note ? <div className="text-foreground-muted"><dt className="inline text-foreground-subtle">{a.panel.note}: </dt><dd className="inline">{note}</dd></div> : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </details>
  );
}
