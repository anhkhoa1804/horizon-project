import type { PilotStationId } from "@/lib/publicStations";

/**
 * THE ONE PLACE THAT KNOWS WHERE ANYTHING IS.
 *
 * Coordinates are not measurements. A station's position is a surveyed fact
 * about the installation, the same way "Vĩnh Long" is — which is what makes
 * it safe to draw the island in demo mode while refusing to draw demo
 * readings. What is forbidden is inventing a *position*, not showing a real
 * one.
 *
 * WHY THIS FILE EXISTS. The project had three separate opinions about where
 * Cồn Hô is: a private constant in the weather client, another in the health
 * probe, a third in the report route's fallback — and the map took its
 * positions from whatever the database happened to hold. Nothing compared
 * them, so nothing caught that the shared constant (10.2419, 105.826) sits
 * roughly 48 km from the actual stations. Every consumer now reads from here.
 *
 * PROVENANCE OF THE STATION COORDINATES. Supplied by the project owner as
 * degrees/minutes/seconds and converted here once:
 *
 *   STATION_01   10°04'26.3"N  106°15'01.5"E
 *   STATION_02   10°04'20.8"N  106°15'11.0"E
 *   STATION_03   10°04'15.6"N  106°15'15.0"E
 *
 * Conversion is decimal = deg + min/60 + sec/3600, carried to six places
 * (~0.1 m — far finer than the source's 0.1" ≈ 3 m precision, so the
 * rounding contributes nothing).
 *
 * Deliberately NOT `server-only`: the map is a client component and needs the
 * same positions the server uses.
 */

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Surveyed positions of the three pilot nodes.
 *
 * These are the authority. The `station` table also carries lat/lng, but a
 * database row is operational state that can be edited, seeded or left at a
 * 0,0 default — and 0,0 is a real place in the Gulf of Guinea. Rendering
 * reads from here so a bad row can never relocate the network.
 */
export const STATION_COORDS: Record<PilotStationId, GeoPoint> = {
  STATION_01: { lat: 10.073972, lng: 106.250417 },
  STATION_02: { lat: 10.072444, lng: 106.253056 },
  STATION_03: { lat: 10.071, lng: 106.254167 },
};

/**
 * The island reference point — the centroid of the three stations, computed
 * from the values above rather than typed in, so it cannot drift from them.
 *
 * Used to centre the basemap when there are no markers to fit, and as the
 * query point for regional weather. It replaced a hand-entered constant that
 * was ~48 km away: Open-Meteo answers for a model grid cell, so that error
 * was silently returning a different place's weather.
 */
export const CON_HO: GeoPoint = (() => {
  const points = Object.values(STATION_COORDS);
  const mean = (pick: (p: GeoPoint) => number) =>
    points.reduce((sum, p) => sum + pick(p), 0) / points.length;
  return { lat: mean((p) => p.lat), lng: mean((p) => p.lng) };
})();

/**
 * The zoom the basemap opens at, and the ceiling `fitBounds` may resolve to.
 *
 * The three stations span only ~380 m, so an uncapped fit on a cell this size
 * lands past z17 — close enough that the island leaves the frame and the map
 * renders as abstract grey shapes rather than a place. 14 keeps the island
 * and the channels either side of it in view, which is the whole reason the
 * map is on the canvas. Checked against the rendered tiles, not assumed:
 * Esri's Light Gray canvas carries very little detail over rural Vĩnh Long,
 * so the surrounding water is what makes the cell legible as geography.
 */
export const CON_HO_ZOOM = 14;
