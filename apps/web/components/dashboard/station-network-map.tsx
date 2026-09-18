"use client";

import "leaflet/dist/leaflet.css";
import { MapPinOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import type { FreshnessState } from "@/components/ui/status-indicator";
import { CON_HO, CON_HO_ZOOM } from "@/lib/geo";
import { resolveTheme, THEME_CHANGE_EVENT, type ResolvedTheme } from "@/lib/theme";
import { OBSERVATORY_HREF } from "@/lib/publicStations";
import { cn } from "@/lib/utils";

export interface MapStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  freshness: FreshnessState;
}

/**
 * Mirrors globals.css's --h-safe/--h-warning/--h-neutral (and brand-blue for
 * the selection ring) in both themes. Leaflet markers are drawn as SVG with
 * inline style attributes it sets itself, not classed elements — they cannot
 * inherit a CSS custom property the way a styled <div> does, so the two
 * values are restated here rather than left to drift as flat hex like the
 * pre-rebrand version of this file did (#1c7c42/#a86400/#5e6670 — none of
 * which match any current token in either theme).
 */
const FRESHNESS_COLOR: Record<ResolvedTheme, Record<FreshnessState, string>> = {
  light: {
    live: "#197a3f",
    recent: "#197a3f",
    stale: "#a35f00",
    offline: "#5b6570",
    never_connected: "#5b6570",
    unavailable: "#5b6570",
  },
  dark: {
    live: "#4cb87a",
    recent: "#4cb87a",
    stale: "#d69a44",
    offline: "#808c93",
    never_connected: "#808c93",
    unavailable: "#808c93",
  },
};

const MARKER_STROKE: Record<ResolvedTheme, string> = { light: "#fffdf8", dark: "#1a2320" };
const SELECTION_RING_COLOR: Record<ResolvedTheme, string> = { light: "#0c5f7d", dark: "#4fb0d4" };

/**
 * Esri's Canvas basemaps — near-monochrome, and free of an API key.
 *
 * WHY NOT CARTO. This used to point at `basemaps.cartocdn.com`
 * (light_all / dark_all). CARTO has since put those behind an account, and
 * the failure mode is unusually quiet: the request still returns `200 OK`
 * with a valid `image/png`, and Leaflet marks every tile `leaflet-tile-
 * loaded` — but the PNG it serves is a 5KB placeholder reading "API KEY
 * REQUIRED". Nothing appears in the console, nothing fails in the network
 * panel, and only looking at the rendered map shows the watermark. Checking
 * status codes alone says the map is fine; it is not.
 *
 * Esri's World_Light_Gray_Base / World_Dark_Gray_Base need no key, keep the
 * restrained near-monochrome register this design wants, and — unlike the
 * OSM standard tiles, which their usage policy blocks for this kind of
 * embedding — actually render here. Attribution is required and is set on
 * the layer below.
 *
 * Note the {z}/{y}/{x} order: Esri's REST tile endpoint takes row before
 * column, the reverse of the XYZ convention CARTO used.
 */
const TILE_URL: Record<ResolvedTheme, string> = {
  light:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
};

/** Required by Esri's terms for the Canvas basemaps. */
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Re-resolves on the toggle's custom event and on OS-level changes while still on "system". */
function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setTheme(resolveTheme());

    const onChange = () => setTheme(resolveTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onChange);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    };
  }, []);

  return theme;
}

interface StationNetworkMapProps {
  stations: MapStation[];
  /**
   * `full` (default) is the homepage's interactive map. `preview` is a
   * shorter, locked-view instance for in-page embeds — real data, no
   * pan/zoom/click, so it reads as a preview rather than a second full map
   * instance (REDESIGN_SPECIFICATION.md §13). `observatory` is Monitoring's
   * own taller instance — the map is meant to be a dominant spatial anchor
   * there, not the same size as the homepage's supporting map. `grid` fills
   * whatever height its parent already resolved to instead of imposing its
   * own — for the Monitoring Bento, where the map is one square-ish cell in
   * an explicit grid and the grid's own row tracks (not this component)
   * decide how tall that cell is.
   */
  variant?: "full" | "preview" | "observatory" | "grid";
  /** Optional — when a marker's id matches, it renders with a highlight ring so the map can reflect an instrument-selector's current selection. */
  selectedStationId?: string;
  /**
   * Render the basemap with NO markers when `stations` is empty, instead of
   * the "no coordinates" placeholder.
   *
   * This exists for demo mode. Demo stations deliberately carry no
   * coordinates — plotting them would be inventing geography — but the island
   * itself is not a reading: Cồn Hô is in the same place whether the numbers
   * on the page are real or illustrative. Refusing to draw it left the
   * second-largest region on the canvas holding a placeholder, which said
   * less than the map does and looked like a failure rather than a choice.
   *
   * So: real geography, no fake markers. The distinction the honesty rules
   * actually protect is between measured and unmeasured, and a basemap
   * measures nothing.
   */
  basemapOnly?: boolean;
}

