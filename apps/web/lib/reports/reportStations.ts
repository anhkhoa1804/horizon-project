import { PILOT_STATION_IDS } from "@/lib/publicStations";
import { stationProfiles, type StationKind } from "@/lib/stationProfile";

/**
 * The station choices offered to a field reporter, derived entirely from the
 * existing pilot allowlist and station profiles — no new copy, no invented
 * geography. `location` here is the profile's own verified location string;
 * nothing describes a place this project hasn't already documented.
 *
 * Replaces the old free-text "nhập mã trạm, ví dụ STATION_02" input: the
 * reporter picks a place they recognize, and the technical id travels with
 * it as secondary metadata for the API (which resolves it to real
 * coordinates server-side).
 */

export interface ReportStationOption {
  id: string;
  name: string;
  location: string;
  kind: StationKind;
}

export const REPORT_STATION_OPTIONS: readonly ReportStationOption[] = PILOT_STATION_IDS.map((id) => {
  const profile = stationProfiles[id];
  return { id, name: profile.name, location: profile.location, kind: profile.kind };
});

/** Narrows an arbitrary ?station= query value to a real pilot station, or null. */
export function resolveStationOption(raw: string | null | undefined): ReportStationOption | null {
  if (!raw) return null;
  return REPORT_STATION_OPTIONS.find((option) => option.id === raw) ?? null;
}
