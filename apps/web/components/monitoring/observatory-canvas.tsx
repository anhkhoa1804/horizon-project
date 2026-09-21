"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudRain, Droplets, Send, Sprout, Thermometer, Waves, Wind } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { ObservationLog } from "@/components/monitoring/observation-log";
import type { ExternalWeather } from "@/lib/external/weather";
import { useDict } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/vi";
import { buildSignalGroups, type SignalGroup } from "@/lib/monitoring/signals";
import { contextLine, deviceContext, type ContextMetricKey } from "@/lib/monitoring/context";
import { mergeWeather24hSeries, weatherHistoryToObservationSeries } from "@/lib/monitoring/weatherSeries";
import { ThresholdTable } from "@/components/monitoring/threshold-table";
import { resolveReferenceSeverity, type ThresholdRow, type SoilWaterModel } from "@/lib/monitoring/thresholdTypes";
import { STATION_COORDS } from "@/lib/geo";
import type { PilotStationId } from "@/lib/publicStations";
import { statusFor, worstStatus, STATUS_SURFACE, type MetricStatus } from "@/lib/monitoring/status";
import { cn } from "@/lib/utils";
import type {
  ObservationSeries,
  ObservatoryMetric,
  ObservatoryViewModel,
} from "@/lib/monitoring/types";

// ---------------------------------------------------------------------------
// The Bento — one square base cell, two explicit arrangements
// ---------------------------------------------------------------------------

/**
 * PROVENANCE IS NO LONGER MARKED ON THE VALUE.
 *
 * Every figure used to carry a superscript — `*` for an external source, `~`
 * for demo — plus a visually-hidden sentence explaining it, plus a notice
 * above the Bento explaining both. The owner's call is that the markers cost
 * the canvas more than they bought: chrome hanging off numbers whose whole
 * job is to be read at a glance.
 *
 * What remains: demo mode still says so, once, in the badge beside the page
 * title. That is the fact a reader must have. Which particular cell is
 * regional rather than local is documented on Home's chapters and in
 * docs/ASSET-SOURCES.md — not as a caption on every number.
 *
 * The model still carries each value's `DataOrigin`; only its rendering
 * here is gone.
 */

/**
 * THE OBSERVATORY BENTO.
 *
 * Ten boxes on an explicit grid — not derived from content length,
 * companion count, or data availability. The grid IS the design.
 *
 * ONE BASE CELL, THREE ARRANGEMENTS.
 *
 * The rule that makes this read as one instrument is that every region is an
 * INTEGER MULTIPLE of a square base cell, at every width. What changes
 * between breakpoints is how many columns the canvas has, and how many units
 * a region buys — never whether it is a whole number of them.
 *
 *            columns x rows      base cell @ the breakpoint's low end
 *   <md          4 x 21          ~81px  (390)
 *   md           4 x 10          ~167px (768)
 *   lg           6 x 4           ~148px (1024)
 *
 *   region      <md          md          lg
 *   BOX 0       4x2          4x1         2x1   primary: salinity + level
 *   BOX 1       4x4          4x2         3x2   the chart
 *   BOX 2       4x3          4x2         2x2   the map
 *   BOX 3       4x2          4x1         2x1   infrastructure
 *   BOX 4-7     2x2 each     1x1 each    1x1 each   regional context
 *   WATER       4x2          4x1          2x1
 *   SOIL        4x4          4x2          4x1 (four zones)
 *
 * Each of the three is a complete, non-overlapping tiling (there is a test
 * that proves it for all three). `aspect-[4/21]` / `aspect-[2/5]` /
 * `aspect-[3/2]` on the container is what makes the base cell square at any
 * width without measuring anything in JS — the ratio is columns : rows.
 *
 * WHY THE ROW COUNT CHANGES BETWEEN <md AND md. A base cell is ~81px at 390
 * and ~167px at 768, but a header plus two numerals needs an absolute
 * ~110px whatever the viewport is. So Box 0 buys two units of height at 390
 * and one at 768 — the same physical box, expressed in the unit available.
 * Giving it one unit everywhere left it 80px tall at 390 with its numerals
 * clipped; giving it two everywhere left it 342px tall at 768 holding two
 * numbers.
 *
 * THE CONTEXT CELLS: 1x4 FROM md UP, 2x2 BELOW IT. They are four readings of
 * the same kind and must always read as four EQUAL instruments — what changes
 * is only how many base cells each is made of.
 *
 * At md and above one unit is 148-193px, which comfortably holds an icon, a
 * label, a value and its interpretation, so the four sit in one row:
 * TEMPERATURE | HUMIDITY | WIND | RAIN.
 *
 * At 390 one unit is ~81px. A 1x4 row there forced 9px labels that wrapped
 * mid-word and left no room for the interpretation line at all — the row was
 * intact and the cells were unreadable. Two units square gives them 171px,
 * which is the same physical size md gets from one unit. Readability wins
 * over arrangement purity; the four stay equal either way.
 *
 * STATUS BELONGS TO THE REGION, NOT THE VALUE. Each box resolves ONE status
 * (worstStatus across whatever it holds) and tints its whole surface. The
 * previous build tinted each value separately inside a neutral parent,
 * which produced small coloured cards nested in white ones — two answers to
 * "is this fine?" in the same box, and a wall of rounded cards rather than
 * one canvas. Untinted boxes are plain white; the status boxes are the only
 * ones that carry colour.
 *
 * The fourth desktop row restores the field measurements as two grouped
 * domains: a 2×1 water surface and a 4×1 soil surface. On mobile the soil
 * surface uses a readable 2×2 internal arrangement rather than four tiny
 * cards.
 */

