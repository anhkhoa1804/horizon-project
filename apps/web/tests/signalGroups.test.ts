import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanvasMetrics,
  buildSignalGroups,
  colSpanFor,
  populatedCount,
  rowSpanFor,
} from "@/lib/monitoring/signals";
import { mergeWeather24hSeries, weatherHistoryToObservationSeries } from "@/lib/monitoring/weatherSeries";
import { getObservatoryViewModel } from "@/lib/monitoring/buildObservatory";
import { vi } from "@/lib/i18n/vi";

type ObservatoryMetricLike = { label: string };
import { en } from "@/lib/i18n/en";

/**
 * The metric-first canvas groups readings by physical domain rather than by
 * station. These tests pin the properties that make that honest:
 * every station still contributes, attribution is preserved, and an empty
 * network still produces a full set of groups rather than a blank page.
 */

describe("signal groups — demo mode", () => {
  it("produces water, soil, air and infrastructure groups", async () => {
    const model = await getObservatoryViewModel("demo", vi);
    const groups = buildSignalGroups(model);

    assert.deepEqual(
      groups.map((g) => g.domain),
      ["water", "soil", "air", "infrastructure"],
    );
  });

  it("keeps every station represented — none is dropped by regrouping", async () => {
    const model = await getObservatoryViewModel("demo", vi);
    const groups = buildSignalGroups(model);

    const stationIds = new Set(groups.map((g) => g.station?.id).filter(Boolean));
    for (const station of model.stations) {
      assert.ok(stationIds.has(station.id), `${station.id} vanished from the canvas`);
    }
  });

  it("attributes soil and air to the SAME station, because one node carries both", async () => {
    // STATION_02 physically holds the soil probe and the SHT30. Domain-first
    // grouping surfaces that; station-first grouping hid it.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi));
    const soil = groups.find((g) => g.domain === "soil");
    const air = groups.find((g) => g.domain === "air");

    assert.ok(soil?.station && air?.station);
    assert.equal(soil.station.id, air.station.id);
  });

  it("gives environmental groups a primary reading and infrastructure none", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi));

    assert.ok(groups.find((g) => g.domain === "water")?.primary, "water needs a headline value");
    assert.ok(groups.find((g) => g.domain === "soil")?.primary, "soil needs a headline value");
    // Infrastructure reports link health, not an environmental quantity — a
    // giant numeral there would imply a measurement it does not take.
    assert.equal(groups.find((g) => g.domain === "infrastructure")?.primary, null);
  });

  it("does not drop the gateway's signal reading when demoting it from primary", async () => {
    // Regression guard. The gateway's signal strength is its `primary` in the
    // model; the infrastructure group sets `primary: null` (no giant numeral
    // for a link-health value) and initially took only `device` — which
    // silently discarded the signal reading altogether. Every reading the
    // model produced must survive regrouping.
    const model = await getObservatoryViewModel("demo", vi);
    const gateway = model.stations.find((s) => s.kind === "gateway");
    const group = buildSignalGroups(model).find((g) => g.domain === "infrastructure");

    assert.ok(gateway && group);
    const labels = group.secondary.map((m) => m.label);
    assert.ok(labels.includes(gateway.primary.label), "gateway primary reading was dropped");
    for (const device of gateway.device) {
      assert.ok(labels.includes(device.label), `device reading ${device.label} was dropped`);
    }
  });

  it("preserves every model reading across regrouping, for all stations", async () => {
    // The general form of the bug above: regrouping must be lossless.
    const model = await getObservatoryViewModel("demo", vi);
    const groups = buildSignalGroups(model);

    const rendered = new Set(
      groups.flatMap((g) => (g.primary ? [g.primary, ...g.secondary] : g.secondary)).map((m) => m.label),
    );

    for (const station of model.stations) {
      const produced = [
        station.primary,
        ...station.environment.flatMap((e) => e.metrics),
        ...station.device,
      ];
      for (const metric of produced) {
        assert.ok(rendered.has(metric.label), `${station.id}'s "${metric.label}" never reaches the canvas`);
      }
    }
  });

  it("carries real values in demo mode, so the canvas can be evaluated", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi));
    const total = groups.reduce((sum, g) => sum + populatedCount(g), 0);
    assert.ok(total > 5, `demo mode should populate the canvas, got ${total} values`);
  });

  it("tags every metric with a translatable label key", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi));
    for (const group of groups) {
      const all = group.primary ? [group.primary, ...group.secondary] : group.secondary;
      for (const metric of all) {
        assert.ok(metric.labelKey, `"${metric.label}" has no labelKey and cannot be translated`);
      }
    }
  });

  it("marks every demo value's provenance as demo — never as telemetry", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi));
    for (const group of groups) {
      const all = group.primary ? [group.primary, ...group.secondary] : group.secondary;
      for (const metric of all.filter((m) => m.value !== null)) {
        assert.equal(
          metric.provenance.origin,
          "demo",
          `${metric.label} carries a demo value labelled "${metric.provenance.origin}"`,
        );
      }
    }
  });
});

