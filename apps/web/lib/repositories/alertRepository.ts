import { applyStationScope, isMissingTableError, type AppSupabase } from "./base";
import type { AlertSeverity, EnvironmentalEvent, RepositoryScope } from "@/types";

function mapEvent(row: Record<string, unknown>): EnvironmentalEvent {
  return {
    id: row.id as string,
    station_id: row.station_id as string,
    event_type: row.event_type as EnvironmentalEvent["event_type"],
    severity: row.severity as AlertSeverity,
    message_id: (row.message_id as string | null) ?? null,
    details: (row.details as Record<string, unknown>) ?? {},
    timestamp: row.timestamp as string,
    created_at: row.created_at as string,
  };
}

export class AlertRepository {
  constructor(private readonly supabase: AppSupabase) {}

  async getRecent(limit: number, scope: RepositoryScope): Promise<EnvironmentalEvent[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from("environmental_events")
      .select("*")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false })
      .limit(limit);

    query = applyStationScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return [];
    if (error) throw error;
    return (data ?? []).map(mapEvent);
  }

  async getBySeverity(severity: AlertSeverity, scope: RepositoryScope): Promise<EnvironmentalEvent[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from("environmental_events")
      .select("*")
      .eq("severity", severity)
      .gte("timestamp", since)
      .order("timestamp", { ascending: false })
      .limit(100);

    query = applyStationScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return [];
    if (error) throw error;
    return (data ?? []).map(mapEvent);
  }

  async countCritical(scope: RepositoryScope): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = this.supabase
      .from("environmental_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .gte("timestamp", since);

    query = applyStationScope(query, scope);

    const { count, error } = await query;
    if (isMissingTableError(error)) return 0;
    if (error) throw error;
    return count ?? 0;
  }
}
