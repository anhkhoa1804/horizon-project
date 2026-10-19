import type { DataProvenance } from "@/lib/dataState";
import type { ExternalWeather } from "@/lib/external/weather";
import type {
  LocalGatewayReading,
  MetricDomain,
  MetricLabelKey,
  ObservatoryMetric,
  ObservatoryStation,
  ObservatoryViewModel,
} from "./types";

/**
 * Reshapes the station-shaped view model into the domain-shaped one the
 * metric-first canvas renders.
 *
 * WHY THIS EXISTS — the information architecture decision.
 *
 * HORIZON has three stations but roughly ten measurements, and the
 * station-per-card layout that preceded this made the page answer "what
 * hardware exists?" when the question a reader actually arrives with is
 * "what is happening to the water and the soil?". Grouping by physical
 * domain answers the second question, and — because the domain a reading
 * belongs to is a property of the reading, not of the box it sits in — it
 * scales if a fourth station is ever added.
 *
 * Station identity is NOT discarded. Each group carries the station that
 * produced it, so attribution appears once as group context rather than
 * being repeated on all eight metric cells. That was the explicit
 * requirement: every metric must still reveal its source, without the page
 * printing "Trạm Đất" six times.
 *
 * Note the asymmetry this deliberately produces: STATION_02 contributes to
 * BOTH the soil and air groups, because it physically carries both a soil
 * probe and an SHT30. A station-first layout hides that; a domain-first one
 * makes it visible, which is the more truthful description of the hardware.
 */

export interface SignalGroup {
  domain: MetricDomain | "infrastructure" | "context";
  /**
   * Where the group's readings come from.
   *
   * `external` groups share the canvas with HORIZON's own, because the
   * previous layout put regional weather in a visually foreign block —
   * borderless, smaller type, separate heading — and the two read as
   * unrelated worlds. The separation was scientifically right and visually
   * far too strong.
   *
   * What merges is the CANVAS. What does not merge is the provenance: every
   * external value still carries `origin: "external"`, still renders its
   * marker, and still names its source. One instrument surface, two clearly
   * labelled origins.
   */
  origin: "horizon" | "external";
  /**
   * The station these readings physically come from — rendered once, as
   * group context. `null` for external groups: regional weather has no
   * station and must never be given a station id, which would make a third
   * party's grid forecast look like HORIZON hardware.
   */
  station: ObservatoryStation | null;
  /** What to print as the group's source line — a station name, or a provider. */
  attribution: string;
  /**
   * The group's headline reading, given the largest cell. `null` for
   * infrastructure, which reports link health rather than an environmental
   * quantity and should not be given a big numeral.
   */
  primary: ObservatoryMetric | null;
  /** Everything else in this domain, in the order the model supplied it. */
  secondary: ObservatoryMetric[];
  /** Gateway only — prose describing what this node does, in place of a value. */
  capabilityNote: string | null;
}

const GATEWAY_TEMPERATURE_MAX_AGE_MS = 10 * 60 * 1000;
const GATEWAY_TEMPERATURE_MIN_C = -20;
const GATEWAY_TEMPERATURE_MAX_C = 60;

/**
 * How many of a group's readings currently carry a value. Drives cell
 * geometry so a group with six live readings is not given the same width as
 * one reporting nothing.
 */
export function populatedCount(group: SignalGroup): number {
  const all = group.primary ? [group.primary, ...group.secondary] : group.secondary;
  return all.filter((m) => m.value !== null).length;
}

