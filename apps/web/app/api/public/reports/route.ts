import { NextResponse } from "next/server";
import { addDemoReport } from "@/lib/reports/demoReportStore";
import { clientIdentifier, consumeReportQuota } from "@/lib/reports/rateLimit";
import { logger } from "@/lib/observability/logger";
import { REPORT_MEDIA_BUCKET, REPORT_MEDIA_MAX_FILES, reportMediaPath, validateReportMedia } from "@/lib/reports/media";
import { parseMediaManifest, prepareDirectUploads } from "@/lib/reports/evidence";
import { createServiceClient } from "@/lib/supabase/service";
import { CON_HO } from "@/lib/geo";

const CATEGORIES = [
  "erosion",
  "flooding",
  "pollution",
  "infrastructure",
  "sensor",
  "other",
] as const;

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

/**
 * Demo persistence is deliberately opt-in. A public report must never become
 * an in-memory success merely because Supabase is missing or a migration has
 * not been deployed. Design review can still request this endpoint explicitly
 * with `?mode=demo` on a non-production server. It is never a production
 * fallback, even if a deployment accidentally sets a demo environment flag.
 */
function allowsDemoPersistence(request: Request): boolean {
  const requested = new URL(request.url).searchParams.get("mode") === "demo";
  return process.env.NODE_ENV !== "production" && (requested || process.env.HORIZON_DEMO_REPORTS === "true");
}

