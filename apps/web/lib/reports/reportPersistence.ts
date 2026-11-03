/**
 * Pure decision logic for how apps/web/app/api/public/reports/route.ts
 * responds when a Supabase insert into damage_logs fails. Kept free of any
 * "server-only" import (unlike route.ts's createServiceClient() call) so
 * it can be unit-tested directly.
 */

export function isMissingTableError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "PGRST205"
  );
}

export type ReportPersistenceOutcome = "insert_failed";

/**
 * A missing table is still a persistence failure. Demo reports are allowed
 * only through the route's explicit `?mode=demo` boundary; no database error
 * may turn a public submission into an in-memory success.
 */
export function classifyInsertError(error: unknown): ReportPersistenceOutcome {
  void error;
  return "insert_failed";
}