export function buildSignalGroups(
  model: ObservatoryViewModel,
  weather?: ExternalWeather | null,
  localGatewayReading?: LocalGatewayReading | null,
): SignalGroup[] {
  const groups: SignalGroup[] = [];

  const water = model.stations.find((s) => s.kind === "water");
  const soil = model.stations.find((s) => s.kind === "soil");
  const gateway = model.stations.find((s) => s.kind === "gateway");

  if (water) {
    groups.push({
      domain: "water",
      origin: "horizon",
      station: water,
      attribution: water.name,
      // Salinity — the reading the whole project was started for.
      primary: water.primary,
      secondary: metricsForDomain(water, "water"),
      capabilityNote: null,
    });
  }

  if (soil) {
    groups.push({
      domain: "soil",
      origin: "horizon",
      station: soil,
      attribution: soil.name,
      primary: soil.primary,
      secondary: metricsForDomain(soil, "soil"),
      capabilityNote: null,
    });

    const air = metricsForDomain(soil, "air");
    if (air.length > 0) {
      groups.push({
        // Same station, separate group: air temperature is not a soil
        // property, and folding the SHT30's readings in with the soil probe's
        // would imply one instrument measured all of it.
        domain: "air",
        origin: "horizon",
        station: soil,
        attribution: soil.name,
        primary: null,
        secondary: air,
        capabilityNote: null,
      });
    }
  }

  if (gateway) {
    groups.push({
      domain: "infrastructure",
      origin: "horizon",
      station: gateway,
      attribution: gateway.name,
      // No headline numeral: the gateway reports link health, not an
      // environmental quantity, and rendering its signal at instrument scale
      // would imply it measures the environment like the other two nodes.
      primary: null,
      // The gateway's signal strength lives on `primary` in the model (it is
      // that node's headline reading) while battery lives on `device`. Both
      // are demoted to secondary here — but both must still be SHOWN.
      // Taking only `device` silently dropped the signal reading entirely.
      secondary: [gateway.primary, ...gateway.device],
      capabilityNote: gateway.capabilityNote,
    });
  }

  // Regional context, last — it frames HORIZON's own readings rather than
  // competing with them. Omitted entirely when the adapter returned null:
  // an empty external group would imply HORIZON measures something it does
  // not, which is the opposite of what an empty HORIZON group means.
  const localTemperature = localGatewayTemperatureMetric(localGatewayReading);
  if (weather || localTemperature) {
    const external = weather ? externalMetrics(weather, !!localTemperature) : [];
    const contextMetrics = localTemperature ? [localTemperature, ...external] : external;
    if (contextMetrics.length > 0) {
      groups.push({
        domain: "context",
        origin: "external",
        station: null,
        attribution: localTemperature ? "Local gateway" : `${weather!.area} · ${weather!.source}`,
        primary: null,
        secondary: contextMetrics,
        capabilityNote: null,
      });
    }
  }

  return groups;
}

/**
 * Projects the weather adapter's result onto the same `ObservatoryMetric`
 * shape the rest of the canvas renders, so one cell component draws every
 * value on the page.
 *
 * Each carries `origin: "external"` and the provider's own name — that pair
 * is what the asterisk marker and the footnote are rendered from, and it is
 * why sharing a cell component does not blur the two data sources.
 *
 * Unparseable fields are dropped rather than rendered as a dash: a missing
 * external field means the provider did not supply it, which is not the same
 * claim as HORIZON's "chưa có dữ liệu" (our instrument has not reported).
 */
function externalMetrics(weather: ExternalWeather, omitTemperature = false): ObservatoryMetric[] {
  const provenance: DataProvenance = {
    origin: "external",
    source: weather.source,
    sourceUrl: weather.sourceUrl,
    observedAt: weather.observedAt ?? undefined,
  };

  const fields: Array<[MetricLabelKey, number | null, string, number]> = [
    ["temperature", omitTemperature ? null : weather.temperatureC, "°C", 1],
    ["humidity", weather.humidityPct, "%", 0],
    ["wind", weather.windKph, "km/h", 1],
    ["precipitation", weather.precipitationMm, "mm", 1],
  ];

  return fields
    .filter(([, value]) => value !== null)
    .map(([labelKey, value, unit, digits]) => ({
      label: labelKey,
      labelKey,
      value: (value as number).toFixed(digits),
      unit,
      provenance,
    }));
}

