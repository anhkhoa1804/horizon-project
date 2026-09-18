"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Crosshair,
  Mic,
  Pencil,
  Send,
  Sprout,
  Trash2,
  Video,
  Waves,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  REPORT_CATEGORIES,
  categoryLabel,
} from "@/lib/reports/reportCategories";
import { REPORT_MEDIA_MAX_FILES, validateReportMedia } from "@/lib/reports/media";
import { REPORT_STATION_OPTIONS, resolveStationOption } from "@/lib/reports/reportStations";
import { stationText } from "@/lib/stationProfile";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/vi";
import type { StationKind } from "@/lib/stationProfile";

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };

/**
 * Evidence now belongs in the final review step because the server persists
 * each accepted attachment to private Storage alongside report_media metadata.
 */
const STEPS = [
  { id: 1, key: "step1" },
  { id: 2, key: "step2" },
  { id: 3, key: "step4" },
] as const satisfies readonly { id: number; key: keyof Dictionary["report"] }[];

type StepId = (typeof STEPS)[number]["id"];

interface SubmitResult {
  id: string;
  demo: boolean;
  stationName: string;
  categoryLabel: string;
  submittedAt: string;
}

function errorMessageFor(status: number, code: string | undefined, dict: Dictionary): string {
  const f = dict.report.form;
  if (status === 429) return f.errRateLimit;
  if (code === "description_too_short") return fmt(f.errTooShort, { min: DESCRIPTION_MIN });
  if (code === "description_too_long") return fmt(f.errTooLong, { max: DESCRIPTION_MAX });
  if (code === "invalid_category") return f.errInvalidKind;
  return f.errSendFailed;
}

// ---------------------------------------------------------------------------
// Progress rail — the record strip
// ---------------------------------------------------------------------------

