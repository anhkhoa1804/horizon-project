import { BookOpen, CircleDashed, FlaskConical, Globe2, History, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/components/ui/status-indicator";
import type { Dictionary } from "@/lib/i18n/vi";
import type { Locale } from "@/lib/i18n/config";
import type { DataOrigin, DataProvenance } from "@/lib/dataState";

const ORIGIN_ICON: Record<DataOrigin, typeof Radio> = {
  telemetry: Radio,
  historical: History,
  reference: BookOpen,
  demo: FlaskConical,
  external: Globe2,
  unavailable: CircleDashed,
};

/**
 * The text this renders is the actual honesty boundary — never invent a
 * citation here. "reference" with no `source` set renders the explicit
 * "chưa xác minh" fallback rather than a plausible-looking blank.
 */
function sourceLabel(provenance: DataProvenance, dict: Dictionary, locale: Locale): string {
  const { origin, source, observedAt } = provenance;
  const p = dict.provenance;

  switch (origin) {
    case "telemetry":
      return `${dict.common.source}: ${source ?? p.telemetry}`;
    case "historical":
      return observedAt ? `${p.lastObserved} · ${relativeTime(observedAt, locale)}` : p.historical;
    case "reference":
      return source ? `${p.reference}: ${source}` : p.unverifiedSource;
    case "demo":
      return `${dict.common.source}: ${p.demo}`;
    case "external":
      // Named, never anonymous: an external number without its source is
      // indistinguishable from a HORIZON reading, which is the exact
      // confusion this origin exists to prevent.
      return source ? `${p.external}: ${source}` : p.external;
    case "unavailable":
      return p.unavailable;
  }
}

const ORIGIN_TONE: Record<DataOrigin, string> = {
  telemetry: "text-healthy",
  historical: "text-muted",
  reference: "text-accent",
  demo: "text-watch",
  external: "text-informational",
  unavailable: "text-muted",
};

interface SourceNoteProps {
  provenance: DataProvenance;
  dict: Dictionary;
  locale: Locale;
  /** compact (default): icon + one line. expanded: adds sourceUrl / verifiedAt when present. */
  expanded?: boolean;
  className?: string;
}

/**
 * The one place that decides how a value's origin gets described in text.
 * Every component that shows a threshold, reference range, or demo value
 * should go through this rather than hand-writing its own "Nguồn: ..."
 * string, so the wording cannot drift between surfaces.
 */
export function SourceNote({ provenance, dict, locale, expanded = false, className }: SourceNoteProps) {
  const Icon = ORIGIN_ICON[provenance.origin];
  const label = sourceLabel(provenance, dict, locale);

  return (
    <div className={cn("inline-flex items-start gap-1.5", className)}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ORIGIN_TONE[provenance.origin])} aria-hidden />
      <div className="space-y-0.5">
        <p className={cn("text-xs font-medium", ORIGIN_TONE[provenance.origin])}>
          {provenance.sourceUrl && expanded ? (
            <a href={provenance.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {label}
            </a>
          ) : (
            label
          )}
        </p>
        {expanded && provenance.note ? <p className="text-xs text-muted">{provenance.note}</p> : null}
        {expanded && provenance.verifiedAt ? (
          <p className="text-xs text-muted">{dict.provenance.lastChecked} · {relativeTime(provenance.verifiedAt, locale)}</p>
        ) : null}
      </div>
    </div>
  );
}
