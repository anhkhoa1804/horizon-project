import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertRepository } from "./alertRepository";
import { ReadingRepository } from "./readingRepository";
import { StationRepository } from "./stationRepository";
import { UserRepository } from "./userRepository";
import type { DashboardMetrics, RepositoryScope } from "@/types";

export function createRepositories(supabase: SupabaseClient) {
  return {
    stations: new StationRepository(supabase),
    readings: new ReadingRepository(supabase),
    alerts: new AlertRepository(supabase),
    users: new UserRepository(supabase),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export async function getDashboardMetrics(repos: Repositories, scope: RepositoryScope): Promise<DashboardMetrics> {
  const results = await Promise.allSettled([
    repos.stations.getActiveCount(scope),
    repos.readings.getAverageSalinity(scope),
    repos.alerts.countCritical(scope),
    repos.readings.countWeakSignalNodes(scope),
  ]);

  const getValue = <T>(index: number, fallback: T): T => 
    results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<T>).value : fallback;

  const counts = getValue(0, { active: 0, total: 0 });

  return {
    activeStations: counts.active,
    totalStations: counts.total,
    averageSalinity: getValue<number | null>(1, null),
    criticalAlerts: getValue(2, 0),
    weakSignalNodes: getValue(3, 0),
  };
}

export { AlertRepository, ReadingRepository, StationRepository, UserRepository };