describe("signal groups — real mode with a sparse network", () => {
  it("still renders every group when nothing has reported", async () => {
    // Production currently holds zero soil rows. The canvas must not collapse
    // to a blank page — an empty group is information ("we measure this, it
    // has not reported"), not an absence.
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi));

    assert.deepEqual(
      groups.map((g) => g.domain),
      ["water", "soil", "air", "infrastructure"],
    );
  });

  it("preserves the station name on every group so attribution never disappears", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi));
    for (const group of groups) {
      assert.ok(group.station, `${group.domain} lost its station`);
      assert.ok(group.station.name.length > 0, `${group.domain} lost its station attribution`);
      assert.ok(group.station.id.startsWith("STATION_"));
    }
  });

  it("reports zero populated values without throwing when the network is silent", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi));
    for (const group of groups) {
      assert.ok(populatedCount(group) >= 0);
    }
  });

  it("never fabricates a value to fill an empty cell", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi));
    for (const group of groups) {
      const all = group.primary ? [group.primary, ...group.secondary] : group.secondary;
      for (const metric of all) {
        if (metric.value !== null) {
          // Any value present in real mode must come from a real origin.
          assert.notEqual(metric.provenance.origin, "demo", `${metric.label} shows demo data in real mode`);
        }
      }
    }
  });
});

/**
 * The unified observatory canvas.
 *
 * External regional weather now shares the canvas with HORIZON telemetry
 * instead of living in a visually separate block. That merge is only
 * defensible while the PROVENANCE stays separate, so these tests pin the
 * boundary rather than the layout: an external value must never acquire a
 * station, a freshness, or a telemetry origin, and a HORIZON value must
 * never acquire an external marker.
 */
const WEATHER = {
  temperatureC: 30.4,
  humidityPct: 71,
  windKph: 15.6,
  precipitationMm: 0,
  observedAt: "2026-08-22T09:45",
  area: "Vĩnh Long",
  source: "Open-Meteo",
  sourceUrl: "https://open-meteo.com/",
};

