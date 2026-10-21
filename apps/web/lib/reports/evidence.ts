import "server-only";

import type { AppSupabase } from "@/lib/repositories/base";
import { logger } from "@/lib/observability/logger";
import {
  REPORT_MEDIA_BUCKET,
  REPORT_MEDIA_MAX_FILES,
  checkReportMedia,
  mediaRule,
  parseReportMediaPath,
  reportMediaPath,
  type MediaRejection,
} from "@/lib/reports/media";
import { issueUploadTicket } from "@/lib/reports/uploadTicket";

/**
 * Evidence for a community report, in two server steps around a direct
 * browser → Storage upload:
 *
 *   1. prepareDirectUploads — after the report row exists, choose a storage
 *      path per declared file and sign a single-use upload URL for it.
 *   2. (browser PUTs each file to its signed URL; no Vercel function in the
 *      path, so the 4.5 MB function body limit does not apply)
 *   3. finalizeDirectUploads — confirm each object actually exists in Storage
 *      with an accepted type and size, then write its report_media row.
 *
 * A report_media row is written ONLY for an object the server has seen in
 * Storage. Declaring a file, or receiving an upload URL for it, records
 * nothing — so the Admin console can never show evidence that did not arrive.
 */

export interface MediaManifestEntry {
  name: string;
  type: string;
  size: number;
}

export interface PreparedUpload {
  index: number;
  name: string;
  path: string;
  token: string;
  signedUrl: string;
  mimeType: string;
}

export interface ManifestProblem {
  index: number;
  name: string;
  reason: MediaRejection | "too_many";
}

/** Validates an untrusted JSON manifest. Never trusts a size or type it was not given in range. */
export function parseMediaManifest(raw: unknown): { entries: MediaManifestEntry[]; problems: ManifestProblem[] } | null {
  if (raw === undefined || raw === null) return { entries: [], problems: [] };
  if (!Array.isArray(raw)) return null;
  if (raw.length > REPORT_MEDIA_MAX_FILES) {
    return { entries: [], problems: raw.map((_, index) => ({ index, name: "", reason: "too_many" as const })) };
  }
  const entries: MediaManifestEntry[] = [];
  const problems: ManifestProblem[] = [];
  raw.forEach((item, index) => {
    const value = (item ?? {}) as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name.slice(0, 200) : "";
    const type = typeof value.type === "string" ? value.type.slice(0, 120) : "";
    const size = typeof value.size === "number" ? value.size : Number.NaN;
    const check = checkReportMedia({ name, type, size });
    if (!check.ok || !check.mimeType) {
      problems.push({ index, name, reason: check.reason ?? "unsupported_type" });
      return;
    }
    entries.push({ name, type: check.mimeType, size });
  });
  return { entries, problems };
}

export async function prepareDirectUploads(
  supabase: AppSupabase,
  reportId: string,
  entries: MediaManifestEntry[],
): Promise<{ uploads: PreparedUpload[]; failures: string[]; ticket: string | null }> {
  const uploads: PreparedUpload[] = [];
  const failures: string[] = [];

  for (const [index, entry] of entries.entries()) {
    const check = checkReportMedia(entry);
    if (!check.ok || !check.extension || !check.mimeType) {
      failures.push(entry.name || "attachment");
      continue;
    }
    const path = reportMediaPath(reportId, crypto.randomUUID(), check.extension);
    const { data, error } = await supabase.storage.from(REPORT_MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data.token) {
      logger.error("reports.media_sign_failed", { message: error?.message ?? "no signed url" });
      failures.push(entry.name || "attachment");
      continue;
    }
    uploads.push({ index, name: entry.name, path, token: data.token, signedUrl: data.signedUrl, mimeType: check.mimeType });
  }

  const ticket = uploads.length > 0 ? issueUploadTicket(reportId, uploads.map((upload) => upload.path)) : null;
  if (uploads.length > 0 && !ticket) {
    // Without a ticket the browser could upload but never record the file;
    // say so now instead of after a 20 MB transfer.
    return { uploads: [], failures: entries.map((entry) => entry.name || "attachment"), ticket: null };
  }
  return { uploads, failures, ticket };
}

export interface RecordedMedia {
  path: string;
  id: string;
  media_type: string;
}

export type FinalizeProblem = "not_uploaded" | "rejected_object" | "record_failed";

/**
 * Records every path that is genuinely present in Storage. Idempotent: a
 * repeated call (a retry after a dropped response) returns the existing row
 * rather than writing a second one, because storage_path is unique.
 */
export async function finalizeDirectUploads(
  supabase: AppSupabase,
  reportId: string,
  paths: string[],
): Promise<{ recorded: RecordedMedia[]; problems: { path: string; reason: FinalizeProblem }[] }> {
  const recorded: RecordedMedia[] = [];
  const problems: { path: string; reason: FinalizeProblem }[] = [];
  const folder = `reports/${reportId}`;

  const { data: listing, error: listError } = await supabase.storage
    .from(REPORT_MEDIA_BUCKET)
    .list(folder, { limit: 100 });
  if (listError) {
    logger.error("reports.media_list_failed", { message: listError.message });
    return { recorded, problems: paths.map((path) => ({ path, reason: "record_failed" as const })) };
  }

  for (const path of paths) {
    const parsed = parseReportMediaPath(path);
    if (!parsed || parsed.reportId !== reportId) {
      problems.push({ path, reason: "rejected_object" });
      continue;
    }
    const object = (listing ?? []).find((item) => item.name === parsed.fileName);
    const metadata = (object?.metadata ?? null) as { size?: number; mimetype?: string } | null;
    if (!object || !metadata) {
      problems.push({ path, reason: "not_uploaded" });
      continue;
    }

    const size = Number(metadata.size);
    const mimeType = String(metadata.mimetype ?? "").toLowerCase().split(";")[0];
    const rule = mediaRule(mimeType);
    if (!rule || rule.extension !== parsed.extension || !Number.isFinite(size) || size <= 0 || size > rule.maxBytes) {
      // Storage holds something this report never declared in an accepted
      // shape. Remove it rather than leave an unreviewable object behind.
      await supabase.storage.from(REPORT_MEDIA_BUCKET).remove([path]);
      problems.push({ path, reason: "rejected_object" });
      continue;
    }

    const { data: row, error } = await supabase
      .from("report_media")
      .insert({ report_id: reportId, storage_path: path, media_type: rule.type, mime_type: mimeType, file_size: size })
      .select("id, media_type")
      .single();

    if (row && !error) {
      recorded.push({ path, id: row.id as string, media_type: row.media_type as string });
      continue;
    }

    if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("report_media")
        .select("id, media_type")
        .eq("storage_path", path)
        .maybeSingle();
      if (existing) {
        recorded.push({ path, id: existing.id as string, media_type: existing.media_type as string });
        continue;
      }
    }

    logger.error("reports.media_record_failed", { message: error?.message ?? "no row", code: error?.code });
    problems.push({ path, reason: "record_failed" });
  }

  return { recorded, problems };
}

/** Fresh upload URLs for paths a ticket already authorises (an expired or failed attempt). */
export async function resignUploads(
  supabase: AppSupabase,
  paths: string[],
): Promise<{ path: string; token: string; signedUrl: string }[]> {
  const signed: { path: string; token: string; signedUrl: string }[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(REPORT_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (!error && data?.signedUrl && data.token) signed.push({ path, token: data.token, signedUrl: data.signedUrl });
  }
  return signed;
}
