import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export interface AdminAllowedEmailEntry {
  email: string;
  source: "env" | "database";
  note: string | null;
  created_at: string | null;
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function adminAllowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isAdminEmailAllowedByEnv(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  return adminAllowedEmails().includes(normalized);
}

export async function loadAdminAllowedEmailEntries(): Promise<AdminAllowedEmailEntry[]> {
  const entries = new Map<string, AdminAllowedEmailEntry>();

  for (const email of adminAllowedEmails()) {
    entries.set(email, {
      email,
      source: "env",
      note: "Quyền gốc từ ADMIN_ALLOWED_EMAILS",
      created_at: null,
    });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return Array.from(entries.values());
  }

  const { data, error } = await supabase
    .from("admin_allowed_emails")
    .select("email, note, created_at")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return Array.from(entries.values());
  }

  for (const row of data ?? []) {
    const email = normalizeEmail(row.email as string | null);
    if (!email || entries.has(email)) {
      continue;
    }

    entries.set(email, {
      email,
      source: "database",
      note: (row.note as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
    });
  }

  return Array.from(entries.values());
}

export async function isAdminEmailAllowed(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  if (isAdminEmailAllowedByEnv(normalized)) {
    return true;
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("admin_allowed_emails")
    .select("email")
    .eq("email", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}