describe("unified canvas — external context", () => {
  it("omits the context group entirely when the adapter returned null", async () => {
    // An empty external group would imply HORIZON measures something it does
    // not. Absence of external data is not the same claim as an empty
    // HORIZON group ("we measure this, it has not reported").
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), null);
    assert.ok(!groups.some((g) => g.domain === "context"));
    assert.ok(!groups.some((g) => g.origin === "external"));
  });

  it("appends regional context last, after every HORIZON group", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    assert.equal(groups.at(-1)?.domain, "context");
    assert.equal(groups.at(-1)?.origin, "external");
  });

  it("never gives external readings a station or a station id", async () => {
    const group = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER).find(
      (g) => g.origin === "external",
    );
    assert.ok(group);
    assert.equal(group.station, null, "external data must not be attributed to a HORIZON station");
    assert.match(group.attribution, /Open-Meteo/);
  });

  it("marks every external value with the external origin, and no HORIZON value with it", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    for (const group of groups) {
      const all = group.primary ? [group.primary, ...group.secondary] : group.secondary;
      for (const metric of all) {
        if (group.origin === "external") {
          assert.equal(metric.provenance.origin, "external", `${metric.label} lost its external origin`);
          assert.equal(metric.provenance.source, "Open-Meteo");
        } else {
          assert.notEqual(metric.provenance.origin, "external", `${metric.label} was wrongly marked external`);
        }
      }
    }
  });

  it("keeps a genuine zero rather than dropping it as missing", async () => {
    // 0.0 mm of rain is an observation. Dropping it would silently turn "no
    // rain" into "the provider sent nothing".
    const group = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER).find(
      (g) => g.origin === "external",
    );
    const rain = group?.secondary.find((m) => m.labelKey === "precipitation");
    assert.ok(rain, "a 0 mm reading was dropped from the canvas");
    assert.equal(rain.value, "0.0");
  });

  it("keeps wind speed at one decimal place instead of rounding to a whole number", async () => {
    const group = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER).find(
      (g) => g.origin === "external",
    );
    const wind = group?.secondary.find((m) => m.labelKey === "wind");

    assert.ok(wind);
    assert.equal(wind.value, "15.6");
  });

  it("drops only the fields the provider could not supply", async () => {
    const partial = { ...WEATHER, windKph: null, precipitationMm: null };
    const group = buildSignalGroups(await getObservatoryViewModel("demo", vi), partial).find(
      (g) => g.origin === "external",
    );
    assert.ok(group);
    const keys = group.secondary.map((m) => m.labelKey);
    assert.deepEqual(keys, ["temperature", "humidity"]);
  });

  it("still gives every external metric a translatable label key", async () => {
    const group = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER).find(
      (g) => g.origin === "external",
    );
    for (const metric of group?.secondary ?? []) {
      assert.ok(metric.labelKey, `"${metric.label}" cannot be translated`);
    }
  });

  it("leaves the HORIZON groups untouched when weather is added", async () => {
    const model = await getObservatoryViewModel("demo", vi);
    const without = buildSignalGroups(model);
    const with_ = buildSignalGroups(model, WEATHER).filter((g) => g.origin === "horizon");
    assert.deepEqual(
      with_.map((g) => g.domain),
      without.map((g) => g.domain),
    );
  });

  it("uses the gateway temperature while it is fresh and keeps Open-Meteo as backup", async () => {
    const gatewayReading = {
      gateway_id: "GATEWAY_01",
      station_id: "STATION_01",
      message_id: "temp-123",
      air_temp_c: 31.81,
      receivedAt: new Date().toISOString(),
    };
    const group = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER, gatewayReading).find(
      (g) => g.domain === "context",
    );

    assert.ok(group);
    const temperature = group.secondary.filter((m) => m.labelKey === "temperature");
    assert.equal(temperature.length, 1, "temperature should not be duplicated");
    assert.equal(temperature[0].value, "31.81");
    assert.equal(temperature[0].provenance.origin, "telemetry");
    assert.deepEqual(
      group.secondary.map((m) => m.labelKey),
      ["temperature", "humidity", "wind", "precipitation"],
    );
  });

  it("falls back to Open-Meteo temperature when the gateway temperature is stale", async () => {
    const staleGatewayReading = {
      gateway_id: "GATEWAY_01",
      station_id: "STATION_01",
      message_id: "temp-old",
      air_temp_c: 31.81,
      receivedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    };
    const group = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER, staleGatewayReading).find(
      (g) => g.domain === "context",
    );
    const temperature = group?.secondary.find((m) => m.labelKey === "temperature");

    assert.ok(temperature);
    assert.equal(temperature.value, "30.4");
    assert.equal(temperature.provenance.origin, "external");
    assert.equal(temperature.provenance.source, "Open-Meteo");
  });

  it("falls back to Open-Meteo temperature when the gateway value is outside the valid sensor range", async () => {
    const badGatewayReading = {
      gateway_id: "GATEWAY_01",
      station_id: "STATION_01",
      message_id: "temp-bad",
      air_temp_c: 85,
      receivedAt: new Date().toISOString(),
    };
    const group = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER, badGatewayReading).find(
      (g) => g.domain === "context",
    );
    const temperature = group?.secondary.find((m) => m.labelKey === "temperature");

    assert.ok(temperature);
    assert.equal(temperature.value, "30.4");
    assert.equal(temperature.provenance.origin, "external");
  });
});

