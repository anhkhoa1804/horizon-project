import { Eye, Info, MapPin, Scale } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Short "scope and limits" statement, placed directly under the observatory.
 *
 * Same grammar as the reference section below it (accent eyebrow, h2, then
 * plain white cards). The wording is the project's draft and is pending legal
 * review before official release - hence `data-legal-review`.
 *
 * The colour legend is part of the statement: it says what each colour does
 * and does not claim. Chips are tinted fills only (no border, no shadow).
 */
const ITEMS = [
  { key: "pilot", icon: Info },
  { key: "place", icon: MapPin },
  { key: "reference", icon: Scale },
  { key: "context", icon: Eye },
] as const;

const LEGEND = ["green", "yellow", "red", "gray"] as const;

export function DataScopeSection({ dict }: { dict: Dictionary }) {
  const s = dict.dataScope;
  return (
    <section className="instrument-in-2 space-y-4" aria-labelledby="data-scope-title" data-legal-review="pending">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{s.eyebrow}</p>
        <h2 id="data-scope-title" className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
          {s.title}
        </h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li key={key} className="rounded-xl border border-border bg-surface p-[var(--bento-pad)]">
            <div className="flex items-center gap-2 text-foreground-subtle">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <h3 className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.1em]">{s.items[key].title}</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{s.items[key].body}</p>
          </li>
        ))}
      </ul>
      <ul className="data-scope-legend flex flex-wrap gap-2 text-xs">
        {LEGEND.map((tone) => (
          <li key={tone} data-tone={tone} className="data-scope-chip rounded-full px-3 py-1 font-medium">
            {s.legend[tone]}
          </li>
        ))}
      </ul>
    </section>
  );
}
