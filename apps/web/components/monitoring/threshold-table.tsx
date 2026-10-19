"use client";

import { ChevronDown } from "lucide-react";
import { useDict } from "@/lib/i18n/client";
import { formatBand, type ThresholdRow, type SoilWaterModel } from "@/lib/monitoring/thresholdTypes";
import { cn } from "@/lib/utils";

/**
 * The threshold registry, shown publicly under "Cơ sở diễn giải số liệu".
 *
 * WHY IT IS PUBLIC. This project's claim is that every published number can be
 * traced. That is only true if the basis is visible to the reader, not just to
 * an operator behind a login — so the same registry that drives (or declines to
 * drive) status is printed here with its sources.
 *
 * WHY EACH GROUP IS A `<details>`. It sits directly beneath the three
 * editorial reference entries, which are already collapsible, and this table is
 * far longer than they are — eight quantities, twenty-one bands, a source line
 * each. Left open it buried the rest of the page in a wall of numbers. Same
 * grammar as the panel above it: one summary row carrying the name and the
 * standing badge, everything else folded behind a native disclosure that is
 * keyboard-operable and findable by in-page search when open.
 *
 * WHAT THE READER MUST BE ABLE TO TELL APART, from the summary row alone,
 * without expanding anything:
 *
 *   — a figure that is currently colouring cells        (ĐANG ÁP DỤNG)
 *   — a published figure that colours nothing           (THAM CHIẾU)
 *
 * The badge is deliberately on the summary rather than inside, because that
 * distinction is the whole point of the registry and must survive collapsing.
 */

const SEVERITY_TINT: Record<string, string> = {
  normal: "text-safe",
  watch: "text-watch",
  warning: "text-watch",
  critical: "text-critical",
  low_confidence: "text-muted",
};

export function ThresholdTable({
  rows,
  soilModels,
}: {
  rows: ThresholdRow[];
  soilModels: SoilWaterModel[];
}) {
  const t = useDict().thresholds;
  if (rows.length === 0) return null;

  const byQuantity = new Map<string, ThresholdRow[]>();
  for (const row of rows) {
    const list = byQuantity.get(row.quantity) ?? [];
    list.push(row);
    byQuantity.set(row.quantity, list);
  }

  return (
    <div className="divide-y divide-border border-y border-border">
      {[...byQuantity.entries()].map(([quantity, group]) => {
        const anyActive = group.some((r) => r.is_active);
        // One source line per group: rows in a group almost always share a
        // citation, and repeating it on every band turns the table into
        // footnotes.
        const sources = [
          ...new Map(group.filter((r) => r.source_title).map((r) => [r.source_title, r])).values(),
        ];

        return (
          <details key={quantity} className="group py-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-[var(--motion-base)] group-open:rotate-180"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {t.quantity[quantity as keyof typeof t.quantity] ?? quantity}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                  anyActive ? "bg-safe-bg text-safe" : "bg-neutral-bg text-muted",
                )}
              >
                {anyActive ? t.active : t.referenceOnly}
              </span>
            </summary>

            <div className="mt-4 space-y-3 pl-7">
              <dl className="space-y-2.5">
                {group.map((row) => (
                  <div key={row.id} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <dt className="text-sm tabular-nums [font-family:var(--font-data)]">
                        {formatBand(row)}
                      </dt>
                      <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <span className={cn("font-medium", SEVERITY_TINT[row.severity])}>
                          {t.severity[row.severity] ?? row.severity}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.1em] text-foreground-subtle">
                          {t.basis[row.basis]} · {t.validation[row.validation_status]}
                        </span>
                      </dd>
                    </div>
                    {row.notes ? (
                      <p className="text-xs leading-relaxed text-muted">{row.notes}</p>
                    ) : null}
                  </div>
                ))}
              </dl>

              {sources.map((r) => (
                <p key={r.id} className="text-xs leading-relaxed text-muted">
                  {t.source}:{" "}
                  {r.source_url ? (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {r.source_title}
                    </a>
                  ) : (
                    r.source_title
                  )}
                  {r.source_locator ? ` — ${r.source_locator}` : ""}
                  {r.scope ? ` · ${t.scope}: ${r.scope}` : ""}
                </p>
              ))}
            </div>
          </details>
        );
      })}

      {/* Soil moisture has no fixed percentage anywhere in the system, and this
          is where a reader finds out why. Same disclosure grammar as every
          group above, so the section reads as one list rather than a table
          followed by an essay. */}
      <details className="group py-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <ChevronDown
            className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-[var(--motion-base)] group-open:rotate-180"
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-sm font-semibold">{t.soilTitle}</span>
          <span className="shrink-0 rounded-sm bg-neutral-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            {soilModels.length > 0 ? t.soilDerived : t.soilMissing}
          </span>
        </summary>

        <div className="mt-4 space-y-3 pl-7">
          <p className="max-w-3xl text-sm leading-relaxed text-muted">{t.soilExplain}</p>
          {soilModels.length > 0 ? (
            <dl className="space-y-1.5">
              {soilModels.map((m) => (
                <div key={m.station_id} className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <dt className="text-sm">{m.station_id}</dt>
                  <dd className="text-sm tabular-nums [font-family:var(--font-data)]">
                    FC {m.field_capacity_pct}% · PWP {m.permanent_wilting_point_pct}% · MAD{" "}
                    {m.management_allowed_depletion_pct}% → {t.irrigateAt}{" "}
                    <strong className="font-semibold">
                      {Number(m.irrigation_trigger_pct).toFixed(1)}%
                    </strong>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">{t.soilSource}</p>
        </div>
      </details>
    </div>
  );
}
