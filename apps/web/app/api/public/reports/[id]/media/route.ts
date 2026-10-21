import { NextResponse } from "next/server";
import { REPORT_MEDIA_BUCKET } from "@/lib/reports/media";
import { finalizeDirectUploads, resignUploads } from "@/lib/reports/evidence";
import { verifyUploadTicket } from "@/lib/reports/uploadTicket";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Second half of the direct evidence upload (see lib/reports/evidence.ts).
 *
 *   { ticket, action: "finalize", paths }  → record what is really in Storage
 *   { ticket, action: "resign",   paths }  → fresh upload URLs for a retry
 *
 * Authorised only by the upload ticket the report POST issued: the ticket
 * names this report and its server-chosen paths, so a caller can neither
 * attach to another report nor introduce a path the server did not choose.
 * The body is a few hundred bytes — no file ever passes through here.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { ticket?: unknown; action?: unknown; paths?: unknown };
  try {
    const text = await request.text();
    if (text.length > 16_384) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 413 });
    body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const ticket = verifyUploadTicket(body.ticket);
  if (!ticket || ticket.reportId !== id) {
    return NextResponse.json({ ok: false, error: "invalid_ticket" }, { status: 403 });
  }

  const requested = Array.isArray(body.paths) ? body.paths.filter((path): path is string => typeof path === "string") : [];
  const paths = [...new Set(requested)].filter((path) => ticket.paths.includes(path));
  if (paths.length === 0 || paths.length !== new Set(requested).size) {
    return NextResponse.json({ ok: false, error: "invalid_paths" }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "persistence_unavailable" }, { status: 503 });
  }

  if (body.action === "resign") {
    // Never re-open a path that is already recorded evidence: an upsert URL
    // for it would let the original object be swapped after review.
    const { data: existing, error } = await supabase
      .from("report_media")
      .select("storage_path")
      .in("storage_path", paths);
    if (error) return NextResponse.json({ ok: false, error: "persistence_unavailable" }, { status: 503 });
    const recorded = new Set((existing ?? []).map((row) => row.storage_path as string));
    const uploads = await resignUploads(supabase, paths.filter((path) => !recorded.has(path)));
    return NextResponse.json({ ok: true, uploads, alreadyRecorded: [...recorded] });
  }

  if (body.action !== "finalize") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const result = await finalizeDirectUploads(supabase, id, paths);
  return NextResponse.json({
    ok: true,
    bucket: REPORT_MEDIA_BUCKET,
    media: result.recorded,
    problems: result.problems,
  });
}
