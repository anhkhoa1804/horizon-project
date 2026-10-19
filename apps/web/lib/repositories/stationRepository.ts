import { applyStationIdScope, canAccessStation, isMissingTableError, type AppSupabase } from "./base";
import type { RepositoryScope, Station, StationStatus } from "@/types";

function mapStation(row: Record<string, unknown>): Station {
  return {
    id: row.id as string,
    name: row.name as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    status: row.status as StationStatus,
    created_at: row.created_at as string,
  };
}

export class StationRepository {
  constructor(private readonly supabase: AppSupabase) {}

  async getAll(scope: RepositoryScope): Promise<Station[]> {
    let query = this.supabase.from("stations").select("*").order("name");
    query = applyStationIdScope(query, scope);

    const { data, error } = await query;
    if (isMissingTableError(error)) return [];
    if (error) throw error;
    return (data ?? []).map(mapStation);
  }

  async getById(id: string, scope: RepositoryScope): Promise<Station | null> {
    if (!canAccessStation(scope, id)) {
      return null;
    }

    const { data, error } = await this.supabase.from("stations").select("*").eq("id", id).maybeSingle();
    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data ? mapStation(data) : null;
  }

  async getActiveCount(scope: RepositoryScope): Promise<{ active: number; total: number }> {
    const stations = await this.getAll(scope);
    return {
      active: stations.filter((s) => s.status === "active").length,
      total: stations.length,
    };
  }
}