const STATUS_LABEL: Record<MetricStatus["level"], keyof Dictionary["alerts"]> = {
  ok: "normal",
  watch: "warning",
  warn: "warning",
  critical: "critical",
};

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

/** A box's surface: its own status tint, or plain white.
 *
 * The untinted boxes used to be a near-transparent grey wash so the page's
 * atmosphere showed through them. Against the strengthened status tints that
 * read as two greys and a colour rather than as one set of cards, so the
 * neutral boxes are now the surface white the rest of the product uses. The
 * status boxes are still the only coloured things on the canvas. */
function regionSurface(status: MetricStatus | null): string {
  return status ? STATUS_SURFACE[status.level] : "bg-surface";
}

/**
 * One measurement inside a box. Deliberately carries NO surface of its own —
 * the region it sits in owns the status colour. This is just a label and a
 * number.
 */
const VALUE_SIZE = {
  /* Primary — salinity and water level. Stepped back down from 60px: at that
     size they dominated a canvas whose other figures are just as real, and
     the owner's read was that the box had gone from confident to loud. */
  primary: "text-3xl md:text-4xl xl:text-5xl",
  /* Device health, and regional context. One tier, because they are the same
     kind of reading: supporting figures that should be comfortably legible
     rather than ranked against each other. The context cells were a step
     below this and read as an afterthought at the sizes their cells allow. */
  secondary: "text-3xl md:text-4xl",
  context: "text-3xl md:text-4xl",
} as const;

function Value({
  label,
  metric,
  dict,
  size = "secondary",
  note,
}: {
  label: string;
  metric: ObservatoryMetric | null | undefined;
  dict: Dictionary;
  size?: keyof typeof VALUE_SIZE;
  /** Optional one-line state derived from a defined band — never invented. */
  note?: string | null;
}) {
  const hasValue = !!metric && metric.value !== null;
  return (
    <div className="min-w-0">
      <p className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.1em] text-foreground-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums leading-none tracking-tight [font-family:var(--font-data)]",
          VALUE_SIZE[size],
          // Always plain foreground, never the status hue.
          //
          // The region behind this now carries a genuinely strong status tint,
          // and amber numerals on an amber surface is the one combination that
          // gets worse the better the status colour works. Contrast belongs to
          // the value; colour belongs to the surface. This also stops a reader
          // having to decode two encodings of the same fact.
          hasValue ? undefined : "text-foreground-subtle",
        )}
      >
        {hasValue ? (
          <>
            {metric!.value}
            {metric!.unit ? (
              <span className="ml-1 text-[0.4em] font-normal text-foreground-muted [font-family:inherit]">
                {metric!.unit}
              </span>
            ) : null}
          </>
        ) : (
          "—"
        )}
      </p>
      {hasValue ? (
        note ? <p className="mt-1.5 truncate text-[11px] text-foreground-subtle">{note}</p> : null
      ) : (
        <p className="mt-1.5 truncate text-[11px] text-foreground-subtle">{dict.common.noData}</p>
      )}
    </div>
  );
}

