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

export type ReportMediaType = "photo" | "video" | "audio";

export function mediaRule(mimeType: string) {
  return MIME_RULES[mimeType as keyof typeof MIME_RULES] ?? null;
}

export function validateReportMedia(file: File): { type: ReportMediaType; extension: string } | null {
  const rule = mediaRule(file.type.toLowerCase());
  if (!rule || file.size <= 0 || file.size > rule.maxBytes) return null;
  return { type: rule.type, extension: rule.extension };
}

export const REPORT_MEDIA_ACCEPT = Object.keys(MIME_RULES).join(",");
