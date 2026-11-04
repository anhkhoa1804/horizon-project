import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Short "scope and limits" statement, directly under the observatory, in exactly the grammar of the
 * reference & threshold section below it: accent eyebrow, h2, then one collapsible row per point
 * (same <details> rows, chevron and hairlines as the threshold table). The colours themselves are
 * explained by the history calendar's own key. Opening one row closes the others (shared `name`).
 * The wording is the project's draft and is pending legal review - hence `data-legal-review`.
 */
const ITEMS = ["pilot", "place", "reference", "context"] as const;

export function DataScopeSection({ dict }: { dict: Dictionary }) {
  const s = dict.dataScope;
  return (
    <section className="instrument-in-2 space-y-6" aria-labelledby="data-scope-title" data-legal-review="pending">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{s.eyebrow}</p>
        <h2 id="data-scope-title" className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
          {s.title}
        </h2>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {ITEMS.map((key) => (
          <details key={key} name="observatory-disclosure" className="group py-4">
            <summary className="flex cursor-pointer list-none items-center gap-x-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-[var(--motion-base)] group-open:rotate-180"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-sm font-semibold">{s.items[key].title}</span>
            </summary>
            <div className="mt-3 max-w-[76ch] space-y-2 pl-7 text-sm leading-relaxed text-muted">{s.items[key].body.split("\n").map((line, i) => <p key={i}>{line}</p>)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

