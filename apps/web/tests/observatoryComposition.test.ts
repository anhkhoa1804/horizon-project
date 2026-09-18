import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards the Monitoring Bento's explicit 6×4 grid.
 *
 * This is the third composition this canvas has had: a computed per-metric
 * footprint algorithm, then four hand-authored surfaces (primary /
 * environmental / context / infrastructure), now an explicit 6-column ×
 * 3-row grid with eight boxes placed by exact cell coordinates rather than
 * grouped by domain. Each rewrite happened because the previous one still
 * read as "many cards" or drifted from the owner's actual intent — so the
 * regression this file exists to catch is any of the earlier approaches
 * quietly coming back, plus the one property that is easy to get wrong by
 * hand and hard to notice in a diff: the eight boxes must tile all 18 cells
 * exactly once, with no gap and no overlap.
 *
 * No React-rendering harness exists in this repo (every other test here is
 * a pure-function `node:test`), so — matching singleBackground.test.ts —
 * these are source-level checks: cheap, dependency-free, reading the
 * component's own class strings rather than rendering it.
 */

const SRC = path.join(process.cwd(), "components", "monitoring", "observatory-canvas.tsx");
const source = () => fs.readFileSync(SRC, "utf8");

type Placement = { colStart: number; colEnd: number; rowStart: number; rowEnd: number };

/**
 * Every `col-start-A col-end-B row-start-C row-end-D` placement for ONE
 * breakpoint, in source order.
 *
 * `prefix` is "" for the base (<md) arrangement, "md:" or "lg:" for the
 * others. The base pattern is guarded by a lookbehind so it cannot match the
 * `md:`/`lg:` variants of the same class.
 */
function extractPlacements(src: string, prefix: "" | "md:" | "lg:"): Placement[] {
  const p = prefix.replace(":", "\\:");
  const guard = prefix === "" ? "(?<![\\w:-])" : "";
  const re = new RegExp(
    `${guard}${p}col-start-(\\d+) ${p}col-end-(\\d+) ${p}row-start-(\\d+) ${p}row-end-(\\d+)`,
    "g",
  );
  const placements: Placement[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    placements.push({ colStart: Number(m[1]), colEnd: Number(m[2]), rowStart: Number(m[3]), rowEnd: Number(m[4]) });
  }
  return placements;
}

/**
 * Asserts that eight boxes cover a `cols × rows` grid exactly once each.
 *
 * This is the single property that is easy to break by hand and nearly
 * impossible to see in a diff: one wrong row-end and either two boxes stack
 * on the same cell or a hole opens in the canvas.
 */
function assertTiling(placements: Placement[], cols: number, rows: number, label: string) {
  assert.equal(placements.length, 10, `${label}: expected exactly ten explicitly-placed boxes`);

  const covered = new Map<string, number>();
  for (const { colStart, colEnd, rowStart, rowEnd } of placements) {
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) {
        const key = `${row},${col}`;
        covered.set(key, (covered.get(key) ?? 0) + 1);
      }
    }
  }

  const expected = cols * rows;
  assert.equal(covered.size, expected, `${label}: expected all ${expected} cells covered, got ${covered.size}`);
  for (const [cell, count] of covered) {
    assert.equal(count, 1, `${label}: cell ${cell} is covered by ${count} boxes — placements overlap`);
  }
}

