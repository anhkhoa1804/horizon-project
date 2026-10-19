import { stationProfiles } from "@/lib/stationProfile";
import type { SoilReading, Station, StationReadingSnapshot } from "@/types";

/**
 * The curated 3-node pilot topology — Option A from
 * FRONTEND_REBUILD_SPECIFICATION.md §3.6, firmware-verified (§3.1-3.2): two
 * real sensor stations plus the gateway's public map touchpoint. Identical
 * in spirit to the admin console's existing `managedStationIds`
 * (apps/web/app/admin/page.tsx:27) — this applies the same, already-proven
 * pattern to public read paths instead of inventing a new one.
 *
 * STATION_04/05 are simulator/seed fixtures ("Brackish Edge", "Mangrove
 * Spur" — services/edge-ingestion/scripts/simulator.ts), not operational
 * hardware. No firmware target, no admin config, no documentation anywhere
 * claims otherwise. `StationRepository.getAll()` applies no ID filter for
 * public/admin scope (base.ts's `isUnscopedRead`), so without this filter
 * they leak into any public station list — the source of the "4/5 active"
 * discrepancy identified in the audit.
 *
 * Shared by the live public Observatory and station routes — call sites
 * are added starting with the homepage/dashboard rebuild.
 */
export const PILOT_STATION_IDS = ["STATION_01", "STATION_02", "STATION_03"] as const;

export type PilotStationId = (typeof PILOT_STATION_IDS)[number];

export function isPilotStation(stationId: string): stationId is PilotStationId {
  return (PILOT_STATION_IDS as readonly string[]).includes(stationId);
}

/**
 * Where a station link goes now that per-station pages are gone.
 *
 * `/s/:id` existed to show one node's telemetry in isolation. That is the
 * question the observatory answers better — the Bento shows the network as
 * one instrument, and a reader comparing the river station against the
 * garden station was previously made to navigate between two pages to do it.
 * Everything those pages carried that was not telemetry (each node's role,
 * location and measured variables) is stated on Home's network chapter.
 *
 * The old route redirects here rather than 404ing, so printed QR codes keep
 * working; the hash lands the reader on the Bento instead of the page title.
 * See next.config.ts.
 */
export const OBSERVATORY_HREF = "/dashboard#observatory";

export function filterToPilotStations(stations: Station[]): Station[] {
  return stations.filter((station) => isPilotStation(station.id));
}

export function filterSnapshotsToPilotStations(
  snapshots: StationReadingSnapshot[],
): StationReadingSnapshot[] {
  return snapshots.filter((snapshot) => isPilotStation(snapshot.station.id));
}

/**
 * STATION_02 has no environmental_readings row — its real timestamp lives
 * on soil_readings instead. Kind-aware so soil freshness is never silently
 * read as "unavailable" just because the water-shaped fields are empty.
 */
export function latestPilotTimestamp(
  stationId: PilotStationId,
  snapshot: StationReadingSnapshot | undefined,
  soilReading: SoilReading | null,
): string | null {
  if (stationProfiles[stationId].kind === "soil") {
    return soilReading?.timestamp ?? null;
  }
  return snapshot?.reading?.timestamp ?? snapshot?.health?.timestamp ?? null;
}