/**
 * The value half of a context cell.
 *
 * A context cell states its label in its HEADER — same as every other box in
 * the grid — so unlike `Value` this renders the number alone. The two used to
 * share one component, which meant a weather cell printed an icon, then a
 * label, then another label, then the number: three stacked lines for one
 * figure, and the reason the four of them read as a different species of card
 * from the boxes around them.
 */
function ContextValue({
  metric,
  dict,
  note,
}: {
  metric: ObservatoryMetric | null | undefined;
  dict: Dictionary;
  /**
   * A published-classification phrase, or null. Two of the four regional
   * readings have one; temperature and humidity deliberately do not, because
   * every official index that would judge them is a function of both
   * together. See lib/monitoring/context.ts.
   *
   * Shown at every width: the context cells are 2x2 units below md, which
   * gives them 171px at 390 — enough for the line without shrinking anything.
   */
  note?: string | null;
}) {
  const hasValue = !!metric && metric.value !== null;
  return (
    <div className="min-w-0">
    <p
      className={cn(
        "font-semibold tabular-nums leading-none tracking-tight [font-family:var(--font-data)]",
        VALUE_SIZE.context,
        hasValue ? undefined : "text-foreground-subtle",
      )}
    >
      {hasValue ? (
        <>
          {metric!.value}
          {metric!.unit ? (
            <span className="ml-0.5 text-[0.4em] font-normal text-foreground-muted [font-family:inherit]">
              {metric!.unit}
            </span>
          ) : null}
        </>
      ) : (
        "—"
      )}
    </p>
    {note && hasValue ? (
      <p className="mt-1.5 truncate text-[11px] text-foreground-subtle">{note}</p>
    ) : null}
    </div>
  );
}

/**
 * A region's header: what the region is, and — immediately after it, on the
 * same line — what state it is in.
 *
 * The status word has now been in three places. It began on its own line
 * below the values, which gave every status-bearing box a third horizontal
 * band and made the word read as a caption floating under the numbers. It
 * then moved to the far right of the title row, which fixed the band but
 * split the statement across ~300px of empty space: at a glance the eye read
 * "QUAN TRẮC" and "CẢNH BÁO" as two separate labels that happened to share a
 * row. Set directly after the title with a separator, they read as one
 * phrase — QUAN TRẮC · CẢNH BÁO — which is what it is.
 *
 * The word is plain foreground, never the status hue: it sits ON the status
 * surface, where same-hue text gives back exactly the contrast the strong
 * tint just bought. Colour is the at-a-glance signal; the word is the
 * accessible, non-colour-dependent one.
 */
function RegionHeader({
  icon: Icon,
  title,
  status,
  dict,
}: {
  icon: typeof Waves;
  title: string;
  status: MetricStatus | null;
  dict: Dictionary;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-foreground-muted">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">{title}</span>
      {status ? (
        <>
          <span aria-hidden className="shrink-0 text-[11px] opacity-50">
            ·
          </span>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
            {dict.alerts[STATUS_LABEL[status.level]]} · {dict.monitoring.statusBasis[status.basis]}
          </span>
        </>
      ) : null}
    </div>
  );
}

