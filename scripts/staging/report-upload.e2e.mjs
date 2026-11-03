// Real video-upload integration test: browser-equivalent flow against the ISOLATED local stack.
//   report POST (manifest) -> signed-URL PUT of a real MP4 -> finalize -> DB + Storage verification,
//   plus negative / abuse cases. Refuses to run against anything but a loopback URL.
//
// Usage: node scripts/staging/report-upload.e2e.mjs   (stack + web must be running; see infra/supabase/local-stack)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(path.join(here, "../../infra/supabase/local-stack/.env.local-stack"), "utf8");
const env = Object.fromEntries(envText.split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3100";
const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
for (const u of [WEB, API]) {
  const host = new URL(u).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error(`refusing non-loopback target ${u}`);
}
const DB = `postgres://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres`;

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}`); }
  catch (e) { const m = String(e.message ?? e) + (e.cause ? ` [cause: ${e.cause.code ?? ""} ${e.cause.message ?? e.cause}]` : ""); results.push({ name, ok: false, error: m }); console.log(`FAIL  ${name}\n      ${m.split("\n")[0]}`); }
}

// --- fixtures: a REAL playable MP4 (ffmpeg testsrc), ~1-2 MB, plus oversized and wrong-type blobs
const dir = mkdtempSync(path.join(tmpdir(), "hz-upload-"));
const mp4 = path.join(dir, "evidence.mp4");
execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "6", "-c:v", "libx264", "-b:v", "2M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", "-y", mp4]);
const video = readFileSync(mp4);
console.log(`fixture: real MP4 ${video.length} bytes`);
const bigMp4 = path.join(dir, "big.mp4");
execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-t", "6", "-c:v", "libx264", "-b:v", "24M", "-minrate", "24M", "-maxrate", "24M", "-bufsize", "24M", "-pix_fmt", "yuv420p", "-y", bigMp4]);
const big = readFileSync(bigMp4);


async function postReport(media, extra = {}) {
  const res = await fetch(`${WEB}/api/public/reports`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": extra.ip ?? `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ category: "erosion", description: "SYNTHETIC local-staging report: bank erosion near the pump (test fixture)", stationId: "STATION_01", media }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function put(upload, bytes, type, tokenOverride) {
  const url = new URL(upload.signedUrl.startsWith("http") ? upload.signedUrl : `${API}/storage/v1${upload.signedUrl}`);
  if (tokenOverride) url.searchParams.set("token", tokenOverride);
  else if (!url.searchParams.get("token")) url.searchParams.set("token", upload.token);
  const res = await fetch(url, { method: "PUT", headers: { apikey: env.ANON_KEY, authorization: `Bearer ${env.ANON_KEY}`, "x-upsert": "true", "content-type": type, "cache-control": "max-age=3600" }, body: bytes });
  return { status: res.status, text: await res.text() };
}
async function finalize(id, ticket, paths, action = "finalize") {
  const res = await fetch(`${WEB}/api/public/reports/${id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket, action, paths }) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const db = new pg.Client({ connectionString: DB });
await db.connect();
const manifest = [{ name: "evidence.mp4", type: "video/mp4", size: video.length }];
let report, up;

await check("report POST with video manifest returns a signed upload + ticket", async () => {
  report = await postReport(manifest);
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.equal(report.body.ok, true);
  assert.equal(report.body.uploads.length, 1);
  assert.ok(report.body.uploadTicket);
  up = report.body.uploads[0];
  const { rows } = await db.query("select status from public.damage_logs where id=$1", [report.body.id]);
  assert.equal(rows.length, 1);
  const { rows: media } = await db.query("select count(*)::int c from public.report_media where report_id=$1", [report.body.id]);
  assert.equal(media[0].c, 0, "declaring a file must record nothing");
});

await check("finalize BEFORE the object exists records nothing", async () => {
  const r = await finalize(report.body.id, report.body.uploadTicket, [up.path]);
  assert.equal(r.status, 200);
  assert.equal(r.body.media.length, 0, JSON.stringify(r.body));
  assert.ok(r.body.problems.length >= 1);
});

await check("PUT real MP4 to the signed URL succeeds", async () => {
  const r = await put(up, video, "video/mp4");
  assert.ok(r.status >= 200 && r.status < 300, `${r.status} ${r.text}`);
});

await check("object is in private Storage with the exact byte size", async () => {
  const res = await fetch(`${API}/storage/v1/object/info/report-evidence/${up.path}`, { headers: { authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, apikey: env.SERVICE_ROLE_KEY } });
  const raw = await res.text();
  assert.equal(res.status, 200, raw);
  const info = JSON.parse(raw);
  assert.equal(info.size, video.length);
  assert.match(info.content_type ?? info.contentType ?? "", /video\/mp4/);
});

await check("finalize records exactly one report_media row (video, correct size/mime)", async () => {
  const r = await finalize(report.body.id, report.body.uploadTicket, [up.path]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.media.length, 1, JSON.stringify(r.body));
  const { rows } = await db.query("select media_type,mime_type,file_size,storage_path from public.report_media where report_id=$1", [report.body.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].media_type, "video");
  assert.equal(rows[0].mime_type, "video/mp4");
  assert.equal(Number(rows[0].file_size), video.length);
  assert.equal(rows[0].storage_path, up.path);
});

await check("finalize is idempotent (no duplicate row)", async () => {
  await finalize(report.body.id, report.body.uploadTicket, [up.path]);
  const { rows } = await db.query("select count(*)::int c from public.report_media where report_id=$1", [report.body.id]);
  assert.equal(rows[0].c, 1);
});

await check("resign refuses a path that is already recorded evidence", async () => {
  const r = await finalize(report.body.id, report.body.uploadTicket, [up.path], "resign");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.uploads, []);
  assert.deepEqual(r.body.alreadyRecorded, [up.path]);
});

await check("stored object bytes are identical to the uploaded file (service-role download)", async () => {
  const res = await fetch(`${API}/storage/v1/object/report-evidence/${up.path}`, { headers: { authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, apikey: env.SERVICE_ROLE_KEY } });
  assert.equal(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.equals(video));
  // probe it is still a decodable video
  const out = path.join(dir, "roundtrip.mp4");
  writeFileSync(out, buf);
  const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0", out]).toString();
  assert.match(probe, /h264/);
});

await check("service-role signed READ url works (admin evidence viewing path)", async () => {
  const res = await fetch(`${API}/storage/v1/object/sign/report-evidence/${up.path}`, { method: "POST", headers: { authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, apikey: env.SERVICE_ROLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
  assert.equal(res.status, 200);
  const { signedURL } = await res.json();
  const get = await fetch(`${API}/storage/v1${signedURL}`);
  assert.equal(get.status, 200);
  assert.equal((await get.arrayBuffer()).byteLength, video.length);
});

// ---- authorization / abuse
await check("anonymous cannot read the private object (no URL, public path, or anon key)", async () => {
  const pub = await fetch(`${API}/storage/v1/object/public/report-evidence/${up.path}`);
  assert.ok([400, 404].includes(pub.status), `public path returned ${pub.status}`);
  const anon = await fetch(`${API}/storage/v1/object/report-evidence/${up.path}`, { headers: { authorization: `Bearer ${env.ANON_KEY}`, apikey: env.ANON_KEY } });
  assert.ok([400, 401, 403, 404].includes(anon.status), `anon read returned ${anon.status}`);
  const list = await fetch(`${API}/storage/v1/object/list/report-evidence`, { method: "POST", headers: { authorization: `Bearer ${env.ANON_KEY}`, apikey: env.ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 10 }) });
  const names = list.status === 200 ? await list.json() : [];
  assert.equal(names.length, 0, "anon listed objects");
});

await check("anonymous cannot read report_media or damage_logs via REST", async () => {
  for (const t of ["report_media", "damage_logs"]) {
    const r = await fetch(`${API}/rest/v1/${t}?select=*`, { headers: { apikey: env.ANON_KEY, authorization: `Bearer ${env.ANON_KEY}` } });
    const body = await r.json().catch(() => []);
    assert.ok(!(r.status === 200 && Array.isArray(body) && body.length > 0), `${t} leaked to anon`);
  }
});

await check("anon key cannot upload without a signed token", async () => {
  const res = await fetch(`${API}/storage/v1/object/report-evidence/${report.body.id}/forged.mp4`, { method: "POST", headers: { authorization: `Bearer ${env.ANON_KEY}`, apikey: env.ANON_KEY, "content-type": "video/mp4" }, body: video.subarray(0, 1000) });
  assert.ok([400, 401, 403].includes(res.status), `forged anon upload returned ${res.status}`);
});

await check("a ticket for report A cannot finalize report B", async () => {
  const other = await postReport(manifest);
  assert.equal(other.status, 200, JSON.stringify(other.body));
  const r = await finalize(other.body.id, report.body.uploadTicket, [up.path]);
  assert.equal(r.status, 403);
});

await check("tampered ticket and invented path are rejected", async () => {
  const bad = report.body.uploadTicket.slice(0, -4) + "AAAA";
  assert.equal((await finalize(report.body.id, bad, [up.path])).status, 403);
  const r = await finalize(report.body.id, report.body.uploadTicket, [`${report.body.id}/../../other/x.mp4`]);
  assert.equal(r.status, 400);
});

await check("signed upload token is bound to ONE path (cannot write elsewhere)", async () => {
  const r = await postReport(manifest);
  const u = r.body.uploads[0];
  const other = new URL(u.signedUrl.startsWith("http") ? u.signedUrl : `${API}/storage/v1${u.signedUrl}`);
  other.pathname = other.pathname.replace(/[^/]+\.mp4$/, "different.mp4");
  const res = await fetch(other, { method: "PUT", headers: { apikey: env.ANON_KEY, authorization: `Bearer ${env.ANON_KEY}`, "content-type": "video/mp4" }, body: video.subarray(0, 2000) });
  assert.ok(res.status >= 400, `token worked on a different path (${res.status})`);
});

await check("wrong MIME type is refused by bucket policy even with a valid token", async () => {
  const r = await postReport(manifest);
  const res = await put(r.body.uploads[0], Buffer.from("MZ not a video"), "application/x-msdownload");
  assert.ok(res.status >= 400, `executable accepted (${res.status})`);
});

await check("manifest validation: unsupported type / oversize / too many are rejected before any row is written", async () => {
  const before = (await db.query("select count(*)::int c from public.damage_logs")).rows[0].c;
  const a = await postReport([{ name: "x.exe", type: "application/x-msdownload", size: 100 }]);
  assert.equal(a.status, 400);
  const b = await postReport([{ name: "big.mp4", type: "video/mp4", size: 21 * 1024 * 1024 }]);
  assert.equal(b.status, 400);
  const c = await postReport(Array.from({ length: 12 }, (_, i) => ({ name: `f${i}.mp4`, type: "video/mp4", size: 1000 })));
  assert.equal(c.status, 400);
  const after = (await db.query("select count(*)::int c from public.damage_logs")).rows[0].c;
  assert.equal(after, before, "a rejected manifest must not create a report");
});

await check("declared size lies: finalize records the REAL stored size, never the declared one", async () => {
  const lie = await postReport([{ name: "small.mp4", type: "video/mp4", size: 1000 }]);
  const u = lie.body.uploads[0];
  const r = await put(u, video, "video/mp4");
  assert.ok(r.status < 300, r.text);
  const f = await finalize(lie.body.id, lie.body.uploadTicket, [u.path]);
  assert.equal(f.status, 200);
  const { rows } = await db.query("select file_size from public.report_media where report_id=$1", [lie.body.id]);
  if (rows.length) assert.equal(Number(rows[0].file_size), video.length);
});

await check("rate limiter engages for one client (HTTP 429 after the quota)", async () => {
  const ip = "10.99.99.99";
  let limited = 0;
  for (let i = 0; i < 15; i++) { if ((await postReport([], { ip })).status === 429) limited++; }
  assert.ok(limited > 0, "no 429 after 15 rapid reports from one client");
});

// ---- size boundaries (real bytes through Storage)
console.log(`fixture: near-limit MP4 ${big.length} bytes (limit 20971520)`);

await check("a real ~18-20 MB video (just under the 20 MB limit) uploads, finalizes and round-trips", async () => {
  assert.ok(big.length < 20971520 && big.length > 10_000_000, `fixture size ${big.length} not in the 10-20 MB band`);
  const r = await postReport([{ name: "big.mp4", type: "video/mp4", size: big.length }]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const u = r.body.uploads[0];
  const t0 = Date.now();
  const put1 = await put(u, big, "video/mp4");
  assert.ok(put1.status < 300, `${put1.status} ${put1.text}`);
  const f = await finalize(r.body.id, r.body.uploadTicket, [u.path]);
  assert.equal(f.body.media.length, 1, JSON.stringify(f.body));
  const { rows } = await db.query("select file_size from public.report_media where report_id=$1", [r.body.id]);
  assert.equal(Number(rows[0].file_size), big.length);
  console.log(`      uploaded ${big.length} bytes in ${Date.now() - t0} ms (loopback)`);
});

await check("an over-limit (21 MB) body is rejected by Storage itself even though the declared manifest was small", async () => {
  const r = await postReport([{ name: "liar.mp4", type: "video/mp4", size: 1000 }]);
  const u = r.body.uploads[0];
  const res = await put(u, Buffer.alloc(21 * 1024 * 1024, 1), "video/mp4");
  assert.ok(res.status >= 400, `21 MB accepted (${res.status})`);
  const f = await finalize(r.body.id, r.body.uploadTicket, [u.path]);
  assert.equal(f.body.media.length, 0, "an over-limit object must never be recorded as evidence");
});

await db.end();
const failed = results.filter((r) => !r.ok);
writeFileSync(path.join(here, "report-upload.e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), target: { web: WEB, api: API }, fixtureBytes: video.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
