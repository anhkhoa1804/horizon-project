import { isAdminEmailAllowed } from "@/lib/auth/adminAllowlist";
import { getLocalAdminSession } from "@/lib/auth/localAdminSession";
import type { RepositoryScope, UserProfile } from "@/types";

export async function getSessionContext(): Promise<{
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  scope: RepositoryScope | null;
}> {
  const session = await getLocalAdminSession();
  if (!session || !(await isAdminEmailAllowed(session.email))) {
    return { user: null, profile: null, scope: null };
  }

  const profile: UserProfile = {
    id: `local-admin:${session.email}`,
    email: session.email,
    role: "admin",
    phone: null,
    assignedStationIds: [],
  };

  return {
    user: { id: profile.id, email: profile.email },
    profile,
    scope: {
      userId: profile.id,
      role: "admin",
      stationIds: [],
    },
  };
}
