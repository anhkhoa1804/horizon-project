export const REPORT_MEDIA_BUCKET = "report-evidence";
export const REPORT_MEDIA_MAX_FILES = 3;

const MIME_RULES = {
  "image/jpeg": { type: "photo", maxBytes: 8 * 1024 * 1024, extension: "jpg" },
  "image/png": { type: "photo", maxBytes: 8 * 1024 * 1024, extension: "png" },
  "image/webp": { type: "photo", maxBytes: 8 * 1024 * 1024, extension: "webp" },
  "image/heic": { type: "photo", maxBytes: 8 * 1024 * 1024, extension: "heic" },
  "video/mp4": { type: "video", maxBytes: 20 * 1024 * 1024, extension: "mp4" },
  "video/webm": { type: "video", maxBytes: 20 * 1024 * 1024, extension: "webm" },
  "video/quicktime": { type: "video", maxBytes: 20 * 1024 * 1024, extension: "mov" },
  "audio/mpeg": { type: "audio", maxBytes: 10 * 1024 * 1024, extension: "mp3" },
  "audio/mp4": { type: "audio", maxBytes: 10 * 1024 * 1024, extension: "m4a" },
  "audio/wav": { type: "audio", maxBytes: 10 * 1024 * 1024, extension: "wav" },
  "audio/webm": { type: "audio", maxBytes: 10 * 1024 * 1024, extension: "webm" },
  "audio/ogg": { type: "audio", maxBytes: 10 * 1024 * 1024, extension: "ogg" },
} as const;

export type ReportMediaMime = keyof typeof MIME_RULES;
export type ReportMediaType = "photo" | "video" | "audio";

/**
 * Browsers do not report a MIME type consistently. Chrome and Edge on Windows
 * commonly hand back an empty `File.type` for `.heic` and sometimes for `.mov`;
 * some Android pickers report `application/octet-stream`; Safari reports
 * `video/quicktime` for iPhone clips. Rejecting every empty type turned valid
 * phone evidence into "unsupported file" before an upload was even attempted.
 *
 * The extension is consulted ONLY when the browser gave no usable type. A file
 * that declares a concrete, unsupported type (application/pdf, video/3gpp) is
 * still rejected — the extension never overrides an explicit declaration.
 * The storage bucket repeats this allowlist (migration 026), so the
 * normalised type must also be one Storage accepts.
 */
const EXTENSION_MIME: Record<string, ReportMediaMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
};

/** Aliases browsers use for an allowed type. */
const MIME_ALIASES: Record<string, ReportMediaMime> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/heif": "image/heic",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
};

const GENERIC_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function mediaRule(mimeType: string) {
  return MIME_RULES[mimeType as keyof typeof MIME_RULES] ?? null;
}

/** The descriptor shape both a browser `File` and a JSON upload manifest share. */
export interface MediaDescriptor {
  name?: string;
  type?: string;
  size: number;
}

/**
 * The canonical MIME type for a file, or null when it is not an accepted
 * evidence format. Codec parameters (`audio/webm;codecs=opus`) are dropped.
 */
export function resolveMediaMime(file: Pick<MediaDescriptor, "name" | "type">): ReportMediaMime | null {
  const declared = (file.type ?? "").toLowerCase().split(";")[0].trim();
  if (mediaRule(declared)) return declared as ReportMediaMime;
  if (MIME_ALIASES[declared]) return MIME_ALIASES[declared];
  if (!GENERIC_TYPES.has(declared)) return null;
  const extension = (file.name ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension ? EXTENSION_MIME[extension] ?? null : null;
}

export type MediaRejection = "unsupported_type" | "empty" | "too_large";

export interface MediaCheck {
  ok: boolean;
  mimeType: ReportMediaMime | null;
  type: ReportMediaType | null;
  extension: string | null;
  maxBytes: number | null;
  reason: MediaRejection | null;
}

/** Full verdict, with the reason, so the form can say WHY a file was refused. */
export function checkReportMedia(file: MediaDescriptor): MediaCheck {
  const mimeType = resolveMediaMime(file);
  const rule = mimeType ? MIME_RULES[mimeType] : null;
  if (!mimeType || !rule) {
    return { ok: false, mimeType: null, type: null, extension: null, maxBytes: null, reason: "unsupported_type" };
  }
  const base = { mimeType, type: rule.type, extension: rule.extension, maxBytes: rule.maxBytes };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, ...base, reason: "empty" };
  if (file.size > rule.maxBytes) return { ok: false, ...base, reason: "too_large" };
  return { ok: true, ...base, reason: null };
}

export function validateReportMedia(file: MediaDescriptor): { type: ReportMediaType; extension: string; mimeType: ReportMediaMime } | null {
  const check = checkReportMedia(file);
  if (!check.ok || !check.type || !check.extension || !check.mimeType) return null;
  return { type: check.type, extension: check.extension, mimeType: check.mimeType };
}

/** A stable identity for "the same file picked twice". */
export function mediaFingerprint(file: { name: string; size: number; lastModified?: number }): string {
  return `${file.name}::${file.size}::${file.lastModified ?? 0}`;
}

export const REPORT_MEDIA_ACCEPT = Object.keys(MIME_RULES).join(",");

/** `accept` lists include extensions so pickers that do not map MIME types still offer the file. */
export const REPORT_MEDIA_ACCEPT_BY_KIND = {
  photo: "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif",
  video: "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov",
  audio: "audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.webm,.ogg",
} as const;

/**
 * The storage path for one evidence object. Server-chosen, never client-chosen:
 * the browser only ever receives a path the server signed.
 */
export function reportMediaPath(reportId: string, objectId: string, extension: string): string {
  return `reports/${reportId}/${objectId}.${extension}`;
}

/** Parses a path produced by reportMediaPath, or null if it is not one. */
export function parseReportMediaPath(path: string): { reportId: string; fileName: string; extension: string } | null {
  const match = /^reports\/([0-9a-zA-Z_-]{1,64})\/([0-9a-f-]{36})\.([a-z0-9]{2,5})$/.exec(path);
  if (!match) return null;
  return { reportId: match[1], fileName: `${match[2]}.${match[3]}`, extension: match[3] };
}