describe("observatory Bento grid", () => {
  it("places ten grouped boxes by explicit coordinates, not a computed algorithm", () => {
    const src = source();
    assert.match(src, /function ObservatoryBento/, "the grid composition component is gone");
    assert.match(src, /lg:grid-cols-6/, "the 6-column track is missing");
    assert.match(src, /lg:grid-rows-4/, "the 4-row track is missing");
    assert.match(src, /lg:aspect-\[3\/2\]/, "the container must be 3:2 so every desktop base cell is square");

    // The two arrangements BELOW lg are part of the same system, not a
    // fallback: the container has to declare a track count and a matching
    // aspect ratio at each, or the base cell stops being square and the
    // regions stop being whole multiples of it.
    assert.match(src, /grid-cols-4/, "the 4-column track for <lg is missing");
    assert.match(src, /repeat\(21,minmax\(0,1fr\)\)/, "the 21-row track for <md is missing");
    assert.match(src, /repeat\(10,minmax\(0,1fr\)\)/, "the 10-row track for md is missing");
    assert.match(src, /aspect-\[4\/21\]/, "the <md container must be 4:21 to keep the base cell square");
    assert.match(src, /md:aspect-\[2\/5\]/, "the md container must be 2:5 to keep the base cell square");

    // Neither earlier approach may quietly return.
    assert.ok(!/buildCanvasMetrics/.test(src), "the computed per-metric footprint system is back");
    assert.ok(!/function MetricCanvasCell/.test(src), "the old one-card-per-metric renderer is back");
    assert.ok(!/function StatRow/.test(src), "the four-surface StatRow component is back");
    assert.ok(!/function SurfaceHeader/.test(src), "the four-surface SurfaceHeader component is back");
  });

  it("tints whole regions, never individual values inside them", () => {
    // The failure this catches, reported against a screenshot: each value
    // carried its own STATUS_SURFACE inside a neutral parent, so a box read
    // as small coloured cards nested in a white one — and a region could
    // show green and amber at once, giving two answers to "is this fine?".
    const src = source();
    assert.match(src, /function regionSurface/, "the region-level surface helper is gone");
    assert.match(src, /worstStatus\(\[/, "a multi-value region must resolve ONE status via worstStatus()");

    // The per-value component must stay surface-free.
    const start = src.indexOf("function Value(");
    const end = src.indexOf("function ContextValue(");
    assert.ok(start >= 0 && end > start, "the Value component is gone or moved after ContextValue");
    const valueComponent = src.slice(start, end);
    assert.ok(
      !/STATUS_SURFACE/.test(valueComponent),
      "a single value is tinting its own surface again — status belongs to the region",
    );
  });

  it("states network state once — in the box that already answers the question", () => {
    // "MẠNG LƯỚI · 2/3 ĐANG GỬI DỮ LIỆU" used to be its own band above the
    // Bento. It now titles the infrastructure box, which already holds the
    // network's signal and battery, so the fact sits where a reader goes
    // looking for it instead of in a strip they scroll past.
    const src = source();
    assert.ok(!/function SystemSummary/.test(src), "the standalone network line is back above the Bento");
    assert.match(
      src,
      /network\.live > 0\s*\?\s*`\$\{network\.live\}\/\$\{network\.total\}/,
      "the infrastructure box must be titled by the reporting fraction",
    );
    assert.ok(
      !/title=\{dict\.monitoring\.groupInfrastructure\}/.test(src),
      'the infrastructure box reverted to the static "Hạ tầng" label',
    );

    // The three heavier things this lineage replaced must all stay gone.
    assert.ok(!/function NetworkHeader/.test(src), "the full-width network header is back");
    assert.ok(!/function AlertsPanel/.test(src), "the full-width alert card is back");
    assert.ok(!/status-rail/.test(src), "the continuously-moving status marquee is back");
  });

  it("states each region's status on its own header line, not as a floating caption", () => {
    // Operational text belongs to the tile that shows the reading behind it,
    // not to a strip above the whole page — and it belongs ON the region's
    // title row, not on a third band under the numbers, which is what gave
    // every status box an extra horizontal stripe.
    const src = source();
    assert.match(src, /function RegionHeader/, "the region header is gone");
    const renders = (src.match(/<RegionHeader\b/g) || []).length;
    assert.equal(renders, 4, "expected primary, infrastructure, water and soil region headers");
    assert.ok(!/<RegionStatus\b/.test(src), "the separate status line is back below the values");
  });

  it("titles the primary region as the observatory, not as one domain", () => {
    // "NƯỚC" framed Box 0 as the water card among several. It is the
    // observatory's primary observation surface.
    const src = source();
    assert.match(src, /title=\{dict\.nav\.monitoring\}/, "Box 0 must be titled QUAN TRẮC");
    assert.ok(!/dict\.monitoring\.groupWater/.test(src), "Box 0 reverted to the domain title");
  });

  it("lets the map fill its region — no header strip above it", () => {
    const src = source();
    assert.ok(
      !/dict\.monitoring\.spaceTitle/.test(src),
      "the map's title bar is back; the map should be the region, not a card inside one",
    );
  });

  it("keeps the oversized PWA install panel off Monitoring", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
    assert.ok(!/<InstallPrompt/.test(page), "the install prompt is back at the top of Monitoring");
  });

  it("prints no provenance marker or legend on the canvas", () => {
    // The owner removed both: the `*` / `~` superscripts on every value, and
    // the demo notice above the Bento that existed to explain them. Demo mode
    // is still declared by the badge beside the page title (asserted in the
    // dashboard page test below); which cell is regional is documentation.
    const src = source();
    assert.ok(!/function ProvenanceMarker/.test(src), "the * / ~ markers are back on the values");
    assert.ok(!/<ProvenanceMarker/.test(src), "a value is rendering a provenance marker again");
    assert.ok(!/markerExternalLegend|markerDemoLegend/.test(src), "the marker legend is back");
    assert.ok(!/demoBannerBody/.test(src), "the demo explanation band is back above the Bento");
  });

  it("still declares demo mode once, beside the page title", () => {
    // Removing the notice must not remove the fact. This is the only thing
    // left on the page saying the station figures are synthetic.
    const page = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
    assert.match(page, /dict\.monitoring\.demoBannerTitle/, "demo mode is no longer declared anywhere");
    assert.match(page, /mode === "demo"/, "the demo badge must be conditional on demo mode");
  });

  it("shows real geography in demo mode without ever drawing a demo marker", () => {
    // The distinction the honesty rules protect is measured vs unmeasured.
    // A basemap measures nothing: Cồn Hô is in the same place whether the
    // figures on the page are real or illustrative. So demo gets the island
    // (`basemapOnly`) and never gets a pin — `mapStations` stays empty in
    // demo, which is what makes "no fake markers" structural rather than a
    // convention someone has to remember.
    const src = source();
    assert.match(src, /basemapOnly=\{isDemo\}/, "demo mode must render the basemap");
    assert.match(
      src,
      /model\.mode === "real"[\s\S]{0,400}?:\s*\[\]/,
      "demo mode must still resolve to zero map stations",
    );

    const map = fs.readFileSync(
      path.join(process.cwd(), "components", "dashboard", "station-network-map.tsx"),
      "utf8",
    );
    // The marker loop is driven by `stations`, which is empty here — but the
    // view has to come from somewhere, and that somewhere must be the shared
    // reference point rather than a literal typed into the map.
    assert.match(map, /CON_HO\.lat, CON_HO\.lng\], CON_HO_ZOOM/, "the basemap view must use the shared point");
    assert.ok(
      !/10\.24\d*|105\.82\d*/.test(map),
      "a coordinate literal is back in the map — it belongs in lib/geo.ts",
    );
  });

  it("plots the surveyed coordinates, not editable database rows", () => {
    // The map used to read lat/lng off the station row and then filter out
    // 0,0, because buildObservatory falls back to zero when a station has no
    // snapshot — and 0,0 is a real place in the Gulf of Guinea. The effect on
    // a database whose rows carry no coordinates was that the map correctly
    // refused to invent geography and therefore drew NOTHING: three nodes,
    // no markers.
    //
    // Positions now come from lib/geo.ts, which is documented as the
    // authority precisely because a row can be edited, seeded or left at a
    // default. That is a stronger guarantee than the old filter: 0,0 is not
    // rejected after the fact, it is unreachable.
    const src = source();
    assert.match(src, /STATION_COORDS\[/, "the map no longer reads the surveyed coordinates");
    assert.ok(
      !/lat: s\.lat|lng: s\.lng/.test(src),
      "the map is reading coordinates off the station row again",
    );
  });

  it("tiles all three arrangements exactly once per cell, with no gap and no overlap", () => {
    const src = source();
    assertTiling(extractPlacements(src, ""), 4, 21, "<md (4×21)");
    assertTiling(extractPlacements(src, "md:"), 4, 10, "md (4×10)");
    assertTiling(extractPlacements(src, "lg:"), 6, 4, "lg (6×4)");
  });

  it("keeps every region a whole multiple of the base cell at every breakpoint", () => {
    // The failure this catches was measured, not guessed: before the <md and
    // md arrangements existed, the four context cells reflowed to 344×344 at
    // 768 — larger than ANY cell in the desktop composition — while Box 0
    // became a 697×128 strip. Boxes sized by their own content instead of by
    // the unit is exactly what stops a Bento reading as one grid.
    const src = source();
    for (const [label, prefix, cols, rows] of [
      ["<md", "", 4, 21],
      ["md", "md:", 4, 10],
      ["lg", "lg:", 6, 4],
    ] as const) {
      for (const p of extractPlacements(src, prefix)) {
        const w = p.colEnd - p.colStart;
        const h = p.rowEnd - p.rowStart;
        assert.ok(w >= 1 && Number.isInteger(w), `${label}: a box spans ${w} columns`);
        assert.ok(h >= 1 && Number.isInteger(h), `${label}: a box spans ${h} rows`);
        assert.ok(p.colEnd <= cols + 1, `${label}: a box ends past column ${cols}`);
        assert.ok(p.rowEnd <= rows + 1, `${label}: a box ends past row ${rows}`);
      }
    }
  });

  it("keeps the four regional readings equal to each other at every width", () => {
    // The invariant is EQUALITY and whole-unit sizing, not a fixed
    // arrangement. 1×4 from md up (one unit each, 148–193px); 2×2 below it
    // (two units square, 171px at 390) because a 1×4 row at 390 gives each
    // cell ~81px, which forced 9px labels that wrapped mid-word and left no
    // room for the interpretation line. Readability wins over arrangement
    // purity — what must never happen is cells sized by their text rather
    // than by the unit, which is what the old content-driven reflow did.
    const src = source();
    const weatherBoxes = (src.match(/\{ icon: \w+, label: dict\.metricLabels\.\w+, key: "\w+", cell:/g) || []).length;
    assert.equal(weatherBoxes, 4, "expected four regional readings (temperature, humidity, wind, precipitation)");

    for (const [label, prefix, unitSpan] of [
      ["<md", "", 2],
      ["md", "md:", 1],
      ["lg", "lg:", 1],
    ] as const) {
      const context = extractPlacements(src, prefix).slice(-6, -2);
      assert.equal(context.length, 4, `${label}: expected four context placements`);
      for (const p of context) {
        assert.equal(p.colEnd - p.colStart, unitSpan, `${label}: a context cell is not ${unitSpan} unit(s) wide`);
        assert.equal(p.rowEnd - p.rowStart, unitSpan, `${label}: a context cell is not ${unitSpan} unit(s) tall`);
      }
      const shapes = new Set(context.map((p) => `${p.colEnd - p.colStart}x${p.rowEnd - p.rowStart}`));
      assert.equal(shapes.size, 1, `${label}: the four context cells are not all the same size`);
      const origins = new Set(context.map((p) => `${p.rowStart},${p.colStart}`));
      assert.equal(origins.size, 4, `${label}: two context cells share an origin`);
    }

    // At md and above they must still be ONE row of four columns.
    for (const [label, prefix] of [["md", "md:"] , ["lg", "lg:"]] as const) {
      const context = extractPlacements(src, prefix).slice(-6, -2);
      if (label === "md") {
        assert.equal(new Set(context.map((p) => p.rowStart)).size, 1, "md: context cells must share one row");
        assert.equal(new Set(context.map((p) => p.colStart)).size, 4, "md: context cells must span four columns");
      }
    }
  });

  it("interprets a regional reading only where a published scale exists", () => {
    // Wind (Beaufort) and rainfall intensity have documented single-variable
    // boundaries. Temperature and humidity do NOT — every official index that
    // would judge them (heat index, humidex, WBGT) is a function of both
    // together, so labelling either alone would be inventing a rule.
    const ctx = fs.readFileSync(
      path.join(process.cwd(), "lib", "monitoring", "context.ts"),
      "utf8",
    );
    assert.match(ctx, /function windBand/, "the Beaufort mapping is gone");
    assert.match(ctx, /function rainBand/, "the rainfall-intensity mapping is gone");
    assert.match(
      ctx,
      /temperature \/ humidity — no single-variable published classification/,
      "the reason temperature and humidity get no context line must stay documented",
    );
    // The guard that matters: no band function for either.
    assert.ok(!/function (temperatureBand|humidityBand)/.test(ctx), "an unsourced weather band is back");
  });

  it("never gives regional weather a station id — it reads through contextMetric() only", () => {
    const src = source();
    assert.match(src, /contextMetric\(key\)/, "regional values must be read through contextMetric()");
    assert.ok(!/context\??\.station/.test(src), "regional weather must never be attributed to a HORIZON station");
  });

  it("only colours a reading through the shared, threshold-checked status helper", () => {
    // No inline "if value > X return red" — colour must keep flowing through
    // statusFor(), which is the one place that refuses to invent a threshold.
    const src = source();
    assert.match(src, /statusFor\(/, "status colour must be resolved through statusFor()");
    assert.match(src, /STATUS_SURFACE\[/, "status must tint the region's surface");
  });

  it("carries status in the surface, not in the type on top of it", () => {
    // The surfaces are now strongly tinted, which makes same-hue text the one
    // combination that degrades as the status colour improves: amber numerals
    // on an amber region. Values and the status word are plain foreground so
    // contrast belongs to the text and colour belongs to the surface.
    const src = source();
    assert.ok(
      !/STATUS_TEXT/.test(src),
      "status-hued text is back on a status-tinted surface — contrast will suffer",
    );
  });
});

/**
 * The basemap provider.
 *
 * CARTO's free tile endpoint began requiring an account, and it fails
 * silently: `200 OK`, a valid `image/png`, every tile marked loaded — but
 * the image is a placeholder reading "API KEY REQUIRED". Status-code checks
 * and console output both said the map was healthy while it rendered a
 * watermark. These pin the key-free provider that replaced it.
 */
describe("map tile provider", () => {
  const MAP = path.join(process.cwd(), "components", "dashboard", "station-network-map.tsx");
  const map = () => fs.readFileSync(MAP, "utf8");

  it("uses a provider that needs no API key", () => {
    // Scoped to the TILE_URL values, not the whole file: the comment above
    // them names the old endpoint on purpose, so the next person knows why
    // it left.
    // [\s\S] rather than the `s` flag: tsconfig.testcheck targets a version
    // that predates dotAll.
    const block = map().match(/const TILE_URL[\s\S]+?\n};/);
    assert.ok(block, "TILE_URL is gone");
    const urls = block[0];
    assert.ok(!/cartocdn\.com/.test(urls), "the keyed CARTO endpoint is back — it serves an API-KEY-REQUIRED tile");
    assert.match(urls, /server\.arcgisonline\.com/, "expected the key-free Esri Canvas basemap");
    // A key smuggled into the URL would defeat the point.
    assert.ok(!/[?&](api_?key|access_?token|key)=/i.test(urls), "a tile URL is carrying an API key");
  });

  it("keeps a light and a dark basemap, and credits the provider", () => {
    const src = map();
    assert.match(src, /World_Light_Gray_Base/, "the light-theme basemap is missing");
    assert.match(src, /World_Dark_Gray_Base/, "the dark-theme basemap is missing");
    assert.match(src, /attribution: TILE_ATTRIBUTION/, "the tile layer must carry attribution");
    assert.match(src, /esri\.com/i, "Esri attribution is required by their terms");
  });
});

/**
 * The observation log's controls.
 *
 * Three shapes have failed here, each visibly rather than functionally: a
 * wrapping row of metric pills (two rows of buttons above a shorter plot), a
 * horizontally-scrolling rail of the same pills (one row, but still eight
 * labels competing with the data), and before both, a live scrollbar drawn
 * across the middle of the box. The current shape is two compact selects on
 * one row — the platform's own control, which cannot wrap, cannot scroll,
 * and does not grow with the metric count.
 */
describe("observation log controls", () => {
  const LOG = path.join(process.cwd(), "components", "monitoring", "observation-log.tsx");
  const log = () => fs.readFileSync(LOG, "utf8");

  it("exposes metric and range as two compact controls, not a row of every option", () => {
    // Measured at 1024 when every metric was a visible pill: the controls
    // took 106px against the plot's ~100px — the chart spent more of itself
    // on its own buttons than on data.
    const src = log();
    assert.match(src, /function ControlSelect/, "the compact control is gone");
    assert.equal((src.match(/<ControlSelect\b/g) || []).length, 2, "expected exactly two controls");
    assert.match(src, /<select\b/, "the control must be a native select, not a hand-built menu");

    // No rail, in either of its two historical forms.
    assert.ok(!/overflow-x-auto/.test(src), "a horizontally-scrolling control rail is back");

    // The two controls must stay together as a pair. The header ROW may wrap
    // at mobile (label above, controls below) rather than shrinking the
    // selects until their own labels truncate — what is forbidden is the two
    // controls separating from each other.
    const groupStart = src.indexOf('<div className="flex shrink-0 items-center gap-1.5">');
    assert.ok(groupStart >= 0, "the two controls are no longer a single shrink-0 group");
    const between = src.slice(groupStart, src.indexOf("{hasData ?"));
    assert.equal(
      (between.match(/<ControlSelect\b/g) || []).length,
      2,
      "the two controls are not in the same group — they can separate",
    );
  });

  it("labels both controls for assistive tech", () => {
    // A bare <select> announces only its current value, which for the range
    // control is "24 giờ" with no indication of what it changes.
    const src = log();
    assert.match(src, /ariaLabel=\{dict\.chart\.metricControl\}/, "the metric control has no label");
    assert.match(src, /ariaLabel=\{dict\.chart\.rangeControl\}/, "the range control has no label");
    assert.match(src, /aria-label=\{ariaLabel\}/, "the label never reaches the select element");
  });

  it("keeps the plot free of restated metadata", () => {
    // The axis draws the scale; a prose line repeating it, a source sentence
    // and an observation count were metadata about the chart rather than about
    // the measurement, and together cost the plot three rows of height.
    const src = log();
    assert.ok(!/chart\.axisShows/.test(src), "the 'Trục hiển thị …' line is back");
    assert.ok(!/chart\.observations/.test(src), "the observation count is back in the plot area");
    assert.ok(!/<SourceNote/.test(src), "the verbose source note is back in the plot area");
    assert.ok(!/chart\.eyebrow/.test(src), "the long 'Nhật ký quan trắc' eyebrow is back above the title");
    assert.ok(!/dict\.chart\.title/.test(src), "the generic second heading is back");
  });

  it("opens with the same header grammar as every other box in the Bento", () => {
    // Icon, then a short uppercase label. The chart used to be the one region
    // that opened with a sentence-case title instead, which is most of why it
    // read as a different kind of component inside the same grid.
    //
    // The label's type is compared against the canvas's own RegionHeader
    // rather than pinned to a literal, so restyling the box headers can never
    // leave the chart behind as the one that did not follow.
    const src = log();
    assert.match(src, /dict\.chart\.boxLabel/, "the chart's box header label is gone");

    const headerStyle = (text: string) => {
      const m = text.match(/className="truncate (text-\[\d+px\] font-semibold uppercase tracking-\[[\d.]+em\])"/);
      return m?.[1] ?? null;
    };
    const chart = headerStyle(src);
    const canvas = headerStyle(source());
    assert.ok(chart, "the chart header label is not using the shared header type");
    assert.ok(canvas, "RegionHeader's label is not using the shared header type");
    assert.equal(chart, canvas, "the chart's header type has drifted from the other boxes'");
  });

  it("puts the label and BOTH controls on one header row, with no title line", () => {
    // Three shapes have been tried here. A title line above the controls
    // printed "Độ mặn · 24 giờ" while the two selects immediately beneath
    // already read "Độ mặn" and "24 giờ" — the box spent a third of its
    // height restating its own controls. The controls are the title.
    const src = log();
    assert.ok(
      !/\{dict\.chart\.metrics\[shown\]\} · \{dict\.chart\[rangeDictKey\]\}/.test(src),
      "the title line duplicating both controls is back",
    );
    assert.ok(!/rangeDictKey/.test(src), "dead rangeDictKey left behind");

    // ONE header row holding the label and both controls: the label and both
    // selects must all appear before the plot, inside the same flex row.
    const rowStart = src.indexOf('<div className="flex flex-wrap items-center justify-between');
    assert.ok(rowStart >= 0, "the shared header row is gone");
    const header = src.slice(rowStart, src.indexOf("{hasData ?"));
    assert.match(header, /dict\.chart\.boxLabel/, "the box label is not on the shared header row");
    assert.equal(
      (header.match(/<ControlSelect\b/g) || []).length,
      2,
      "both controls must sit on the same header row as the label",
    );
  });

  it("insets the plot so its axis labels do not sit on the box edge", () => {
    // The first and last x labels used to land on the plot's rounded corners
    // and the extreme y labels against the axis line.
    const src = log();
    assert.match(src, /padding=\{\{ left: \d+, right: \d+ \}\}/, "the x axis has no end padding");
    assert.match(src, /tickMargin=\{\d+\}/, "the axis ticks sit flush against the plot");
    assert.match(src, /margin=\{\{ top: \d+, right: \d+/, "the plot has no top/right inset");
  });
});
