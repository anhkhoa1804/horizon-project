import type { AppSupabase } from "./base";
import type { RepositoryScope, UserProfile, UserRole } from "@/types";

export class UserRepository {
  constructor(private readonly supabase: AppSupabase) {}

  async getAssignedStationIds(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("station_assignments")
      .select("station_id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.station_id as string);
  }

  async getProfile(authUserId: string, email: string): Promise<UserProfile> {
    const { data: appUser, error } = await this.supabase
      .from("users")
      .select("id, phone, role, email")
      .eq("id", authUserId)
      .maybeSingle();

    if (error) throw error;

    const role = (appUser?.role as UserProfile["role"]) ?? "farmer";
    const assignedStationIds =
      role === "admin" ? [] : await this.getAssignedStationIds(authUserId);

    return {
      id: authUserId,
      email: appUser?.email ?? email,
      role,
      phone: (appUser?.phone as string | null) ?? null,
      assignedStationIds,
    };
  }

  buildScope(profile: UserProfile): RepositoryScope {
    return {
      userId: profile.id,
      role: (profile.role ?? "farmer") as UserRole,
      stationIds: profile.role === "admin" ? [] : profile.assignedStationIds,
    };
  }
}