/**
 * The view model bakes station names, the gateway capability note and the
 * whole reference panel as plain strings, so it has to be built in the
 * reader's language rather than translated afterwards. Building it
 * language-blind is what left "Trạm 1 - Gần sông" sitting on the English
 * observatory while every surrounding label was English.
 */
describe("view model is built in the requested language", () => {
  it("renders station names in the dictionary it was given", async () => {
    const viModel = await getObservatoryViewModel("real", vi);
    const enModel = await getObservatoryViewModel("real", en);

    const viNames = viModel.stations.map((s) => s.name);
    const enNames = enModel.stations.map((s) => s.name);

    assert.ok(viNames.some((n) => n.includes("Trạm")), `expected Vietnamese names, got ${viNames.join(", ")}`);
    assert.ok(enNames.every((n) => !n.includes("Trạm")), `English model still carries Vietnamese: ${enNames.join(", ")}`);
    assert.ok(enNames.some((n) => n.includes("Station")), `expected English names, got ${enNames.join(", ")}`);
  });

  it("localises the reference panel, which is prose rather than a label", async () => {
    const enModel = await getObservatoryViewModel("real", en);
    for (const item of enModel.reference) {
      assert.ok(
        !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/.test(item.title),
        `reference title left untranslated: ${item.title}`,
      );
    }
  });

  it("localises the gateway capability note", async () => {
    const enModel = await getObservatoryViewModel("real", en);
    const gateway = enModel.stations.find((s) => s.kind === "gateway");
    assert.ok(gateway?.capabilityNote, "gateway should explain what it cannot measure");
    assert.ok(
      !gateway.capabilityNote.includes("Gateway gom"),
      `capability note left untranslated: ${gateway.capabilityNote}`,
    );
  });
});

/**
 * The metric canvas — one cell per measurement.
 *
 * These pin the properties that make it one instrument rather than several
 * panels: nothing is lost in the flattening, external cells never acquire a
 * station, and cell size is derived from information density rather than
 * decoration (an empty metric must never be given headline space).
 */