function localGatewayTemperatureMetric(reading?: LocalGatewayReading | null): ObservatoryMetric | null {
  if (reading?.air_temp_c == null) return null;
  if (!Number.isFinite(reading.air_temp_c)) return null;
  if (
    reading.air_temp_c < GATEWAY_TEMPERATURE_MIN_C ||
    reading.air_temp_c > GATEWAY_TEMPERATURE_MAX_C
  ) {
    return null;
  }

  if (reading.receivedAt) {
    const observedMs = Date.parse(reading.receivedAt);
    if (!Number.isFinite(observedMs)) return null;
    if (Date.now() - observedMs > GATEWAY_TEMPERATURE_MAX_AGE_MS) return null;
  }

  return {
    label: "temperature",
    labelKey: "temperature",
    value: reading.air_temp_c.toFixed(2),
    unit: "\u00b0C",
    provenance: {
      origin: "telemetry",
      source: "Local gateway",
      observedAt: reading.receivedAt ?? undefined,
    },
  };
}

function metricsForDomain(station: ObservatoryStation, domain: MetricDomain): ObservatoryMetric[] {
  return station.environment.filter((g) => g.domain === domain).flatMap((g) => g.metrics);
}

// ---------------------------------------------------------------------------
// The metric-driven canvas
// ---------------------------------------------------------------------------

/**
 * One cell of the observatory canvas: a single measurement, with the context
 * needed to read it honestly.
 *
 * WHY A FLAT LIST RATHER THAN GROUPS.
 *
 * The previous canvas rendered four domain GROUPS, each a bordered card
 * containing its own metrics. That was already better than station cards, but
 * it left the page reading as six boxes — and the external weather box, even
 * sharing the grid, still looked like a separate section because it was a box
 * of its own beside other boxes.
 *
 * Flattening to one cell per measurement removes the box boundary entirely.
 * Salinity, soil EC and regional wind become the same kind of object on the
 * same surface, differing only in what each one says about itself: its
 * domain, its attribution, and its provenance marker. That is what makes it
 * ONE instrument rather than several panels.
 *
 * `weight` drives how much room a cell gets, and it is derived from
 * information density rather than assigned: a reading with a value earns more
 * space than one that has never reported, and the gateway's link health stays
 * narrow because it is operational context, not an environmental quantity.
 */
export type CellSize = "large" | "medium" | "small";

/**
 * A tile's footprint in the 12-column mosaic.
 *
 * These are HAND-COMPOSED, not derived. The reference bento layouts the owner
 * pointed at are designed compositions — a tall portrait beside a wide strip
 * beside a small square — and no generic rule reproduces that from metric
 * metadata alone. An algorithm gave every tile the same handful of widths and
 * the result read as a spreadsheet, which was the complaint.
 *
 * The pilot's metric set is fixed and known (three stations, eleven
 * measurements), so composing it by hand is honest rather than brittle:
 * there is a real design decision behind each footprint. `FALLBACK` covers
 * anything unrecognised so a new metric still lands somewhere sensible.
 */
export interface TileFootprint {
  col: number;
  row: number;
}

/**
 * What each measurement is worth on the page.
 *
 * Salinity, water level and soil moisture are why HORIZON exists — they are
 * the readings a farmer or reviewer actually came for. The soil chemistry
 * cluster supports them. Wind, rainfall and the gateway's own link health
 * are context: real, worth showing, never the subject.
 */
const IMPORTANCE: Record<string, CellSize> = {
  salinity: "large",
  waterLevel: "large",
  moisture: "large",
  ec: "medium",
  ph: "medium",
  temperature: "medium",
  humidity: "medium",
  wind: "small",
  precipitation: "small",
  signal: "small",
  battery: "small",
};

/**
 * The composition.
 *
 * Read as (columns of 12, rows of the tile track). Salinity is the reason the
 * project exists, so it anchors the mosaic as the one genuinely large tile.
 * Soil moisture is a tall portrait beside it. Water level is a wide strip.
 * The soil chemistry cluster fills the middle band at mixed widths, and the
 * small operational and context tiles pack the remainder.
 *
 * Rows sum deliberately imperfectly — `grid-auto-flow: dense` back-fills the
 * gaps, which is what produces a mosaic instead of tidy rows.
 */
const FOOTPRINT: Record<string, TileFootprint> = {
  salinity: { col: 5, row: 2 },
  moisture: { col: 3, row: 2 },
  waterLevel: { col: 4, row: 1 },
  temperature: { col: 4, row: 1 },
  humidity: { col: 4, row: 1 },
  ec: { col: 3, row: 1 },
  ph: { col: 2, row: 1 },
  wind: { col: 3, row: 1 },
  precipitation: { col: 3, row: 1 },
  signal: { col: 3, row: 1 },
  battery: { col: 2, row: 1 },
};