export async function POST(request: Request) {
  const demoPersistence = allowsDemoPersistence(request);
  let body: Record<string, unknown>;
  let files: File[] = [];
  let manifestRaw: unknown = undefined;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = {
        category: form.get("category"),
        description: form.get("description"),
        lat: form.get("lat") ? Number(form.get("lat")) : undefined,
        lng: form.get("lng") ? Number(form.get("lng")) : undefined,
        stationId: form.get("stationId"),
      };
      files = form.getAll("media").filter((entry): entry is File => entry instanceof File);
    } else {
      const json = await request.json();
      if (!json || typeof json !== "object") throw new Error("invalid payload");
      body = json as Record<string, unknown>;
      manifestRaw = (json as Record<string, unknown>).media;
    }
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { category, description, lat, lng, stationId } = body;

  if (
    typeof category !== "string" ||
    !CATEGORIES.includes(category as (typeof CATEGORIES)[number])
  ) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  if (typeof description !== "string" || description.trim().length < MIN_DESCRIPTION) {
    return NextResponse.json({ error: "description_too_short" }, { status: 400 });
  }

  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "description_too_long" }, { status: 400 });
  }

  if (files.length > REPORT_MEDIA_MAX_FILES) {
    return NextResponse.json({ error: "too_many_media" }, { status: 400 });
  }
  if (files.some((file) => !validateReportMedia(file))) {
    return NextResponse.json({ error: "invalid_media" }, { status: 400 });
  }

  // JSON submissions declare their evidence instead of carrying it. The
  // declaration is validated here, BEFORE the report row is written, so a
  // reporter whose file can never be accepted is told so while they can
  // still fix it — not after the report has been stored without it.
  const manifest = parseMediaManifest(manifestRaw);
  if (!manifest) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (manifest.problems.some((problem) => problem.reason === "too_many")) {
    return NextResponse.json({ error: "too_many_media" }, { status: 400 });
  }
  if (manifest.problems.length > 0) {
    return NextResponse.json({ error: "invalid_media", problems: manifest.problems }, { status: 400 });
  }

  // Created before the throttle check so the durable limiter (which shares
  // this client) is consulted rather than the per-instance fallback.
  const supabase = createServiceClient();

  if (!supabase && !demoPersistence) {
    return NextResponse.json({ ok: false, error: "persistence_unavailable" }, { status: 503 });
  }

  const quota = await consumeReportQuota(supabase, clientIdentifier(request));
  if (quota.limited) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (quota.backend === "memory" && supabase) {
    // Supabase is configured but the durable counter did not answer — almost
    // always migration 021 not applied. Worth a log line: throttling is
    // running per-instance and is therefore bypassable.
    logger.warn("reports.rate_limit_degraded", {
      reason: "durable limiter unavailable; using per-instance fallback",
    });
  }

  let reportLat = typeof lat === "number" ? lat : null;
  let reportLng = typeof lng === "number" ? lng : null;

  if (supabase && typeof stationId === "string" && stationId.length > 0) {
    const { data: station } = await supabase
      .from("stations")
      .select("lat, lng")
      .eq("id", stationId)
      .maybeSingle();

    if (station) {
      reportLat ??= Number(station.lat);
      reportLng ??= Number(station.lng);
    }
  }

  // Approximate center of the real pilot station cluster (STATION_01/02/03,
  // infra/supabase/seed/pilot_seed.sql), used only when neither GPS nor a
  // resolvable station gives a real position. The previous constant here
  // (10.082, 106.032) was ~20km from the actual monitored area and was
  // stored as though it were a precise report location with no way for
  // anyone downstream to tell it apart from a real one. `lat`/`lng` on
  // damage_logs are NOT NULL, so this can't simply be omitted — the
  // fallback is now at least on the real island, and is marked in the
  // description (same bracket-tag pattern already used for category/
  // station below) so it's traceable as an estimate, not fabricated
  // precision.
  const FALLBACK_LAT = CON_HO.lat;
  const FALLBACK_LNG = CON_HO.lng;
  let usedFallbackLocation = false;

  if (
    reportLat === null ||
    reportLng === null ||
    !Number.isFinite(reportLat) ||
    !Number.isFinite(reportLng)
  ) {
    reportLat = FALLBACK_LAT;
    reportLng = FALLBACK_LNG;
    usedFallbackLocation = true;
  }

  const fullDescription =
    `[${category}]` +
    (typeof stationId === "string" && stationId ? ` [station:${stationId}]` : "") +
    (usedFallbackLocation ? " [vị trí: ước tính]" : "") +
    ` ${description.trim()}`;

  const demoReport = () =>
    addDemoReport({
      lat: reportLat,
      lng: reportLng,
      description: fullDescription,
      timestamp: new Date().toISOString(),
    });

  if (demoPersistence) {
    const report = demoReport();
    return NextResponse.json({
      ok: true,
      demo: true,
      id: report.id,
      uploads: [],
      media: [],
      mediaFailures: [],
      mediaSkipped: manifest.entries.map((entry) => entry.name),
    });
  }

  // The earlier branch returned a 503 when this client was unavailable. Keep
  // the explicit guard here as well so the durable path cannot accidentally
  // regain an implicit nullable client through a future refactor.
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "persistence_unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("damage_logs")
    .insert({
      user_id: null,
      lat: reportLat,
      lng: reportLng,
      description: fullDescription,
      status: "new",
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // Message only, never the error object: a Postgres error can carry the
    // failing statement and its parameters, i.e. the reporter's own text.
    logger.error("reports.insert_failed", { message: error.message, code: error.code });
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 502 });
  }

  // Direct-upload path (the one the report form uses). The row exists; hand
  // back one signed upload URL per declared file. Nothing is recorded as
  // evidence until /api/public/reports/[id]/media has seen the object in
  // Storage, so a URL the browser never uses leaves no false trace.
  if (manifest.entries.length > 0) {
    const prepared = await prepareDirectUploads(supabase, data.id as string, manifest.entries);
    return NextResponse.json({
      ok: true,
      id: data.id,
      uploads: prepared.uploads,
      uploadTicket: prepared.ticket,
      media: [],
      mediaFailures: prepared.failures,
    });
  }

  // A report is already useful without its evidence. Upload each attachment
  // after the durable row exists; a failed object never rolls the report back
  // and each failure is named so the client can offer a retry instead of
  // silently pretending it was stored.
  const media: { id: string; media_type: string }[] = [];
  const mediaFailures: string[] = [];
  for (const file of files) {
    const rule = validateReportMedia(file);
    if (!rule) {
      mediaFailures.push(file.name || "attachment");
      continue;
    }
    const storagePath = reportMediaPath(data.id as string, crypto.randomUUID(), rule.extension);
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(REPORT_MEDIA_BUCKET)
      .upload(storagePath, bytes, { contentType: rule.mimeType, upsert: false });
    if (uploadError) {
      mediaFailures.push(file.name || "attachment");
      continue;
    }
    const { data: mediaRow, error: mediaError } = await supabase
      .from("report_media")
      .insert({
        report_id: data.id,
        storage_path: storagePath,
        media_type: rule.type,
        mime_type: rule.mimeType,
        file_size: file.size,
      })
      .select("id, media_type")
      .single();
    if (mediaError || !mediaRow) {
      await supabase.storage.from(REPORT_MEDIA_BUCKET).remove([storagePath]);
      mediaFailures.push(file.name || "attachment");
      continue;
    }
    media.push(mediaRow as { id: string; media_type: string });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    media,
    mediaFailures,
  });
}
