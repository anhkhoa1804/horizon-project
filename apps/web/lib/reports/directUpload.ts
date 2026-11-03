/**
 * Browser half of the direct evidence upload. Mirrors what supabase-js
 * `uploadToSignedUrl` sends for a raw body (PUT, x-upsert, content-type,
 * cache-control, the public anon key), but over XMLHttpRequest so the form
 * can show real byte progress on a slow field connection — fetch() still has
 * no upload progress events.
 *
 * Only the public anon key is used here. The signed URL's token is what
 * authorises the write, and it is scoped by the server to one object path.
 */

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export type UploadOutcome = { ok: true } | { ok: false; status: number; reason: "network" | "timeout" | "rejected" | "aborted" };

export function putToSignedUrl(
  upload: SignedUpload,
  body: Blob,
  mimeType: string,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    const url = new URL(upload.signedUrl);
    if (!url.searchParams.get("token")) url.searchParams.set("token", upload.token);
    request.open("PUT", url.toString());
    // Generous: 20 MB over a weak 4G link on the islet can take minutes.
    request.timeout = 10 * 60 * 1000;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) {
      request.setRequestHeader("apikey", anon);
      request.setRequestHeader("authorization", `Bearer ${anon}`);
    }
    request.setRequestHeader("x-upsert", "true");
    request.setRequestHeader("content-type", mimeType);
    request.setRequestHeader("cache-control", "max-age=3600");
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(body.size);
        resolve({ ok: true });
      } else {
        resolve({ ok: false, status: request.status, reason: "rejected" });
      }
    };
    request.onerror = () => resolve({ ok: false, status: 0, reason: "network" });
    request.ontimeout = () => resolve({ ok: false, status: 0, reason: "timeout" });
    request.onabort = () => resolve({ ok: false, status: 0, reason: "aborted" });
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(body);
  });
}