const FALLBACK: TileFootprint = { col: 3, row: 1 };

export interface CanvasMetric {
  /** Stable key for React and for tests — domain + label, unique per canvas. */
  id: string;
  domain: MetricDomain | "infrastructure" | "context";
  metric: ObservatoryMetric;
  /** "Trạm Đất · Dữ liệu đất", or "Vĩnh Long · Ngoài mạng lưới" for external. */
  attribution: string;
  /** null for anything that did not come from HORIZON hardware. */
  stationId: string | null;
  origin: "horizon" | "external";
  /**
   * How much room this measurement deserves, from WHAT IT IS — not from
   * whether it happens to have a value today.
   *
   * This distinction is the whole reason the canvas stopped reading as a
   * Bento. Sizing by availability meant that in real mode, where almost
   * nothing has reported, every HORIZON cell collapsed to the same compact
   * width and the grid became nine identical boxes. Importance is stable, so
   * the composition holds its shape whether the network is silent or fully
   * reporting — which is exactly what a reader needs in order to learn the
   * page's structure before the data arrives.
   */
  size: CellSize;
  /**
   * The tile's footprint in the mosaic. Width carries hierarchy; height is
   * reduced to one row when the tile has nothing to show, so an unreported
   * metric keeps its place in the composition without holding open a tall
   * blank rectangle.
   */
  footprint: TileFootprint;
  /**
   * A second reading shown beneath the primary one, smaller.
   *
   * Used to pair HORIZON's own air temperature and humidity with the regional
   * figures for the same quantity. They measure the same thing — one at the
   * station, one across the province — so two separate tiles asked the reader
   * to reconcile them. One tile with the measured value large and the
   * regional value secondary states the relationship directly, and the
   * marker still keeps the provenance apart.
   */
  companion: { metric: ObservatoryMetric; attribution: string } | null;
}

/**
 * Flattens the domain groups into the cell list the canvas renders.
 *
 * Provenance is untouched: every cell keeps the `DataProvenance` its metric
 * arrived with, which is what the `*` / `~` markers and the source footnote
 * are drawn from. The canvas is unified; the origins are not.
 */