describe("canvas metrics", () => {
  it("loses no measurement in the flattening — as a tile or as a companion", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "x");

    // Two regional readings become companions of a station tile rather than
    // tiles of their own, so the tile count is lower than the metric count —
    // but nothing may disappear.
    const rendered = new Set<ObservatoryMetricLike>();
    for (const cell of cells) {
      rendered.add(cell.metric);
      if (cell.companion) rendered.add(cell.companion.metric);
    }

    const fromGroups = groups.flatMap((g) => (g.primary ? [g.primary, ...g.secondary] : g.secondary));
    assert.equal(rendered.size, fromGroups.length, "flattening dropped or duplicated a measurement");
    for (const metric of fromGroups) {
      assert.ok(rendered.has(metric), `${metric.label} never reached the canvas`);
    }
  });

  it("gives every cell a unique key", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const ids = buildCanvasMetrics(groups, "x").map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate cell ids: ${ids.join(", ")}`);
  });

  it("keeps hierarchy when the network is silent — width from importance, height from data", async () => {
    // The regression this guards: sizing by availability meant that in real
    // mode, where nothing has reported, every HORIZON cell collapsed to the
    // same width and the Bento became a uniform grid.
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "x");

    const sizes = new Set(cells.map((c) => c.size));
    assert.ok(sizes.size >= 2, `silent network flattened the grid to: ${[...sizes].join(", ")}`);
    assert.ok(cells.some((c) => c.size === "large"), "salinity/water level must stay large when empty");

    // Height, however, must collapse — an empty tile never takes two rows.
    for (const cell of cells) {
      if (cell.metric.value === null) {
        assert.equal(cell.footprint.row, 1, `${cell.id} is empty but holds ${cell.footprint.row} rows`);
      }
    }
  });

  it("keeps infrastructure small even when it has a value", async () => {
    // Link health is operational context, not an environmental quantity.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const infra = buildCanvasMetrics(groups, "x").filter((c) => c.domain === "infrastructure");
    assert.ok(infra.length > 0);
    for (const cell of infra) assert.equal(cell.size, "small", `${cell.id} should stay small`);
  });

  it("marks external tiles as external and gives them no station id", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "Ngoài mạng lưới");
    const external = cells.filter((c) => c.origin === "external");

    // Two of the four regional fields are paired onto station tiles; wind and
    // rainfall have no counterpart and remain standalone.
    assert.equal(external.length, 2, "expected wind and rainfall as standalone regional tiles");
    for (const cell of external) {
      assert.equal(cell.stationId, null, "external data must never carry a station id");
      assert.equal(cell.metric.provenance.origin, "external");
      assert.match(cell.attribution, /Ngoài mạng lưới/);
    }
  });

  it("attributes every HORIZON cell to the station that produced it", async () => {
    // Demo stations use DEMO_* ids and real ones STATION_*; what matters here
    // is that the link back to a station survives the flattening at all.
    for (const mode of ["demo", "real"] as const) {
      const groups = buildSignalGroups(await getObservatoryViewModel(mode, vi), WEATHER);
      for (const cell of buildCanvasMetrics(groups, "x").filter((c) => c.origin === "horizon")) {
        assert.ok(cell.stationId, `${cell.id} lost its station in ${mode} mode`);
        assert.ok(cell.attribution.length > 0, `${cell.id} lost its attribution`);
      }
    }
  });

  it("gives every tile a footprint wide enough to render its label", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    for (const cell of buildCanvasMetrics(groups, "x")) {
      const span = colSpanFor(cell);
      assert.ok(span >= 2 && span <= 6, `${cell.id} has an unusable span of ${span}`);
      assert.ok(rowSpanFor(cell) >= 1 && rowSpanFor(cell) <= 2, `${cell.id} has a bad row span`);
    }
  });

  it("produces a genuinely mixed mosaic, not a uniform grid", async () => {
    // "Bento" is only meaningful if the footprints actually differ. Demo mode
    // has every metric populated, so this is the best case — if it is uniform
    // here it is uniform everywhere.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "x");

    const widths = new Set(cells.map((c) => colSpanFor(c)));
    assert.ok(widths.size >= 3, `expected at least three widths, saw: ${[...widths].join(", ")}`);
    assert.ok(cells.some((c) => rowSpanFor(c) === 2), "no tall tile — the mosaic has no vertical variation");
    assert.ok(cells.some((c) => colSpanFor(c) >= 5), "no anchor tile to hold the composition");
  });
});

describe("canvas cell labels are unambiguous when they stand alone", () => {
  it("never renders two different measurements under the same label and station", async () => {
    // Regression guard for the flattening: soil temperature and air
    // temperature come from the SAME physical station, so a contextual
    // "Nhiệt độ" on both made them indistinguishable once the domain
    // heading above them was removed.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "Ngoài mạng lưới");

    // Mirrors cellLabel() in observatory-canvas.tsx.
    const label = (c: (typeof cells)[number]) => {
      const k = c.metric.labelKey;
      if (!k) return c.metric.label;
      if (c.domain === "soil" && k === "temperature") return vi.chart.metrics.soilTemp;
      if (c.domain === "soil" && k === "moisture") return vi.chart.metrics.soilMoisture;
      if (c.domain === "soil" && k === "ec") return vi.chart.metrics.soilEc;
      if (c.domain === "air" && k === "temperature") return vi.chart.metrics.airTemp;
      if (c.domain === "air" && k === "humidity") return vi.chart.metrics.airHumidity;
      return vi.metricLabels[k];
    };

    const seen = new Map<string, string>();
    for (const cell of cells) {
      const key = `${label(cell)} @ ${cell.attribution}`;
      const existing = seen.get(key);
      assert.equal(
        existing,
        undefined,
        `"${key}" is used by both ${existing} and ${cell.id} — a reader cannot tell them apart`,
      );
      seen.set(key, cell.id);
    }
  });
});

/**
 * Pairing the station's own air readings with the regional ones.
 *
 * They measure the same quantity — one at Trạm 2, one across the province —
 * so two separate tiles asked the reader to reconcile them. One tile with the
 * measured value large and the regional value secondary states the
 * relationship directly. The provenance marker still keeps them apart.
 */
describe("measured + regional pairing", () => {
  it("attaches regional temperature and humidity to the station tile", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "Ngoài mạng lưới");

    const air = cells.filter((c) => c.domain === "air");
    const paired = air.filter((c) => c.companion);
    assert.equal(paired.length, 2, "expected air temperature and humidity to carry companions");

    for (const cell of paired) {
      assert.equal(cell.origin, "horizon", "the primary value must be the station's own");
      assert.equal(cell.companion!.metric.provenance.origin, "external");
      assert.match(cell.companion!.attribution, /Ngoài mạng lưới/);
    }
  });

  it("does not also render those regional readings as tiles of their own", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "x");

    const standaloneExternal = cells.filter((c) => c.origin === "external").map((c) => c.metric.labelKey);
    assert.ok(!standaloneExternal.includes("temperature"), "regional temperature is duplicated");
    assert.ok(!standaloneExternal.includes("humidity"), "regional humidity is duplicated");
    // Wind and rainfall have no station counterpart, so they stay standalone.
    assert.deepEqual(standaloneExternal.sort(), ["precipitation", "wind"]);
  });

  it("keeps every regional reading reachable — paired or standalone", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const cells = buildCanvasMetrics(groups, "x");

    const shown = new Set<string>();
    for (const cell of cells) {
      if (cell.origin === "external") shown.add(cell.metric.labelKey!);
      if (cell.companion) shown.add(cell.companion.metric.labelKey!);
    }
    assert.deepEqual([...shown].sort(), ["humidity", "precipitation", "temperature", "wind"]);
  });
});

/**
 * Two real, screenshot-confirmed layout defects, fixed here and pinned so
 * they cannot silently return.
 */
describe("mosaic layout regressions", () => {
  it("gives a companion tile two rows, so its regional line is never clipped", async () => {
    // Bug: footprint was decided before the companion existed, so air
    // temperature/humidity — both row:1 in the base table — kept one row
    // even after gaining a second line of text, and the card's fixed-height
    // track clipped it. Confirmed in a real screenshot before this fix.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const paired = buildCanvasMetrics(groups, "x").filter((c) => c.companion && c.metric.value !== null);
    assert.ok(paired.length > 0, "expected at least one populated paired tile in demo mode");
    for (const cell of paired) {
      assert.equal(cell.footprint.row, 2, `${cell.id} has a companion but only ${cell.footprint.row} row`);
    }
  });

  it("never strands a standalone external tile at a narrow width", async () => {
    // Bug: wind/rain kept a fixed col-3. In real mode they land last with
    // nothing left to pack beside them, so a narrow tile left ~9 empty
    // columns next to it — visible in the owner's real-mode screenshot.
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER);
    const standalone = buildCanvasMetrics(groups, "x").filter(
      (c) => c.origin === "external" && !c.companion,
    );
    assert.ok(standalone.length > 0, "expected standalone external tiles in real mode");
    for (const cell of standalone) {
      // With exactly two standalone fields (wind + rain), each should claim
      // half the row rather than a cramped third.
      assert.ok(colSpanFor(cell) >= 6, `${cell.id} is only ${colSpanFor(cell)} columns wide`);
    }
    const totalWidth = standalone.reduce((sum, c) => sum + colSpanFor(c), 0);
    assert.equal(totalWidth, 12, `standalone external tiles should exactly fill a row, summed to ${totalWidth}`);
  });
});

describe("companion-pair row fill", () => {
  it("sizes the paired air readings to fill their row, not just 8 of 12 columns", async () => {
    // Bug: air temperature and humidity kept FOOTPRINT.temperature/.humidity's
    // ordinary width (4 each) even once paired with a regional companion, so
    // the two of them together only claimed 8 columns — a visible quarter of
    // the row left as bare background. Confirmed in a real screenshot.
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER);
    const paired = buildCanvasMetrics(groups, "x").filter((c) => c.companion);
    assert.equal(paired.length, 2, "expected air temperature and humidity as a pair");
    const total = paired.reduce((sum, c) => sum + colSpanFor(c), 0);
    assert.equal(total, 12, `paired tiles should exactly fill a row, summed to ${total}`);
  });

  it("gives wind and rainfall two rows so they read as tiles, not thin strips", async () => {
    const groups = buildSignalGroups(await getObservatoryViewModel("real", vi), WEATHER);
    const standalone = buildCanvasMetrics(groups, "x").filter((c) => c.origin === "external" && !c.companion);
    assert.ok(standalone.length > 0);
    for (const cell of standalone) {
      assert.equal(rowSpanFor(cell), 2, `${cell.id} should span two rows`);
    }
  });
});

describe("hero tier visual differentiation", () => {
  it("marks exactly the Tier A metrics (salinity, water level, moisture) as hero-sized", async () => {
    // The "card wall" fix: hero tiles render without a bordered card (see
    // observatory-canvas.tsx's isHero branch), which depends entirely on
    // cell.size === "large" staying scoped to Tier A. If IMPORTANCE ever
    // drifts, a context or operational metric would silently lose its box.
    const groups = buildSignalGroups(await getObservatoryViewModel("demo", vi), WEATHER);
    const heroKeys = buildCanvasMetrics(groups, "x")
      .filter((c) => c.size === "large")
      .map((c) => c.metric.labelKey)
      .sort();
    assert.deepEqual(heroKeys, ["moisture", "salinity", "waterLevel"]);
  });
});

describe("weather history chart series", () => {
  it("maps 24h Open-Meteo history into chart metrics", () => {
    const series = weatherHistoryToObservationSeries({
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      area: "Cồn Hô",
      points: [
        {
          time: "2026-09-03T01:00",
          temperatureC: 26.4,
          humidityPct: 83,
          windKph: 10.5,
          precipitationMm: 0,
        },
      ],
    });

    assert.ok(series);
    assert.deepEqual(series.availableMetrics, [
      "weatherTemp",
      "weatherHumidity",
      "weatherWind",
      "weatherPrecipitation",
    ]);
    assert.equal(series.points[0].weatherTemp, 26.4);
    assert.equal(series.points[0].weatherHumidity, 83);
    assert.equal(series.points[0].weatherWind, 10.5);
    assert.equal(series.points[0].weatherPrecipitation, 0);
    assert.equal(series.provenance.origin, "external");
  });

  it("replaces an existing weather history when the client refreshes", async () => {
    const model = await getObservatoryViewModel("real", vi);
    const first = weatherHistoryToObservationSeries({
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      area: "Cồn Hô",
      points: [
        {
          time: "2026-09-03T00:00",
          temperatureC: 26.6,
          humidityPct: 81,
          windKph: 11,
          precipitationMm: 0,
        },
      ],
    });
    const refreshed = weatherHistoryToObservationSeries({
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      area: "Cồn Hô",
      points: [
        {
          time: "2026-09-03T01:00",
          temperatureC: 26.4,
          humidityPct: 83,
          windKph: 10.5,
          precipitationMm: 0,
        },
      ],
    });

    const once = mergeWeather24hSeries(model.series["24h"], first);
    const twice = mergeWeather24hSeries(once, refreshed);

    assert.equal(twice.points.filter((point) => point.weatherTemp !== null).length, 1);
    assert.equal(twice.points.find((point) => point.weatherTemp !== null)?.weatherTemp, 26.4);
  });
});
