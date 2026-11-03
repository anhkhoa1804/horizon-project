import type { FreshnessState } from "@/components/ui/status-indicator";

/**
 * Presentation-layer derivation only — NOT a new data model. Freshness and
 * quality remain the two independent axes defined in status-indicator.tsx
 * (see its own comment for why they're never merged); this answers one
 * narrower question — "which of a small number of visual treatments does a
 * measurement primitive use" — without inventing a competing state system.
 * Both source axes are still passed through and displayed by the caller;
 * this never discards information, only picks a rendering mode.
 *
 * FRONTEND_REBUILD_SPECIFICATION.md §9 defines the mapping this resolver
 * implements. It intentionally does not have an "error" mode: a reading can
 * be simultaneously fresh and faulty (QualityState is orthogonal), and that
 * fact is shown via QualityIndicator alongside the measurement, not by
 * overriding the measurement's own size/emphasis.
 */
export type MeasurementVisualState = "live" | "settled" | "stale" | "empty";

export function resolveMeasurementVisualState(
  freshness: FreshnessState,
  hasValue: boolean,
): MeasurementVisualState {
  if (!hasValue) return "empty";
  if (freshness === "live") return "live";
  if (freshness === "recent") return "settled";
  // stale | offline | never_connected | unavailable, but hasValue is true —
  // a real last reading exists, it's just not current. See §9's table:
  // "Real value, stale/offline" is one row, not four.
  return "stale";
}

/**
 * A third, independent axis — orthogonal to FreshnessState (how recent) and
 * QualityState (how trustworthy a real reading is). This one answers "what
 * kind of thing is this value at all": a live sensor number, an aging-out
 * real reading, a static scientific/technical constant, a synthetic example,
 * or nothing. Never merge this into Freshness/Quality — that collapsed-enum
 * mistake is exactly what status-indicator.tsx's own history already
 * rejected once (see its top comment).
 *
 * - "telemetry"   — a real, currently-fresh backend reading.
 * - "historical"  — a real backend reading that is aging out (stale/
 *                    offline), OR a past point in a trend/series. Still
 *                    real data, just not the current instant.
 * - "reference"   — a static scientific/technical value (a threshold, a
 *                    guidance range) — never derived from freshness.
 * - "demo"        — local synthetic data built for visual prototyping.
 *                    Never derived from freshness; set explicitly.
 * - "external"    — a real, current measurement from a third party (a public
 *                    weather API), for the region rather than for a HORIZON
 *                    station. It is genuine data, which is why it is not
 *                    "reference" or "demo", but it is not ours, which is why
 *                    it is not "telemetry". Keeping it a distinct origin is
 *                    what lets the observatory show external and HORIZON
 *                    readings on ONE canvas without ever conflating them:
 *                    the canvas is shared, the provenance is not.
 * - "unavailable" — no trustworthy value exists at all.
 */
export type DataOrigin =
  | "telemetry"
  | "historical"
  | "reference"
  | "demo"
  | "external"
  | "unavailable";

export interface DataProvenance {
  origin: DataOrigin;
  /** Human-readable source label, e.g. "Telemetry", "FAO Irrigation and Drainage Paper 29", "Dữ liệu minh họa". Omit rather than invent one. */
  source?: string;
  sourceUrl?: string;
  /** ISO timestamp of the underlying observation, when this is a telemetry/historical value. */
  observedAt?: string;
  /** ISO timestamp a reference source was last checked, when this is a reference value. */
  verifiedAt?: string;
  /** Free-form honest caveat, e.g. "Chưa có nguồn tham chiếu được xác minh." */
  note?: string;
}

/**
 * Derives DataOrigin for a real (non-demo, non-reference) backend-sourced
 * measurement from its freshness. Reference and demo origins are never
 * derived this way — freshness has no meaning for a scientific constant or
 * a synthetic example, so callers set those explicitly instead of routing
 * through this function.
 */
export function resolveTelemetryOrigin(freshness: FreshnessState, hasValue: boolean): DataOrigin {
  if (!hasValue) return "unavailable";
  if (freshness === "live" || freshness === "recent") return "telemetry";
  if (freshness === "stale" || freshness === "offline") return "historical";
  // never_connected | unavailable, but hasValue somehow true — treat as
  // unavailable rather than trust a freshness value that contradicts hasValue.
  return "unavailable";
}
