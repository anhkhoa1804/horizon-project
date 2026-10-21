"use client";
import { KeywordTitle } from "@/components/ui/keyword-title";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crosshair,
  Mic,
  Send,
  Sprout,
  Trash2,
  Video,
  Waves,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StationNetworkMap, type MapStation } from "@/components/dashboard/station-network-map";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  REPORT_CATEGORIES,
  categoryLabel,
} from "@/lib/reports/reportCategories";
import {
  REPORT_MEDIA_ACCEPT_BY_KIND,
  REPORT_MEDIA_MAX_FILES,
  checkReportMedia,
  mediaFingerprint,
} from "@/lib/reports/media";
import { putToSignedUrl, type SignedUpload } from "@/lib/reports/directUpload";
import { REPORT_STATION_OPTIONS, resolveStationOption } from "@/lib/reports/reportStations";
import { stationDeviceCode, stationText } from "@/lib/stationProfile";
import { STATION_COORDS } from "@/lib/geo";
import type { PilotStationId } from "@/lib/publicStations";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/vi";
import type { StationKind } from "@/lib/stationProfile";

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };
/** One attachment's journey after the report row exists. */
interface EvidenceItem {
  file: File;
  mimeType: string;
  path: string | null;
  state: "uploaded" | "failed";
}

interface SubmitResult {
  id: string;
  demo: boolean;
  /** Files the server recorded as report_media rows — the only "saved" evidence. */
  evidence: EvidenceItem[];
  /** Server-signed capability to retry this report's uploads; null when none are pending. */
  ticket: string | null;
  demoSkipped: string[];
  stationName: string;
  categoryLabel: string;
  submittedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function errorMessageFor(status: number, code: string | undefined, dict: Dictionary): string {
  const f = dict.report.form;
  if (status === 429) return f.errRateLimit;
  if (status === 413) return f.errPayloadTooLarge;
  if (status === 503 || code === "persistence_unavailable") return f.errPersistence;
  if (code === "description_too_short") return fmt(f.errTooShort, { min: DESCRIPTION_MIN });
  if (code === "description_too_long") return fmt(f.errTooLong, { max: DESCRIPTION_MAX });
  if (code === "invalid_category") return f.errInvalidKind;
  if (code === "too_many_media") return f.errMediaCapacity;
  if (code === "invalid_media") return f.errMediaInvalid;
  return f.errSendFailed;
}

async function postJson(url: string, body: unknown): Promise<{ status: number; payload: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // A platform error page (413, 504) is HTML, not JSON — keep the status.
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, payload };
}

/**
 * Uploads each pending file straight to Storage on its signed URL, then asks
 * the server to record what actually arrived. Returns the items with their
 * final state — "uploaded" only for files the server confirmed.
 */