function StepRail({
  current,
  furthest,
  onJump,
  record,
}: {
  current: StepId;
  furthest: StepId;
  onJump: (step: StepId) => void;
  record: { label: string; value: string | null }[];
}) {
  const dict = useDict();
  return (
    <aside className="space-y-8">
      <ol className="flex gap-2 lg:flex-col lg:gap-0" aria-label={dict.report.progressLabel}>
        {STEPS.map((step) => {
          const active = step.id === current;
          const done = step.id < furthest || (step.id < current && step.id <= furthest);
          const reachable = step.id <= furthest;
          return (
            <li key={step.id} className="flex-1 lg:flex-none">
              <button
                type="button"
                onClick={() => reachable && onJump(step.id)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group w-full text-left transition-colors duration-[var(--motion-base)]",
                  "lg:flex lg:items-baseline lg:gap-3 lg:border-l-2 lg:py-2.5 lg:pl-4",
                  active ? "lg:border-accent" : "lg:border-border/60",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "block h-0.5 w-full rounded-full transition-colors duration-[var(--motion-base)] lg:hidden",
                    active ? "bg-accent" : done ? "bg-accent/40" : "bg-border",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "mt-2 block text-[10px] font-medium uppercase tracking-[0.16em] lg:mt-0 lg:text-[11px]",
                    active ? "text-accent" : reachable ? "text-muted" : "text-muted/50",
                  )}
                >
                  {String(step.id).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "hidden text-sm lg:block",
                    active ? "font-semibold text-foreground" : reachable ? "text-muted" : "text-muted/50",
                  )}
                >
                  {dict.report[step.key]}
                </span>
                {done ? <Check className="hidden h-3.5 w-3.5 shrink-0 text-accent lg:block" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {/* The accumulating field record — desktop only; on mobile the review
          step itself covers this and a duplicate would just cost scroll. */}
      <div className="hidden space-y-4 border-t border-border/60 pt-6 lg:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{dict.report.record}</p>
        <dl className="space-y-3">
          {record.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{item.label}</dt>
              <dd className={cn("text-sm leading-snug", item.value ? "text-foreground" : "text-muted/60")}>
                {item.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

function SuccessView({ result, onAnother }: { result: SubmitResult; onAnother: () => void }) {
  const dict = useDict();
  const f = dict.report.form;
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

  const [step, setStep] = useState<StepId>(presetStation ? 2 : 1);
  const [furthest, setFurthest] = useState<StepId>(presetStation ? 2 : 1);
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
  const recorderRef = useRef<MediaRecorder | null>(null);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const stepChangedRef = useRef(false);

  const station = useMemo(() => REPORT_STATION_OPTIONS.find((s) => s.id === stationId) ?? null, [stationId]);
  const trimmed = description.trim();
  const attachmentUrls = useMemo(
    () => attachments.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachments],
  );

  useEffect(() => () => attachmentUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [attachmentUrls]);

  // Object URLs are not garbage-collected on their own — release the previous

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land on the task rather than staying on the (now unmounted) Next button.
  useEffect(() => {
    if (!stepChangedRef.current) return;
    stepChangedRef.current = false;
    headingRef.current?.focus();
  }, [step]);

  const goto = useCallback((next: StepId) => {
    stepChangedRef.current = true;
    setStep(next);
    setFurthest((prev) => (next > prev ? next : prev));
  }, []);

  const stepValid: Record<StepId, boolean> = {
    1: stationId !== null || gps !== null,
    2: category !== null && trimmed.length >= DESCRIPTION_MIN && trimmed.length <= DESCRIPTION_MAX,
    3: true,
  };

  async function handleLocate() {
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
      setGps({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGpsState("idle");
    } catch {
      setGpsState("error");
      setGpsNote(f.errGeoFailed);
    }
  }

  function addAttachments(next: FileList | null) {
    if (!next) return;
    setAttachments((current) => {
      const accepted = Array.from(next).filter((file) => validateReportMedia(file));
      return [...current, ...accepted].slice(0, REPORT_MEDIA_MAX_FILES);
    });
  }

  async function toggleAudioRecording() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(f.errAudioFailed);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const file = new File([new Blob(chunks, { type: recorder.mimeType || "audio/webm" })], "field-note.webm", {
          type: recorder.mimeType || "audio/webm",
        });
        addAttachments({ 0: file, length: 1, item: () => file } as unknown as FileList);
        recorderRef.current = null;
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(f.errAudioFailed);
    }
  }

  async function handleSubmit() {
    if (submitting || !category || (!station && !gps)) return;

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("category", category);
      form.set("description", trimmed);
      if (gps) {
        form.set("lat", String(gps.lat));
        form.set("lng", String(gps.lng));
      }
      if (station) form.set("stationId", station.id);
      attachments.forEach((file) => form.append("media", file));
      const res = await fetch("/api/public/reports", {
        method: "POST",
        body: form,
      });

      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; demo?: boolean; error?: string };

      if (!res.ok || payload.ok !== true) {
        setError(errorMessageFor(res.status, payload.error, dict));
        return;
      }

      setResult({
        id: payload.id ?? "—",
        demo: payload.demo === true,
        stationName: station ? stationText(station.id, dict).name : f.gpsDevice,
        categoryLabel: categoryLabel(category, dict),
        submittedAt: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      });
    } catch {
      setError(f.errSendFailed);
    } finally {
      setSubmitting(false);
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
    stepChangedRef.current = true;
    setStep(presetStation ? 2 : 1);
    setFurthest(presetStation ? 2 : 1);
  }

  if (result) {
    return <SuccessView result={result} onAnother={resetForm} />;
  }

  const locationSummary = gps
    ? `${f.gpsDevice} · ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
    : station
      ? f.byStation
      : null;

  const record = [
    { label: f.station, value: station?.name ?? (gps ? f.gpsDevice : null) },
    { label: f.condition, value: category ? categoryLabel(category, dict) : null },
    { label: f.location, value: locationSummary },
    { label: f.description, value: trimmed ? fmt(f.charCount, { n: trimmed.length }) : null },
  ];

  const currentStep = STEPS.find((s) => s.id === step)!;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.26fr)_minmax(0,0.74fr)] lg:gap-16">
      <StepRail current={step} furthest={furthest} onJump={goto} record={record} />

      {/* Capped to a reading measure rather than filling the column: these are
          field controls, and a 900px-wide row strands the station id far from
          its name. The asymmetry (narrow rail + this block sitting left of
          centre) is what uses the wide viewport deliberately — stretching the
          inputs themselves would not. */}
      <div className="min-w-0 max-w-3xl">
        <div key={step} className="animate-entrance space-y-8">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
              {String(currentStep.id).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")} ·{" "}
              {dict.report[currentStep.key]}
            </p>
            {/*
              Programmatically focused on every step change so assistive tech
              lands on the new task instead of the unmounted Next button. The
              visible ring is suppressed here specifically: globals.css's
              `:focus-visible` rule would otherwise draw a box around a
              non-interactive heading, which reads as a text input. `[&:focus]`
              is used rather than `outline-none` because it compiles to
              `.cls:focus` (specificity 0,2,0) and so actually beats the global
              `:focus-visible` (0,1,0) — a plain utility ties and loses on
              source order. Every real control (radios, textarea, file input,
              buttons) keeps its focus ring.
            */}
            <h2 ref={headingRef} tabIndex={-1} className="text-h1 font-semibold tracking-tight [&:focus]:outline-none">
              {step === 1 ? f.q1 : null}
              {step === 2 ? f.q2 : null}
              {/* q3 was the evidence question; step 3 is now the review. */}
              {step === 3 ? f.q4 : null}
            </h2>
          </div>

          {/* 01 — Location */}
          {step === 1 ? (
            <div className="space-y-8">
              {/* THE THREE NODES, AS THREE CHOICES.
                  This was a stack of thin left-bordered rows — the visual
                  weight of a settings list, for what is the single most
                  important decision on the page. A reporter standing in a
                  field on a phone is choosing between three physical places
                  they can see, so the control should look like three places,
                  not three form rows. Role name leads; the STATION_0n
                  identifier is kept but demoted to a footer, since it is what
                  the system calls the node, not what a person calls it. */}
              <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <legend className="sr-only">{f.legendStation}</legend>
                {REPORT_STATION_OPTIONS.map((option) => {
                  const Icon = KIND_ICON[option.kind];
                  const text = stationText(option.id, dict);
                  const active = locationChoice === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "relative flex cursor-pointer flex-col gap-3 rounded-lg border p-5 transition-all duration-[var(--motion-base)]",
                        "focus-within:ring-2 focus-within:ring-accent",
                        active
                          ? "border-accent bg-accent/[0.07] shadow-[inset_0_0_0_1px_var(--color-accent)]"
                          : "border-border hover:border-foreground-subtle hover:bg-wash-hover",
                      )}
                    >
                      <input
                        type="radio"
                        name="station"
                        value={option.id}
                        checked={active}
                        onChange={() => { setLocationChoice(option.id); setStationId(option.id); }}
                        className="sr-only"
                      />
                      <span className="flex items-center justify-between gap-2">
                        <Icon
                          className={cn("h-6 w-6 shrink-0", active ? "text-accent" : "text-foreground-subtle")}
                          aria-hidden
                        />
                        {active ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : null}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-lg font-semibold tracking-tight",
                            active ? "text-accent" : "text-foreground",
                          )}
                        >
                          {text.name}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-muted">{text.location}</span>
                      </span>
                      <span className="mt-auto text-[10px] uppercase tracking-[0.12em] text-foreground-subtle [font-family:var(--font-data)]">
                        {option.id}
                      </span>
                    </label>
                  );
                })}
                <label
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-3 rounded-lg border p-5 transition-all duration-[var(--motion-base)]",
                    "focus-within:ring-2 focus-within:ring-accent",
                    locationChoice === "gps"
                      ? "border-accent bg-accent/[0.07] shadow-[inset_0_0_0_1px_var(--color-accent)]"
                      : "border-border hover:border-foreground-subtle hover:bg-wash-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="station"
                    value="gps"
                    checked={locationChoice === "gps"}
                    onChange={() => { setLocationChoice("gps"); setStationId(null); void handleLocate(); }}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2"><Crosshair className="h-6 w-6 text-accent" aria-hidden />{gps ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}</span>
                  <span className="min-w-0"><span className="block text-lg font-semibold tracking-tight">{f.myLocation}</span><span className="mt-0.5 block text-sm leading-snug text-muted">{gps ? f.locationReady : f.myLocationLead}</span></span>
                  <span className="mt-auto text-[10px] uppercase tracking-[0.12em] text-foreground-subtle [font-family:var(--font-data)]">GPS</span>
                </label>
              </fieldset>

              {/* GPS refinement belongs TO the station choice, not beside it.
                  It used to sit under its own "Vị trí chính xác hơn" heading
                  behind a horizontal rule, which read as a second, unrelated
                  location question — a reader who had just picked a station
                  was asked to pick a location again. It is now the last row
                  of the same fieldset: one question ("where?"), answered
                  coarsely by the station and optionally refined by GPS. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLocate}
                  disabled={gpsState === "locating"}
                  className="gap-2 text-foreground-muted"
                >
                  <Crosshair className={cn("h-4 w-4", gpsState === "locating" && "animate-pulse")} aria-hidden />
                  {gpsState === "locating" ? f.locating : gps ? f.updateLocation : f.useCurrentLocation}
                </Button>
                {gps ? (
                  <p className="text-sm text-muted [font-family:var(--font-data)]">
                    {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                  </p>
                ) : (
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground-subtle">
                    {gpsNote ?? f.optionalGps}
                  </p>
                )}
              </div>
              {gps ? (
                <p className="text-xs leading-relaxed text-foreground-subtle">{f.willUseGps}</p>
              ) : null}
            </div>
          ) : null}

          {/* 02 — Observation */}
          {step === 2 ? (
            <div className="space-y-8">
              <fieldset>
                <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  {f.conditionType}
                                </legend>
                {/* Selectable tiles, not a radio list. Same reasoning as the
                    node cards in step 1: this is a choice between six
                    concrete field conditions, and a divided list of faint
                    rows with a small ring on the right made the selected one
                    hard to see at a glance — especially outdoors, which is
                    where this form is actually filled in. */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((item) => {
                    const active = category === item.value;
                    return (
                      <label
                        key={item.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3.5 transition-all duration-[var(--motion-base)]",
                          "focus-within:ring-2 focus-within:ring-accent",
                          active
                            ? "border-accent bg-accent/[0.07] shadow-[inset_0_0_0_1px_var(--color-accent)]"
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

              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="block text-[11px] font-medium uppercase tracking-[0.16em] text-muted"
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
              </div>
            </div>
          ) : null}

          {/* 03 — Review */}
          {step === 3 ? (
            <div className="space-y-8">
              <section className="space-y-4 rounded-lg border border-border bg-surface p-5" aria-labelledby="report-evidence-title">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{f.evidence}</p>
                  <h3 id="report-evidence-title" className="mt-1 text-lg font-semibold">{f.evidenceLead}</h3>
                  <p className="mt-1 text-xs text-muted">{f.evidenceLimit}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm hover:bg-wash-hover"><Camera className="h-4 w-4 text-accent" aria-hidden />{f.addPhoto}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(e) => addAttachments(e.target.files)} /></label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm hover:bg-wash-hover"><Video className="h-4 w-4 text-accent" aria-hidden />{f.addVideo}<input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" onChange={(e) => addAttachments(e.target.files)} /></label>
                  <div className="flex gap-2"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm hover:bg-wash-hover"><Mic className="h-4 w-4 text-accent" aria-hidden />{f.addAudio}<input className="sr-only" type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg" onChange={(e) => addAttachments(e.target.files)} /></label><Button type="button" variant="outline" size="sm" onClick={toggleAudioRecording}>{recording ? f.stopAudio : f.recordAudio}</Button></div>
                </div>
                {attachmentUrls.length > 0 ? <ul className="grid gap-3 sm:grid-cols-3">{attachmentUrls.map(({ file, url }, index) => <li key={`${file.name}-${index}`} className="overflow-hidden rounded-md border border-border p-2"><div className="aspect-video bg-wash-sunken">{file.type.startsWith("image/") ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview is a blob URL, not an optimisable remote image */}
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                </> : file.type.startsWith("video/") ? <video src={url} controls className="h-full w-full" /> : <audio src={url} controls className="w-full pt-6" />}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs">{file.name}</span><button type="button" onClick={() => setAttachments((all) => all.filter((_, itemIndex) => itemIndex !== index))} className="text-critical"><Trash2 className="h-4 w-4" aria-label={f.removeEvidence} /></button></div></li>)}</ul> : null}
              </section>
              <dl className="divide-y divide-border/50 border-y border-border/50">
                {[
                  { label: f.station, value: station ? `${stationText(station.id, dict).name} · ${stationText(station.id, dict).location}` : "—", jump: 1 as StepId },
                  { label: f.condition, value: category ? categoryLabel(category, dict) : "—", jump: 2 as StepId },
                  { label: f.location, value: locationSummary ?? "—", jump: 1 as StepId },
                  { label: f.description, value: trimmed || "—", jump: 2 as StepId },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 space-y-1">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{row.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.value}</dd>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => goto(row.jump)}
                      className="shrink-0 text-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">{f.edit} </span>
                      {f.edit}
                                        </Button>
                  </div>
                ))}
              </dl>

              <p className="text-sm leading-relaxed text-muted">
                {f.fieldNote}
                            </p>

              {error ? <Alert tone="critical">{error}</Alert> : null}
            </div>
          ) : null}

          {/* Navigation */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-6">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => goto((step - 1) as StepId)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {dict.common.back}
                            </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                onClick={() => goto((step + 1) as StepId)}
                disabled={!stepValid[step]}
                className="min-w-[140px]"
              >
                {dict.common.continue}
                              <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting || !stepValid[1]} className="min-w-[160px]">
                {submitting ? f.sending : f.submit}
                {submitting ? null : <Send className="h-4 w-4" aria-hidden />}
              </Button>
            )}

            {step < 4 && !stepValid[step] ? (
              <p className="text-xs text-muted">
                {step === 1 ? f.needStation : f.needCondition}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