const HEIGHT_CLASS: Record<NonNullable<StationNetworkMapProps["variant"]>, string> = {
  full: "h-[340px]",
  preview: "h-[260px]",
  observatory: "h-[420px] sm:h-[480px] lg:h-[560px]",
  /* The Bento cell decides, at every width. This used to read
     `h-[280px] lg:h-full`, from when the grid only had real row tracks above
     lg and the map had to name its own height on smaller screens. The grid is
     now an aspect-ratio unit system at all three breakpoints, so a fixed
     280px was simply a second, disagreeing opinion about the cell's height —
     it overflowed a 255px cell at 390 and left 63px of dead space in a 343px
     one at 768. */
  grid: "h-full",
};

/**
 * Real geographic map (Leaflet + CartoDB Positron tiles — a restrained,
 * near-monochrome basemap, not the default OSM colorway) driven entirely
 * by real `stations.lat`/`lng`. Never renders a marker for a station this
 * component wasn't given real coordinates for — no placeholder pins, no
 * invented positions. Mounted client-side only; Leaflet touches `window`
 * at load time and has no SSR story.
 */
interface MarkerRecord {
  station: MapStation;
  marker: import("leaflet").CircleMarker;
  pulse: import("leaflet").CircleMarker | null;
}

export function StationNetworkMap({
  stations,
  variant = "full",
  selectedStationId,
  basemapOnly = false,
}: StationNetworkMapProps) {
  const dict = useDict();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const markersRef = useRef<MarkerRecord[]>([]);
  const ringRef = useRef<import("leaflet").CircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const router = useRouter();
  const theme = useResolvedTheme();
  const interactive = variant !== "preview";
  const heightClass = HEIGHT_CLASS[variant];

  // Base map + tile layer + station markers.
  //
  // Deliberately independent of BOTH `selectedStationId` and `theme` — this
  // used to rebuild (tear down and recreate the whole Leaflet instance) on
  // every instrument-selector click and, briefly, on every theme change too.
  // The theme case turned out to be a genuine bug, not just wasted work: a
  // system-dark-preferring OS makes `theme` flip from this hook's "light"
  // default to "dark" in a second render milliseconds after mount (see
  // useResolvedTheme), so the map-building effect would tear down and
  // restart before Leaflet's own teardown had fully released the DOM node —
  // `L.map()` silently failed to initialize a second time (no thrown error
  // reached React, so nothing to see in a Suspense/error boundary; it just
  // never rendered). Building the map exactly once and then *updating* it in
  // place — `setUrl` on the tile layer, `setStyle` on each marker — avoids
  // that whole class of race rather than papering over one instance of it.
  useEffect(() => {
    if (!containerRef.current) return;
    if (stations.length === 0 && !basemapOnly) return;

    let cancelled = false;

    void import("leaflet")
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;

        const map = L.map(containerRef.current, {
          scrollWheelZoom: false,
          // Attribution must stay with the map surface. It is compact Leaflet
          // chrome, but it is visible wherever Esri/OSM tiles are displayed.
          attributionControl: true,
          zoomControl: interactive,
          dragging: interactive,
          doubleClickZoom: interactive,
          touchZoom: interactive,
          boxZoom: interactive,
          keyboard: interactive,
        });
        mapRef.current = map;

        // Theme read once, at build time — the effect below keeps this in
        // sync afterward via setUrl/setStyle, never by rebuilding.
        const initialTheme = resolveTheme();
        const colors = FRESHNESS_COLOR[initialTheme];

        const tileLayer = L.tileLayer(TILE_URL[initialTheme], {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);
        tileLayerRef.current = tileLayer;

        const records: MarkerRecord[] = [];

        for (const station of stations) {
          // Signal pulse — only for stations genuinely live right now, never
          // decorative (REDESIGN_SPECIFICATION.md §24.2/§24.8). A second,
          // non-interactive ring under the real marker; the CSS animation
          // lives in globals.css and already respects prefers-reduced-motion.
          const pulse =
            station.freshness === "live"
              ? L.circleMarker([station.lat, station.lng], {
                  radius: 9,
                  weight: 0,
                  fillColor: colors.live,
                  fillOpacity: 0.5,
                  interactive: false,
                  className: "horizon-marker-pulse",
                }).addTo(map)
              : null;

          const marker = L.circleMarker([station.lat, station.lng], {
            radius: 9,
            weight: 2,
            color: MARKER_STROKE[initialTheme],
            fillColor: colors[station.freshness],
            fillOpacity: 1,
          }).addTo(map);

          // A PERMANENT label, not a hover tooltip.
          //
          // Three identical dots differing only in freshness colour answered
          // "is the network alive?" but not "which of these is the water
          // station?" — and on a touch screen there is no hover to reveal it,
          // so the second question had no answer at all. The role name is the
          // whole point of the map: WATER at the western tip, SOIL and
          // GATEWAY toward the southern bank is a fact about the deployment
          // that a reader should get without interacting.
          //
          // `permanent` with a small offset keeps each label clear of its own
          // marker; the three nodes are ~150 m apart at z14, which is enough
          // separation that the labels do not collide.
          // The three nodes sit ~150 m apart on a diagonal, which inside a
          // Bento cell puts them within a few dozen pixels of each other. All
          // three labels anchored "top" therefore overlapped into an unreadable
          // stack. Fanning them — above, right, below — separates the text
          // without moving a single marker off its surveyed position.
          const placement = [
            { direction: "top" as const, offset: [0, -11] as [number, number] },
            { direction: "right" as const, offset: [11, 0] as [number, number] },
            { direction: "bottom" as const, offset: [0, 11] as [number, number] },
          ][records.length % 3];

          marker.bindTooltip(station.name, {
            direction: placement.direction,
            offset: placement.offset,
            permanent: true,
            className: "horizon-marker-label",
          });
          if (interactive) {
            // Routed through the canonical helper like every other station
            // link. The map only ever receives pilot stations (its callers
            // filter to the allowlist), so the cast is safe and keeps this
            // call site honest about what it accepts.
            marker.on("click", () => router.push(OBSERVATORY_HREF));
            (marker.getElement() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
          }

          records.push({ station, marker, pulse });
        }
        markersRef.current = records;

        if (stations.length === 0) {
          // Basemap-only: frame the island from the shared reference point.
          map.setView([CON_HO.lat, CON_HO.lng], CON_HO_ZOOM);
        } else if (stations.length === 1) {
          map.setView([stations[0].lat, stations[0].lng], 14);
        } else {
          // `maxZoom` matters here now that positions are the surveyed ones:
          // the three nodes span about 380 m, and an uncapped fitBounds on a
          // cell this size resolves past z17 — close enough that the island
          // leaves the frame entirely and the map reads as abstract grey
          // shapes. Capped, the network and the water around it stay visible,
          // and it matches the zoom the basemap-only view opens at.
          map.fitBounds(L.latLngBounds(stations.map((s) => [s.lat, s.lng])), {
            padding: [32, 32],
            maxZoom: CON_HO_ZOOM,
          });
        }

        setMapReady(true);
      })
      .catch((err) => {
        // Previously unhandled — a failure anywhere in this chain produced
        // total silence: no console entry, no visible map, nothing to debug
        // from, because it rejected a promise nothing awaited or caught.
        if (!cancelled) console.error("StationNetworkMap failed to initialize", err);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = [];
      ringRef.current = null;
      setMapReady(false);
    };
  }, [stations, router, interactive, basemapOnly]);

  // Theme sync — updates the existing tile layer and markers in place
  // instead of rebuilding them, so a toggle click (or the system-preference
  // listener firing right after mount) can never race the base effect above.
  useEffect(() => {
    if (!mapReady) return;
    const colors = FRESHNESS_COLOR[theme];

    tileLayerRef.current?.setUrl(TILE_URL[theme]);

    for (const { station, marker, pulse } of markersRef.current) {
      marker.setStyle({ color: MARKER_STROKE[theme], fillColor: colors[station.freshness] });
      pulse?.setStyle({ fillColor: colors.live });
    }

    ringRef.current?.setStyle({ color: SELECTION_RING_COLOR[theme] });
  }, [theme, mapReady]);

  // Keep Leaflet's idea of its own size in step with the element's.
  //
  // Leaflet only listens for WINDOW resizes. In the Bento the map sits in an
  // aspect-ratio grid cell, so its box also changes height when the grid
  // reflows — a breakpoint crossing, a font swap, the chart's controls
  // wrapping — none of which fire a window resize. When that happens Leaflet
  // keeps painting for its old size and the tile mosaic no longer covers the
  // container, leaving bands of empty backdrop that read as a broken map.
  // A ResizeObserver closes that gap at the element level.
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!mapReady || !map || !el || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // Coalesce to one call per frame: invalidateSize() forces a redraw and
      // ResizeObserver can fire several times during a single reflow.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mapReady]);

  // Selected-station ring — a separate, lightweight effect so picking a
  // different instrument only redraws this one small layer (with a soft
  // grow/fade transition) instead of touching the map or markers at all.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    ringRef.current?.remove();
    ringRef.current = null;

    const station = stations.find((s) => s.id === selectedStationId);
    if (!station) return;

    const ring = L.circleMarker([station.lat, station.lng], {
      radius: 14,
      weight: 1.5,
      color: SELECTION_RING_COLOR[theme],
      fillOpacity: 0,
      interactive: false,
      className: "horizon-selection-ring",
    }).addTo(map);
    ringRef.current = ring;

    const el = ring.getElement();
    if (el instanceof SVGElement) {
      el.setAttribute("r", "9");
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = `r var(--motion-medium) var(--ease-standard), opacity var(--motion-medium) var(--ease-standard)`;
        el.setAttribute("r", "14");
        el.style.opacity = "1";
      });
    }
    // `theme` deliberately excluded: the sync effect above already restyles
    // an existing ring on theme change, and including it here would recreate
    // the ring (and replay its grow/fade entrance) on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, selectedStationId, mapReady]);

  if (stations.length === 0 && !basemapOnly) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center",
          heightClass,
          // In the Bento the map IS the region; framing its empty state as a
          // dashed card would put a second card inside that region. Every
          // other variant keeps the frame, which is what makes it read as a
          // placeholder in normal page flow.
          variant === "grid" ? "bg-muted/5" : "rounded-lg border border-dashed border-border bg-muted/10",
        )}
      >
        {/* In the Bento this state fills the second-largest region on the
            page, so it is deliberately quiet: a mark, one line, and nothing
            else. It previously stacked an eyebrow, an 18px heading and a
            three-line paragraph there — a block of prose occupying the space
            reserved for geography, which drew more attention than the
            measurements beside it while saying only "no data yet". The full
            sentence stays for the page-flow variants, where it has room and
            reads as a caption rather than as a wall. */}
        <MapPinOff className="h-5 w-5 text-foreground-subtle" aria-hidden />
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground-subtle">
          {variant === "grid" ? dict.map.noCoordsTitle : dict.map.noCoordsBody}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        // `bg-canvas-subtle`: Leaflet's own default is #ddd, a light grey
        // that shows through before tiles paint and anywhere the mosaic does
        // not reach. Against the dark canvas that grey reads as a broken or
        // failed map rather than as a map still loading.
        "isolate w-full overflow-hidden bg-canvas-subtle",
        heightClass,
        // In the Bento the map IS the region, which already carries the
        // frame; anywhere else it needs its own.
        variant === "grid" ? "rounded-none" : "rounded-lg border border-border",
        !interactive && "pointer-events-none",
      )}
      role="img"
      // With no stations the count-based label would read "0 stations",
      // which describes the markers rather than what is on screen. The
      // basemap-only view is the island, and says so.
      aria-label={
        stations.length === 0
          ? dict.map.basemapOnlyLabel
          : fmt(dict.map.ariaLabel, { count: stations.length })
      }
    />
  );
}