async function uploadEvidence(
  reportId: string,
  ticket: string,
  items: { file: File; mimeType: string; upload: SignedUpload }[],
  onProgress: (label: string, pct: number) => void,
  dict: Dictionary,
): Promise<{ confirmed: Set<string>; attempted: Set<string> }> {
  const f = dict.report.form;
  const attempted = new Set<string>();
  const total = items.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let done = 0;
  for (const item of items) {
    const outcome = await putToSignedUrl(item.upload, item.file, item.mimeType, (loaded) => {
      onProgress(fmt(f.uploadingFile, { name: item.file.name, pct: Math.round(((done + loaded) / total) * 100) }), Math.round(((done + loaded) / total) * 100));
    });
    done += item.file.size;
    if (outcome.ok) attempted.add(item.upload.path);
  }
  const confirmed = new Set<string>();
  if (attempted.size === 0) return { confirmed, attempted };
  onProgress(f.finalizing, 100);
  try {
    const { status, payload } = await postJson(`/api/public/reports/${encodeURIComponent(reportId)}/media`, {
      ticket,
      action: "finalize",
      paths: [...attempted],
    });
    if (status >= 200 && status < 300 && Array.isArray(payload.media)) {
      for (const row of payload.media as { path?: unknown }[]) {
        if (typeof row.path === "string") confirmed.add(row.path);
      }
    }
  } catch {
    // Network loss after the bytes went up: those files stay "failed" in the
    // UI and the retry path will finalize them (finalize is idempotent).
  }
  return { confirmed, attempted };
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

function SuccessView({
  result,
  onAnother,
  onRetry,
  retrying,
  retryNote,
}: {
  result: SubmitResult;
  onAnother: () => void;
  onRetry: () => void;
  retrying: boolean;
  retryNote: string | null;
}) {
  const dict = useDict();
  const f = dict.report.form;
  const saved = result.evidence.filter((item) => item.state === "uploaded");
  const failed = result.evidence.filter((item) => item.state === "failed");
  const canRetry = failed.length > 0 && failed.some((item) => item.path) && result.ticket !== null;
  return (
    <div className="animate-entrance max-w-2xl space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Check className="h-4 w-4 text-healthy" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-healthy">{f.successEyebrow}</p>
        </div>
        <h2 className="text-h1 font-semibold tracking-tight">{f.successTitle}</h2>
        <p className="text-sm leading-relaxed text-muted">
          {result.demo
            ? f.savedLocally
            : f.savedToDb}
        </p>
      </div>

      <dl className="divide-y divide-border/50 border-y border-border/50">
        {[
          { label: f.refCode, value: result.id, mono: true },
          { label: f.station, value: result.stationName },
          { label: f.condition, value: result.categoryLabel },
          { label: f.time, value: result.submittedAt },
          {
            label: f.evidenceCount,
            value: result.evidence.length === 0 ? f.mediaNone : `${saved.length}/${result.evidence.length}`,
          },
        ].map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{row.label}</dt>
            <dd className={cn("text-sm", "mono" in row && row.mono && "[font-family:var(--font-data)]")}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {result.demo ? (
        <div className="inline-flex items-center gap-2 rounded-sm bg-watch-bg px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-watch">{f.tempRecord}</span>
        </div>
      ) : null}

      {result.evidence.length > 0 ? (
        <ul className="divide-y divide-border/50 border-y border-border/50" aria-label={f.evidenceCount}>
          {result.evidence.map((item, index) => (
            <li key={`${item.file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">{item.file.name} · {formatBytes(item.file.size)}</span>
              <span className={item.state === "uploaded" ? "text-healthy" : "text-critical"}>
                {item.state === "uploaded" ? f.mediaStateUploaded : f.mediaStateFailed}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!result.demo && failed.length === 0 && saved.length > 0 ? (
        <p role="status" className="text-sm text-muted">{fmt(f.mediaAllSaved, { n: saved.length })}</p>
      ) : null}

      {result.demo && result.demoSkipped.length > 0 ? (
        <Alert tone="warning">{fmt(f.mediaDemoSkipped, { files: result.demoSkipped.join(", ") })}</Alert>
      ) : null}

      {!result.demo && failed.length > 0 ? (
        <Alert tone="warning">
          <span role="alert">
            {fmt(f.mediaPartial, { failed: failed.length, files: failed.map((item) => item.file.name).join(", ") })}
          </span>
          {retryNote ? <span className="mt-2 block">{retryNote}</span> : null}
          {canRetry ? (
            <span className="mt-3 block">
              <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
                {retrying ? f.mediaRetrying : f.mediaRetry}
              </Button>
            </span>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onAnother}>{f.another}</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">{f.toObservatory}</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function ReportForm() {
  const dict = useDict();
  const f = dict.report.form;
  const searchParams = useSearchParams();
  const presetStation = resolveStationOption(searchParams.get("station"));

  const [stationId, setStationId] = useState<string | null>(presetStation?.id ?? null);
  const [locationChoice, setLocationChoice] = useState<string>(presetStation?.id ?? "");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "error">("idle");
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioPending, setAudioPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  // A ref, not state: two clicks inside one frame both see `submitting ===
  // false` in their closures, which is how one tap produced two reports.
  const submittingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const locationRequestRef = useRef(0);


  const station = useMemo(() => REPORT_STATION_OPTIONS.find((s) => s.id === stationId) ?? null, [stationId]);
  const reportMapStations = useMemo<MapStation[]>(() => REPORT_STATION_OPTIONS.flatMap((option) => {
    const point = STATION_COORDS[option.id as PilotStationId];
    return point ? [{ id: option.id, name: stationDeviceCode(option.id), lat: point.lat, lng: point.lng, freshness: "unavailable" }] : [];
  }), []);
  const selectMapStation = useCallback((id: string) => {
    if (!REPORT_STATION_OPTIONS.some((option) => option.id === id)) return;
    locationRequestRef.current += 1;
    setLocationChoice(id);
    setStationId(id);
    setGps(null);
  }, []);
  const trimmed = description.trim();
  const attachmentUrls = useMemo(
    () => attachments.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachments],
  );

  useEffect(() => () => attachmentUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [attachmentUrls]);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; if (recorderRef.current?.state === "recording") recorderRef.current.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); }; }, []);

  // Object URLs are not garbage-collected on their own — release the previous

  const locationValid = stationId !== null || gps !== null;
  const observationValid = category !== null && trimmed.length >= DESCRIPTION_MIN && trimmed.length <= DESCRIPTION_MAX;

  async function handleLocate() {
    const requestId = ++locationRequestRef.current;
    setGps(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("error");
      setGpsNote(f.errGeoUnsupported);
      return;
    }

    setGpsState("locating");
    setGpsNote(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 60000,
          enableHighAccuracy: true,
        });
      });
      if (!mountedRef.current || requestId !== locationRequestRef.current) return;
      setGps({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGpsState("idle");
    } catch {
      if (!mountedRef.current || requestId !== locationRequestRef.current) return;
      setGpsState("error");
      setGpsNote(f.errGeoFailed);
    }
  }

  function addAttachments(next: FileList | File[] | null) {
    if (!next) return;
    const files = Array.from(next);
    const problems: string[] = [];
    const accepted: File[] = [];
    const seen = new Set(attachments.map(mediaFingerprint));
    for (const file of files) {
      const check = checkReportMedia(file);
      if (check.reason === "unsupported_type") { problems.push(fmt(f.errMediaType, { name: file.name })); continue; }
      if (check.reason === "empty") { problems.push(fmt(f.errMediaEmpty, { name: file.name })); continue; }
      if (check.reason === "too_large") {
        problems.push(fmt(f.errMediaTooLarge, { name: file.name, size: formatBytes(file.size), max: formatBytes(check.maxBytes ?? 0) }));
        continue;
      }
      const key = mediaFingerprint(file);
      if (seen.has(key)) { problems.push(fmt(f.errMediaDuplicate, { name: file.name })); continue; }
      seen.add(key);
      accepted.push(file);
    }
    if (attachments.length + accepted.length > REPORT_MEDIA_MAX_FILES) {
      problems.push(f.errMediaCapacity);
      accepted.splice(Math.max(0, REPORT_MEDIA_MAX_FILES - attachments.length));
    }
    setMediaError(problems.length > 0 ? problems.join(" ") : null);
    if (accepted.length > 0) setAttachments((current) => [...current, ...accepted]);
  }

  async function toggleAudioRecording() {
    if (audioPending) return;
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(f.errAudioFailed);
      return;
    }
    if (attachments.length >= REPORT_MEDIA_MAX_FILES) { setMediaError(f.errMediaCapacity); return; }
    setAudioPending(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const supportedType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!supportedType) { stream.getTracks().forEach((track) => track.stop()); setMediaError(f.errAudioFailed); return; }
      const recorder = new MediaRecorder(stream, { mimeType: supportedType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!mountedRef.current) return;
        const mime = (recorder.mimeType || "audio/webm").split(";")[0];
        const file = new File(chunks, `field-note.${mime === "audio/mp4" ? "m4a" : mime === "audio/ogg" ? "ogg" : "webm"}`, { type: mime });
        addAttachments([file]);
        recorderRef.current = null;
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMediaError(f.errAudioFailed);
    } finally {
      if (mountedRef.current) setAudioPending(false);
    }
  }

  async function handleSubmit() {
    if (submittingRef.current || submitting || recording || audioPending || !category || !observationValid || (!station && !gps)) return;
    submittingRef.current = true;

    setSubmitting(true);
    setUploadProgress(null);
    setProgressLabel(f.creatingReport);
    setError(null);

    try {
      // Step 1 — the report itself, as a small JSON request. Evidence is
      // DECLARED here (name, type, size) so the server can validate it and
      // sign upload URLs, but the bytes do not travel through this request:
      // the hosting platform rejects function bodies over 4.5 MB, which is
      // smaller than most phone videos.
      const media = attachments.map((file) => {
        const check = checkReportMedia(file);
        return { name: file.name, type: check.mimeType ?? file.type, size: file.size };
      });
      const endpoint = new URL("/api/public/reports", window.location.origin);
      if (new URLSearchParams(window.location.search).get("mode") === "demo") {
        endpoint.searchParams.set("mode", "demo");
      }
      const { status, payload } = await postJson(endpoint.toString(), {
        category,
        description: trimmed,
        ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
        ...(station ? { stationId: station.id } : {}),
        media,
      });

      if (status < 200 || status >= 300 || payload.ok !== true || typeof payload.id !== "string") {
        setError(errorMessageFor(status, typeof payload.error === "string" ? payload.error : undefined, dict));
        return;
      }

      const reportId = payload.id;
      const demo = payload.demo === true;
      const ticket = typeof payload.uploadTicket === "string" ? payload.uploadTicket : null;
      const signed = Array.isArray(payload.uploads)
        ? (payload.uploads as { index?: unknown; path?: unknown; token?: unknown; signedUrl?: unknown; mimeType?: unknown }[])
        : [];

      // Step 2 — each file straight to Storage, then server confirmation.
      const evidence: EvidenceItem[] = attachments.map((file, index) => {
        const upload = signed.find((entry) => entry.index === index);
        return {
          file,
          mimeType: typeof upload?.mimeType === "string" ? upload.mimeType : file.type,
          path: typeof upload?.path === "string" ? upload.path : null,
          state: "failed",
        };
      });

      if (!demo && ticket) {
        const items = signed.flatMap((entry) => {
          const file = typeof entry.index === "number" ? attachments[entry.index] : undefined;
          if (!file || typeof entry.path !== "string" || typeof entry.token !== "string" || typeof entry.signedUrl !== "string") return [];
          return [{ file, mimeType: typeof entry.mimeType === "string" ? entry.mimeType : file.type, upload: { path: entry.path, token: entry.token, signedUrl: entry.signedUrl } }];
        });
        setUploadProgress(0);
        const { confirmed } = await uploadEvidence(reportId, ticket, items, (label, pct) => {
          if (!mountedRef.current) return;
          setProgressLabel(label);
          setUploadProgress(pct);
        }, dict);
        for (const item of evidence) if (item.path && confirmed.has(item.path)) item.state = "uploaded";
      }

      setResult({
        id: reportId,
        demo,
        evidence: demo ? [] : evidence,
        ticket,
        demoSkipped: demo ? attachments.map((file) => file.name) : [],
        stationName: station ? stationText(station.id, dict).name : f.gpsDevice,
        categoryLabel: categoryLabel(category, dict),
        submittedAt: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      });
    } catch {
      setError(f.errSendFailed);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setUploadProgress(null);
      setProgressLabel(null);
    }
  }

  /** Retries only the files that did not arrive, into the SAME report. */
  async function retryEvidence() {
    if (!result || !result.ticket || retrying) return;
    const pending = result.evidence.filter((item) => item.state === "failed" && item.path);
    if (pending.length === 0) return;
    setRetrying(true);
    setRetryNote(null);
    try {
      const { status, payload } = await postJson(`/api/public/reports/${encodeURIComponent(result.id)}/media`, {
        ticket: result.ticket,
        action: "resign",
        paths: pending.map((item) => item.path),
      });
      if (status < 200 || status >= 300 || payload.ok !== true) {
        setRetryNote(f.mediaRetryExpired);
        return;
      }
      const already = new Set(Array.isArray(payload.alreadyRecorded) ? (payload.alreadyRecorded as string[]) : []);
      const fresh = Array.isArray(payload.uploads) ? (payload.uploads as SignedUpload[]) : [];
      const items = pending.flatMap((item) => {
        const upload = fresh.find((entry) => entry.path === item.path);
        return upload ? [{ file: item.file, mimeType: item.mimeType, upload }] : [];
      });
      const { confirmed } = items.length
        ? await uploadEvidence(result.id, result.ticket, items, () => undefined, dict)
        : { confirmed: new Set<string>() };
      setResult({
        ...result,
        evidence: result.evidence.map((item) =>
          item.path && (confirmed.has(item.path) || already.has(item.path)) ? { ...item, state: "uploaded" } : item,
        ),
      });
    } catch {
      setRetryNote(f.errSendFailed);
    } finally {
      setRetrying(false);
    }
  }

  function resetForm() {
    setResult(null);
    setStationId(presetStation?.id ?? null);
    setLocationChoice(presetStation?.id ?? "");
    setCategory(null);
    setDescription("");
    setGps(null);
    setGpsState("idle");
    setGpsNote(null);
    setError(null);
    setAttachments([]);
    setMediaError(null);
    setRetryNote(null);
  }

  if (result) {
    return <SuccessView result={result} onAnother={resetForm} onRetry={retryEvidence} retrying={retrying} retryNote={retryNote} />;
  }

  return (
    <div className="report-notebook report-single">
      <div className="min-w-0">
        <div className="space-y-8">
          {/* 01 — Location */}
          {(
            <div id="report-location" className="report-entry-section space-y-8">
              {/* THE THREE NODES, AS THREE CHOICES.
                  This was a stack of thin left-bordered rows — the visual
                  weight of a settings list, for what is the single most
                  important decision on the page. A reporter standing in a
                  field on a phone is choosing between three physical places
                  they can see, so the control should look like three places,
                  not three form rows. Role name leads; the STATION_0n
                  identifier is kept but demoted to a footer, since it is what
                  the system calls the node, not what a person calls it. */}
              <h2 className="report-section-title"><span>{f.station}</span><span className="report-section-state">{locationValid ? <Check aria-hidden /> : <Crosshair aria-hidden />}</span></h2>
              <div className="report-location-layout">
              <div className="report-location-map">
                <StationNetworkMap stations={reportMapStations} variant="observatory" selectedStationId={stationId ?? undefined} onStationSelect={selectMapStation} />
                <p>{f.legendStation}</p>
              </div>
              <fieldset className="report-station-list">
                <legend className="sr-only">{f.legendStation}</legend>
                {REPORT_STATION_OPTIONS.map((option) => {
                  const Icon = KIND_ICON[option.kind];
                  const text = stationText(option.id, dict);
                  const active = locationChoice === option.id;
                  return (
                    <label key={option.id} className="report-station-choice">
                      <input type="radio" name="station" value={option.id} checked={active} onChange={() => selectMapStation(option.id)} className="sr-only" />
                      <Icon aria-hidden />
                      <span><strong>{text.name}</strong><small>{text.location}</small><code>{stationDeviceCode(option.id)}</code></span>
                      <span className="station-choice-check">{active ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}</span>
                    </label>
                  );
                })}
                <label className="report-station-choice">
                  <input type="radio" name="station" value="gps" checked={locationChoice === "gps"} onChange={() => { setLocationChoice("gps"); setStationId(null); void handleLocate(); }} className="sr-only" />
                  <Crosshair aria-hidden />
                  <span><strong>{f.myLocation}</strong><small>{gps ? f.locationReady : f.myLocationLead}</small><code>GPS</code></span>
                  <span className="station-choice-check">{locationChoice === "gps" ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}</span>
                </label>
              </fieldset>
              </div>

              {locationChoice === "gps" ? (
                <p className="text-xs leading-relaxed text-foreground-subtle">
                  {gps ? `${f.locationReady}: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : gpsNote ?? f.locating}
                </p>
              ) : null}
            </div>
           )}

          {/* 02 — Observation */}
          {(
            <><section id="report-observation" className="report-entry-section space-y-8"><h2 className="report-section-title"><span><KeywordTitle text={f.conditionType} keyword={f.conditionType} /></span></h2>
              <fieldset>
                <legend className="sr-only">{f.conditionType}</legend>
                {/* Selectable tiles, not a radio list. Same reasoning as the
                    node cards in step 1: this is a choice between six
                    concrete field conditions, and a divided list of faint
                    rows with a small ring on the right made the selected one
                    hard to see at a glance — especially outdoors, which is
                    where this form is actually filled in. */}
                <div className="report-observation-choices grid gap-2.5 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((item) => {
                    const active = category === item.value;
                    return (
                      <label
                        key={item.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border bg-surface px-4 py-3.5 transition-all duration-[var(--motion-base)]",
                          "focus-within:ring-2 focus-within:ring-accent",
                          active
                            ? "border-accent bg-[var(--h-selection-surface)] shadow-[inset_0_0_0_1px_var(--color-accent)]"
                            : "border-border hover:border-foreground-subtle hover:bg-wash-hover",
                        )}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={item.value}
                          checked={active}
                          onChange={() => setCategory(item.value)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--motion-base)]",
                            active ? "border-accent bg-accent" : "border-border-strong",
                          )}
                          aria-hidden
                        >
                          {active ? <Check className="h-3 w-3 text-background" /> : null}
                        </span>
                        <span className={cn("text-base leading-snug", active ? "font-semibold text-accent" : "text-foreground")}>
                          {dict.reportCategories[item.value]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>
              <section className="report-description-section space-y-2">
                <label
                  htmlFor="description"
                  className="report-description-title"
                >
                  {f.description}
                                </label>
                <Textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  placeholder={f.descPlaceholder}
                  className="min-h-[160px] rounded-lg bg-background text-base"
                  aria-describedby="description-hint"
                />
                <p id="description-hint" className="text-xs text-muted">
                  {trimmed.length < DESCRIPTION_MIN
                    ? fmt(f.charsNeeded, { min: DESCRIPTION_MIN, n: trimmed.length })
                    : fmt(f.charsOf, { n: trimmed.length, max: DESCRIPTION_MAX })}
                </p>
              </section></>
           )}

          {/* 03 — Review */}
          {(
            <div className="space-y-8">
              <section className="report-evidence-section report-entry-section space-y-6" aria-labelledby="report-evidence-title">
                <h2 id="report-evidence-title" className="report-section-title"><span><KeywordTitle text={f.evidence} /></span></h2>
                <div className="report-evidence report-evidence-panel space-y-4">
                <div>
                  
                  <p className="text-sm">{f.evidenceLead}</p>
                  <p className="mt-1 text-xs text-muted">{f.evidenceLimit}</p>
                </div>
                <div className="report-evidence-actions">
                  <div className="evidence-choice"><Camera aria-hidden /><label>{f.addPhoto}<input className="sr-only" type="file" multiple accept={REPORT_MEDIA_ACCEPT_BY_KIND.photo} disabled={recording || audioPending || submitting} onChange={(e) => { addAttachments(e.target.files); e.target.value = ""; }} /></label></div>
                  <div className="evidence-choice"><Video aria-hidden /><label>{f.addVideo}<input className="sr-only" type="file" accept={REPORT_MEDIA_ACCEPT_BY_KIND.video} disabled={recording || audioPending || submitting} onChange={(e) => { addAttachments(e.target.files); e.target.value = ""; }} /></label></div>
                  <div className="evidence-choice"><Mic aria-hidden /><label>{f.addAudio}<input className="sr-only" type="file" accept={REPORT_MEDIA_ACCEPT_BY_KIND.audio} disabled={recording || audioPending || submitting} onChange={(e) => { addAttachments(e.target.files); e.target.value = ""; }} /></label><Button type="button" variant="outline" onClick={toggleAudioRecording} disabled={submitting || audioPending} aria-pressed={recording}>{recording ? f.stopAudio : f.recordAudio}</Button></div>
                </div>
                {recording ? <p role="status" className="text-sm text-critical">{f.recordingNow}</p> : null}
                {mediaError ? <p role="alert" className="text-sm text-critical">{mediaError}</p> : null}
                {attachmentUrls.length > 0 ? <ul className="evidence-previews">{attachmentUrls.map(({ file, url }, index) => <li key={`${file.name}-${index}`} className="overflow-hidden rounded-md border border-border p-2"><div className="aspect-video bg-wash-sunken">{(checkReportMedia(file).mimeType ?? file.type).startsWith("image/") ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview is a blob URL, not an optimisable remote image */}
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                </> : (checkReportMedia(file).mimeType ?? file.type).startsWith("video/") ? <video src={url} controls playsInline preload="metadata" className="h-full w-full" /> : <audio src={url} controls className="w-full pt-6" />}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs">{file.name} · {formatBytes(file.size)}</span><button type="button" onClick={() => { setAttachments((all) => all.filter((_, itemIndex) => itemIndex !== index)); setMediaError(null); }} className="evidence-remove text-critical" aria-label={fmt(f.removeEvidenceNamed, { name: file.name })} disabled={recording || audioPending || submitting}><Trash2 className="h-4 w-4" aria-hidden /></button></div></li>)}</ul> : null}
                </div>
              </section>
              <p className="text-sm leading-relaxed text-muted">
                {f.fieldNote}
                            </p>

              {error ? <Alert tone="critical">{error}</Alert> : null}
            </div>
          )}

          {submitting ? <div className="upload-status" role="status" aria-live="polite"><span>{progressLabel ?? f.sending}</span><progress value={uploadProgress ?? undefined} max={100} aria-label={f.sending} />{attachments.length > 0 ? <span className="text-xs text-muted">{f.mediaKeepPage}</span> : null}</div> : null}
          {/* Navigation */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-6">
            <Button type="button" onClick={handleSubmit} disabled={submitting || recording || audioPending || !locationValid || !observationValid} className="min-w-[160px]">
              {submitting ? f.sending : f.submit}
              {submitting ? null : <Send className="h-4 w-4" aria-hidden />}
            </Button>
            {!locationValid || !observationValid ? <p className="text-xs text-muted">{!locationValid ? f.needStation : f.needCondition}</p> : null}

          </div>
        </div>
      </div>
    </div>
  );
}