function ObservatoryBento({
  groups,
  dict,
  isDemo,
  salinityThreshold,
  thresholds,
  series,
  mapStations,
  network,
}: {
  groups: SignalGroup[];
  dict: Dictionary;
  isDemo: boolean;
  salinityThreshold: { warningLevel: number; criticalLevel: number } | null;
  thresholds: ThresholdRow[];
  series: ObservatoryViewModel["series"];
  mapStations: MapStation[];
  network: ObservatoryViewModel["network"];
}) {
  const water = groups.find((g) => g.domain === "water");
  const soil = groups.find((g) => g.domain === "soil");
  const infra = groups.find((g) => g.domain === "infrastructure");
  const context = groups.find((g) => g.domain === "context");

  const status = (metric: ObservatoryMetric | null | undefined) =>
    metric
      ? statusFor(metric.labelKey, metric.value !== null ? Number(metric.value) : null, {
          salinity: salinityThreshold,
          isDemo,
        })
      : null;

  const advisoryStatus = (metric: ObservatoryMetric | null | undefined, quantity: string): MetricStatus | null => {
    if (!metric || metric.value === null) return null;
    const resolved = resolveReferenceSeverity(thresholds, quantity, Number(metric.value));
    if (!resolved) return null;
    const level = resolved.severity === "normal" ? "ok" : resolved.severity === "critical" ? "critical" : resolved.severity === "warning" ? "warn" : "watch";
    const basis = resolved.row.basis === "SENSOR_QUALITY"
      ? "quality"
      : resolved.row.validation_status === "PILOT"
        ? "pilot"
        : "reference";
    return { level, basis };
  };

  const salinity = water?.primary;
  const waterLevel = water?.secondary[0];
  const waterEc = water?.secondary.find((m) => m.labelKey === "waterEc");
  const waterTemp = water?.secondary.find((m) => m.labelKey === "waterTemp");
  const soilMoisture = soil?.primary;
  const soilEc = soil?.secondary.find((m) => m.labelKey === "ec");
  const soilPh = soil?.secondary.find((m) => m.labelKey === "ph");
  const soilTemp = soil?.secondary.find((m) => m.labelKey === "temperature");
  const contextMetric = (key: string) => context?.secondary.find((m) => m.labelKey === key);
  const infraMetric = (key: string) => infra?.secondary.find((m) => m.labelKey === key);

  const signal = infraMetric("signal");
  const battery = infraMetric("battery");

  // One status per region — see the note above ObservatoryBento.
  const primaryStatus = worstStatus([status(salinity), status(waterLevel)]);
  const infraStatus = worstStatus([status(signal), status(battery)]);
  const waterStatus = advisoryStatus(waterEc, "water_ec");
  const soilStatus = advisoryStatus(soilPh, "soil_ph");

  // Every cell, without exception: same corner, same hairline, same inset.
  // A box differs from its neighbours only in what it spans and what colour
  // its status gives it — never in its construction.
  const cell = "rounded-xl border border-border";
  const padded = "flex flex-col justify-between p-[var(--bento-pad)]";

  return (
    <div
      className={cn(
        "grid gap-[var(--bento-gap)]",
        "aspect-[4/21] grid-cols-4 grid-rows-[repeat(21,minmax(0,1fr))]",
        "md:aspect-[2/5] md:grid-rows-[repeat(10,minmax(0,1fr))]",
        "lg:aspect-[3/2] lg:grid-cols-6 lg:grid-rows-4",
      )}
    >
      {/* BOX 0 — primary. Salinity and water level side by side, no divider,
          no nested card: one region, one surface, one status. */}
      <div
        className={cn(
          cell,
          padded,
          primaryStatus ? regionSurface(primaryStatus) : "bg-[var(--h-domain-water)]",
          "col-start-1 col-end-5 row-start-1 row-end-3",
          "md:col-start-1 md:col-end-5 md:row-start-1 md:row-end-2",
          "lg:col-start-1 lg:col-end-3 lg:row-start-1 lg:row-end-2",
        )}
      >
        {/* "QUAN TRẮC", not "NƯỚC": this box is the observatory's primary
            observation surface, not one domain among several. */}
        <RegionHeader icon={Waves} title={dict.nav.monitoring} status={primaryStatus} dict={dict} />
        {/* `auto auto`, not `grid-cols-2`.
            Equal halves gave each value exactly 170px at 1440 — and "1.24‰"
            at 60px measures 173px, so the pair collided while "48cm" left
            71px of its own half empty. Content-sized columns spend the width
            where the digits actually are: the same two values now occupy
            304px of 355px, which is what lets the primary numerals be the
            size they should be instead of the size equal halves allowed. */}
        {/* TWO EQUAL HALVES, matching the two square cells this 1x2 region is
            made of. Each value sits at the start of its own half, so the pair
            lines up with the grid the box is built on.
            `grid-cols-2`, not `1fr auto`: that variant pushed the second value
            to the far right edge, which detached it from its own square and
            made the box read as two things flung apart rather than two
            readings side by side. */}
        <div className="mt-auto grid grid-cols-2 items-baseline gap-x-4 gap-y-2 pt-[var(--bento-header-gap)]">
          <Value label={dict.metricLabels.salinity} metric={salinity} dict={dict} size="primary" />
          <Value label={dict.metricLabels.waterLevel} metric={waterLevel} dict={dict} size="primary" />
        </div>
      </div>

      {/* BOX 1 — the chart. Widest and tallest region in the grid. It carries
          no extra height floor of its own: the row tracks decide how tall it
          is, and a floor taller than the track pushed the plot down through
          the box's bottom edge. */}
      <div
        className={cn(
          cell,
          "min-w-0 overflow-hidden bg-surface p-[var(--bento-pad)] ring-1 ring-[var(--h-domain-water)]",
          "col-start-1 col-end-5 row-start-3 row-end-7",
          "md:col-start-1 md:col-end-5 md:row-start-2 md:row-end-4",
          "lg:col-start-3 lg:col-end-6 lg:row-start-1 lg:row-end-3",
        )}
      >
        <ObservationLog series={series} />
      </div>

      {/* BOX 2 — the map. It IS the region: edge to edge, no header bar, no
          inner padding.

          It previously carried a "VỊ TRÍ CÁC TRẠM" title strip above it, which
          cost the map ~10% of its height to state something the map already
          says — a reader looking at markers on a coastline does not need to be
          told it is a map. Losing the strip is what lets this read as
          geographic space rather than as a card that happens to contain a map.
          The region is labelled for assistive tech by the map's own
          `role="img"` + aria-label. */}
      <div
        className={cn(
          cell,
          "overflow-hidden bg-surface",
          "col-start-1 col-end-5 row-start-7 row-end-10",
          "md:col-start-1 md:col-end-5 md:row-start-4 md:row-end-6",
          "lg:col-start-1 lg:col-end-3 lg:row-start-2 lg:row-end-4",
        )}
      >
        {/* `basemapOnly` in demo: the island is real geography, the demo
            stations have no coordinates, and drawing the first without the
            second is exactly the honest combination. See the prop's own note. */}
        <StationNetworkMap stations={mapStations} variant="grid" basemapOnly={isDemo} />
      </div>

      {/* BOX 3 — infrastructure. Same region-level treatment as BOX 0: signal
          and battery share one surface and one status, at one tier down in
          the type ladder because device health is not what the page is for. */}
      <div
        className={cn(
          cell,
          padded,
          infraStatus ? regionSurface(infraStatus) : "bg-[var(--h-domain-infrastructure)]",
          "col-start-1 col-end-5 row-start-10 row-end-12",
          "md:col-start-1 md:col-end-5 md:row-start-6 md:row-end-7",
          "lg:col-start-5 lg:col-end-7 lg:row-start-3 lg:row-end-4",
        )}
      >
        {/* The infrastructure box is titled by WHAT THE NETWORK IS DOING,
            not by the word "Hạ tầng". "1/3 ĐANG GỬI DỮ LIỆU · BÌNH THƯỜNG"
            says everything the label said and everything the separate
            network line above the Bento used to say, in the box that already
            holds signal and battery — which is where a reader goes to ask
            the question anyway. The standalone "MẠNG LƯỚI · …" line is gone
            with it. */}
        <RegionHeader
          icon={Send}
          title={
            network.live > 0
              ? `${network.live}/${network.total} ${dict.monitoring.sendingData}`
              : dict.monitoring.noneSending
          }
          status={infraStatus}
          dict={dict}
        />
        {/* TWO EQUAL HALVES, matching the two square cells this 1x2 region is
            made of. Each value sits at the start of its own half, so the pair
            lines up with the grid the box is built on.
            `grid-cols-2`, not `1fr auto`: that variant pushed the second value
            to the far right edge, which detached it from its own square and
            made the box read as two things flung apart rather than two
            readings side by side. */}
        <div className="mt-auto grid grid-cols-2 items-baseline gap-x-4 gap-y-2 pt-[var(--bento-header-gap)]">
          {/* The contextual word comes from the SAME resolved status the box
              is tinted by, not from a second read of the raw value — so
              "Pin thấp" can never appear on a green surface. Both bands are
              real (BATTERY_V / SIGNAL_DBM in lib/monitoring/status.ts); no
              threshold is invented here. */}
          <Value
            label={dict.metricLabels.signal}
            metric={signal}
            dict={dict}
            size="secondary"
            note={deviceContext("signal", status(signal)?.level ?? null, dict)}
          />
          <Value
            label={dict.metricLabels.battery}
            metric={battery}
            dict={dict}
            size="secondary"
            note={deviceContext("battery", status(battery)?.level ?? null, dict)}
          />
        </div>
      </div>

      {/* BOX 4-7 — the four regional figures, each one base cell, each a
          secondary context layer.

          They use the SAME header grammar as every other box — icon, then a
          short uppercase label — with no status word, because there is none
          to give: statusFor() has no threshold for weather, so these can only
          ever render neutral. Their `*` marker is what says these come from
          outside the HORIZON network; the honest distinction here is
          provenance, not colour.

          `justify-between` rather than `justify-center` is what keeps the
          four aligned with each other: the header sits on the top edge and
          the value on the bottom, so a label that wraps to two lines in the
          narrowest cell (LƯỢNG MƯA at 390) pushes nothing — all four values
          still share one baseline. */}
      {(
        [
          { icon: Thermometer, label: dict.metricLabels.temperature, key: "temperature", cell: "col-start-1 col-end-3 row-start-12 row-end-14 md:col-start-1 md:col-end-2 md:row-start-7 md:row-end-8 lg:col-start-6 lg:col-end-7 lg:row-start-1 lg:row-end-2" },
          { icon: Droplets, label: dict.metricLabels.humidity, key: "humidity", cell: "col-start-3 col-end-5 row-start-12 row-end-14 md:col-start-2 md:col-end-3 md:row-start-7 md:row-end-8 lg:col-start-6 lg:col-end-7 lg:row-start-2 lg:row-end-3" },
          { icon: Wind, label: dict.metricLabels.wind, key: "wind", cell: "col-start-1 col-end-3 row-start-14 row-end-16 md:col-start-3 md:col-end-4 md:row-start-7 md:row-end-8 lg:col-start-3 lg:col-end-4 lg:row-start-3 lg:row-end-4" },
          { icon: CloudRain, label: dict.metricLabels.precipitation, key: "precipitation", cell: "col-start-3 col-end-5 row-start-14 row-end-16 md:col-start-4 md:col-end-5 md:row-start-7 md:row-end-8 lg:col-start-4 lg:col-end-5 lg:row-start-3 lg:row-end-4" },
        ] as const
      ).map(({ icon: Icon, label, key, cell: placement }) => (
        <div
          key={key}
          className={cn(
            cell,
            padded,
            "gap-1 bg-[var(--h-domain-weather)]",
            placement,
          )}
        >
          <div className="flex min-w-0 items-start gap-1.5 text-foreground-subtle">
            <Icon className="h-3.5 w-3.5 shrink-0 translate-y-px" aria-hidden />
            <span className="min-w-0 text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.1em]">
              {label}
            </span>
          </div>
          <ContextValue
            metric={contextMetric(key)}
            dict={dict}
            note={contextLine(key as ContextMetricKey, contextMetric(key)?.value ?? null, dict)}
          />
        </div>
      ))}

      {/* ROW 4 — two observation domains, each a single parent surface. */}
      <div
        className={cn(
          cell,
          padded,
          waterStatus ? regionSurface(waterStatus) : "bg-[var(--h-domain-water)]",
          "col-start-1 col-end-5 row-start-16 row-end-18",
          "md:col-start-1 md:col-end-5 md:row-start-8 md:row-end-9",
          "lg:col-start-1 lg:col-end-3 lg:row-start-4 lg:row-end-5",
        )}
      >
        <RegionHeader icon={Waves} title={dict.terms.water} status={waterStatus} dict={dict} />
        <div className="mt-auto grid grid-cols-2 gap-4 pt-2">
          <Value label={dict.metricLabels.waterEc} metric={waterEc} dict={dict} />
          <Value label={dict.metricLabels.waterTemp} metric={waterTemp} dict={dict} />
        </div>
      </div>

      <div
        className={cn(
          cell,
          soilStatus ? regionSurface(soilStatus) : "bg-[var(--h-domain-soil)]",
          "col-start-1 col-end-5 row-start-18 row-end-22 flex flex-col p-[var(--bento-pad)]",
          "md:col-start-1 md:col-end-5 md:row-start-9 md:row-end-11",
          "lg:col-start-3 lg:col-end-7 lg:row-start-4 lg:row-end-5",
        )}
      >
        <RegionHeader icon={Sprout} title={dict.terms.soil} status={soilStatus} dict={dict} />
        <div className="mt-2 grid flex-1 grid-cols-2 content-around gap-x-4 gap-y-2 lg:grid-cols-4 lg:items-end">
          <Value label={dict.metricLabels.moisture} metric={soilMoisture} dict={dict} />
          <Value label={dict.metricLabels.ec} metric={soilEc} dict={dict} />
          <Value label={dict.metricLabels.ph} metric={soilPh} dict={dict} />
          <Value label={dict.metricLabels.temperature} metric={soilTemp} dict={dict} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export function ObservatoryCanvas({
  model,
  weather: initialWeather = null,
  thresholds = [],
  soilModels = [],
}: {
  model: ObservatoryViewModel;
  /** The threshold registry (migration 023), loaded on the server. */
  thresholds?: ThresholdRow[];
  soilModels?: SoilWaterModel[];
  /** External regional context. Shares the canvas, never the provenance. */
  weather?: ExternalWeather | null;
}) {
  const dict = useDict();
  const [weather, setWeather] = useState<ExternalWeather | null>(initialWeather);
  const [weatherSeries24h, setWeatherSeries24h] = useState<ObservationSeries | null>(null);

  useEffect(() => {
    let active = true;

    async function refreshWeatherHistory() {
      try {
        const response = await fetch("/api/public/weather/history", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        const series = weatherHistoryToObservationSeries(payload.latest ?? null);
        if (active) setWeatherSeries24h(series);
      } catch {
        // Keep the last server-rendered chart series if external history is unavailable.
      }
    }

    const id = window.setInterval(refreshWeatherHistory, WEATHER_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const series = useMemo(() => {
    if (!weatherSeries24h) return model.series;

    return {
      ...model.series,
      "24h": mergeWeather24hSeries(model.series["24h"], weatherSeries24h),
    };
  }, [model.series, weatherSeries24h]);

  useEffect(() => {
    let active = true;

    async function refreshWeather() {
      try {
        const response = await fetch("/api/public/weather", { cache: "no-store" });
        if (!response.ok) {
          if (active) setWeather(null);
          return;
        }

        const payload = await response.json();
        if (active) setWeather(payload.latest ?? null);
      } catch {
        if (active) setWeather(null);
      }
    }

    const id = window.setInterval(refreshWeather, WEATHER_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  // Domain-grouped, not station-grouped — see lib/monitoring/signals.ts for
  // why this is the information architecture rather than a layout choice.
  // Weather joins the SAME canvas here rather than being rendered as its own
  // block below it; buildSignalGroups keeps its provenance distinct.
  const signalGroups = buildSignalGroups(model, weather, null);
  // Status colour is only permitted where a threshold genuinely exists. The
  // model carries the configured salinity levels; every other environmental
  // metric has no basis in this system and renders neutral by design.
  const salinityThreshold = model.salinityThreshold;

  // Real coordinates only. `buildObservatory` falls back to lat/lng 0 for a
  // station with no snapshot row, and 0,0 is a real place in the Gulf of
  // Guinea — plotting three markers there would be inventing geography, not
  // reporting it. Filtering here keeps the map's own honest empty state as
  // the thing a reader sees until real coordinates arrive.
  // Positions come from lib/geo.ts, NOT from the station rows.
  //
  // That file is explicit that it is the authority: a database row is
  // operational state that can be edited, seeded, or left at a 0,0 default —
  // and 0,0 is a real place in the Gulf of Guinea. The previous version read
  // `s.lat`/`s.lng` off the row and then filtered out 0,0, so on a database
  // whose rows carry no coordinates the map correctly refused to invent
  // geography and drew nothing at all. Home already read from geo.ts; this is
  // the same fix applied to the observatory, so both surfaces plot the same
  // three surveyed points.
  //
  // Memoised so the array identity is stable across the polling re-renders
  // above; without that the map re-initialises on every tick.
  const mapStations: MapStation[] = useMemo(
    () =>
      model.mode === "real"
        ? model.stations.flatMap((s) => {
            const point = STATION_COORDS[s.id as PilotStationId];
            if (!point) return [];
            return [{ id: s.id, name: s.name, lat: point.lat, lng: point.lng, freshness: s.freshness }];
          })
        : [],
    [model.mode, model.stations],
  );

  return (
    <div className="space-y-10 md:space-y-14">
      {/* The observatory: the Bento, and nothing above it.
          Two bands used to sit here — a demo notice explaining the `*` and
          `~` markers, and a "MẠNG LƯỚI · 2/3 ĐANG GỬI DỮ LIỆU" summary. The
          markers are gone, which left the notice explaining nothing; and the
          summary now titles the infrastructure box, where the reader is
          already looking at the network's signal and battery. Demo mode is
          still declared, once, by the badge beside the page title. */}
      {/* THE DEEP-LINK TARGET.
          `/dashboard#observatory` is what a QR code printed on a station in
          the field resolves to, and it is where `/s/:id` now redirects. The
          landing has to put the Bento under the reader's eyes, not under the
          sticky header — hence `scroll-mt`, sized against --header-h plus a
          little air rather than a guessed constant. */}
      <section id="observatory" className="instrument-in scroll-mt-[calc(var(--header-h)+1.5rem)]">
        <ObservatoryBento
          groups={signalGroups}
          dict={dict}
          isDemo={model.mode === "demo"}
          salinityThreshold={salinityThreshold}
          thresholds={thresholds}
          series={series}
          mapStations={mapStations}
          network={model.network}
        />
      </section>

      <section className="instrument-in-2 space-y-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            {dict.monitoring.referenceEyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{dict.monitoring.referenceTitle}</h2>
        </div>
        {/* One registry, one disclosure grammar. Every public reference here
            is attached to a quantity, quality condition or active device
            interpretation — there is no separate editorial list with a
            different authority signal. */}
        {thresholds.length > 0 ? (
          <ThresholdTable rows={thresholds} soilModels={soilModels} />
        ) : null}
      </section>
    </div>
  );
}