export function buildCanvasMetrics(groups: SignalGroup[], outsideNetworkLabel: string): CanvasMetric[] {
  const cells: CanvasMetric[] = [];

  // Regional readings that duplicate a HORIZON quantity are held back here
  // and attached to the matching station tile instead of getting one of their
  // own. Wind and rainfall have no station counterpart, so they stay as
  // standalone context tiles.
  const externalGroup = groups.find((g) => g.origin === "external");
  const externalAttribution = externalGroup
    ? `${externalGroup.attribution.split(" · ")[0]} · ${outsideNetworkLabel}`
    : outsideNetworkLabel;
  const pairable = new Map<string, ObservatoryMetric>();
  for (const metric of externalGroup?.secondary ?? []) {
    if (metric.labelKey === "temperature" || metric.labelKey === "humidity") {
      pairable.set(metric.labelKey, metric);
    }
  }

  // Standalone external tiles (wind, rainfall — anything with no station
  // counterpart to pair against) are sized to fill their own row evenly
  // rather than keeping a fixed narrow width. A fixed col-3 here was the
  // cause of a real, screenshot-confirmed defect: when they land last in
  // flow with nothing left to pack beside them, a narrow tile strands with
  // most of the row empty. Splitting 12 columns across however many
  // standalone fields exist (2 today: wind + rain) guarantees the row is
  // always full.
  const standaloneExternalKeys = (externalGroup?.secondary ?? [])
    .map((m) => m.labelKey)
    .filter((k): k is "wind" | "precipitation" => k === "wind" || k === "precipitation");
  const standaloneExternalCol = standaloneExternalKeys.length > 0
    ? Math.max(3, Math.min(6, Math.floor(12 / standaloneExternalKeys.length)))
    : 6;

  // Companion-carrying tiles (a HORIZON air reading paired with its regional
  // counterpart) have the same fill-the-row need as the standalone tiles
  // above, for the same reason: FOOTPRINT.temperature/.humidity is sized for
  // the ORDINARY case (no second line), so when exactly two of them land
  // together — air temperature and air humidity, todays only pairable
  // metrics — their base widths (4 + 4 = 8) leave a quarter of the row
  // structurally empty. That gap is real, not a screenshot artefact: it
  // showed up in production as visible background where a tile should be.
  const airGroup = groups.find((g) => g.domain === "air");
  const companionCount = airGroup
    ? airGroup.secondary.filter((m) => pairable.has(m.labelKey ?? "")).length
    : 0;
  const companionCol = companionCount > 0 ? Math.max(4, Math.min(6, Math.floor(12 / companionCount))) : 6;

  for (const group of groups) {
    const isExternal = group.origin === "external";

    const entries: Array<{ metric: ObservatoryMetric; headline: boolean }> = [
      ...(group.primary ? [{ metric: group.primary, headline: true }] : []),
      ...group.secondary.map((metric) => ({ metric, headline: false })),
    ];

    for (const { metric, headline } of entries) {
      const key = metric.labelKey ?? "";

      // Skip the regional temperature/humidity here — they are rendered as
      // the secondary line of the station tile for the same quantity.
      if (isExternal && pairable.has(key) && groups.some((g) => g.domain === "air")) {
        continue;
      }

      const hasValue = metric.value !== null;

      // Infrastructure is context regardless of what it reports: link health
      // is not an environmental quantity, and giving it a large tile would
      // imply the gateway measures the world like the other two nodes.
      const size: CellSize =
        group.domain === "infrastructure"
          ? "small"
          : (IMPORTANCE[key] ?? (headline ? "large" : "medium"));

      // Only the station's own air readings adopt a regional companion.
      // Computed BEFORE the footprint, because a companion adds a second line
      // of text that a single-row tile does not have room for — the previous
      // order left air temperature's regional line clipped by the card's
      // fixed-height row track. See the row bump below.
      const companion =
        group.domain === "air" && pairable.has(key)
          ? { metric: pairable.get(key)!, attribution: externalAttribution }
          : null;

      const base = FOOTPRINT[key] ?? FALLBACK;
      const isStandaloneExternal = key === "wind" || key === "precipitation";
      // Width is fixed by the composition EXCEPT for the two tile families
      // that otherwise leave the row visibly unfilled: the standalone
      // regional readings and the companion-carrying air readings. Height
      // collapses to one row when the tile has nothing to show, so a silent
      // network keeps its shape without a column of tall empty rectangles —
      // but a POPULATED tile carrying a companion always gets two rows
      // regardless of its base, because the label, primary value, companion
      // line and attribution together do not fit in one 7.5rem track. Wind
      // and rainfall get two rows unconditionally: they are only ever
      // rendered with a real value (see externalMetrics — null fields are
      // dropped before this function ever sees them), and at a single row
      // their wide, short proportion read as flattened rather than a
      // deliberate tile — the mosaic's other headline readings (salinity,
      // moisture) are all two rows for the same reason.
      const footprint: TileFootprint = {
        col: isStandaloneExternal ? standaloneExternalCol : companion ? companionCol : base.col,
        row: isStandaloneExternal ? 2 : !hasValue ? 1 : companion ? 2 : base.row,
      };

      cells.push({
        id: `${group.domain}-${key || metric.label}`,
        domain: group.domain,
        metric,
        attribution: isExternal
          ? externalAttribution
          : `${group.station?.name ?? group.attribution}`,
        stationId: group.station?.id ?? null,
        origin: group.origin,
        size,
        footprint,
        companion,
      });
    }
  }

  return cells;
}

/**
 * Column span, read straight off the composed footprint.
 *
 * Kept as a function rather than inlined so the tests can assert the mosaic's
 * properties — that the widths genuinely differ, and that nothing is narrower
 * than a metric label can render in.
 */
export function colSpanFor(cell: Pick<CanvasMetric, "footprint">): number {
  return cell.footprint.col;
}

export function rowSpanFor(cell: Pick<CanvasMetric, "footprint">): number {
  return cell.footprint.row;
}
