import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export interface AdminCommunityReportRow {
  id: string;
  description: string | null;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
  viewed_at: string | null;
}

/** The same base report read used by the Admin page, without signed media URLs. */
export async function loadAdminCommunityReportRows(): Promise<AdminCommunityReportRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("damage_logs")
    .select("id, description, status, lat, lng, timestamp, viewed_at")
    .order("timestamp", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    timestamp: row.timestamp as string,
    viewed_at: (row.viewed_at as string | null) ?? null,
  }));
}

export const ADMIN_REPORT_PAGE_SIZE = 20;
export const ADMIN_REPORT_STATUSES = ["new", "reviewing", "resolved"] as const;
export type AdminReportStatusFilter = (typeof ADMIN_REPORT_STATUSES)[number] | "all";

/** Parse untrusted query-string input into a safe filter + 1-based page. */
export function parseReportQuery(statusParam: unknown, pageParam: unknown): { status: AdminReportStatusFilter; page: number } {
  const status = typeof statusParam === "string" && (ADMIN_REPORT_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as AdminReportStatusFilter)
    : "all";
  const raw = typeof pageParam === "string" && /^\d{1,5}$/.test(pageParam) ? Number.parseInt(pageParam, 10) : Number.NaN;
  const page = Number.isFinite(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
  return { status, page };
}

export interface AdminReportPage {
  rows: AdminCommunityReportRow[];
  /** Total rows matching the filter, or null when the count could not be read. */
  total: number | null;
  /** false = the read FAILED; an empty list with ok:true really means "none". */
  ok: boolean;
}

/**
 * One page of reports, newest first, optionally filtered by status.
 * A failed read is reported as `ok:false` — never as an empty queue.
 */
export async function loadAdminCommunityReportPage(
  query: { status: AdminReportStatusFilter; page: number },
  pageSize = ADMIN_REPORT_PAGE_SIZE,
): Promise<AdminReportPage> {
  const supabase = createServiceClient();
  if (!supabase) return { rows: [], total: null, ok: false };

  const from = (query.page - 1) * pageSize;
  let request = supabase
    .from("damage_logs")
    .select("id, description, status, lat, lng, timestamp, viewed_at", { count: "exact" })
    .order("timestamp", { ascending: false })
    .range(from, from + pageSize - 1);
  if (query.status !== "all") request = request.eq("status", query.status);

  const { data, error, count } = await request;
  if (error) return { rows: [], total: null, ok: false };
  return {
    ok: true,
    total: typeof count === "number" ? count : null,
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      description: (row.description as string | null) ?? null,
      status: row.status as string,
      lat: Number(row.lat),
      lng: Number(row.lng),
      timestamp: row.timestamp as string,
      viewed_at: (row.viewed_at as string | null) ?? null,
    })),
  };
}
