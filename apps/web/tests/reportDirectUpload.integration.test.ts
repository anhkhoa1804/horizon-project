import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { POST as createReport } from "@/app/api/public/reports/route";
import { POST as evidenceStep } from "@/app/api/public/reports/[id]/media/route";
import { resetMemoryRateLimit } from "@/lib/reports/rateLimit";

/**
 * The evidence flow end to end at the HTTP boundary, with Supabase's REST and
 * Storage APIs replaced by an in-memory fake. This asserts the properties that
 * matter to a reporter and to the admin who reviews the evidence:
 *
 *  - a video is DECLARED in a small JSON request (no 4.5 MB function body);
 *  - the report row is written even if the evidence never arrives;
 *  - no report_media row exists until the object is really in Storage;
 *  - a ticket for one report cannot attach to another or name another path;
 *  - finalize is idempotent and refuses objects in a disallowed shape.
 *
 * It does NOT prove the real Supabase Storage service accepts the signed
 * upload; that needs a deployed bucket and is listed as unverified.
 */

const MB = 1024 * 1024;
const BASE = "http://fake-supabase.test";
const oldFetch = globalThis.fetch;
const saved: Record<string, string | undefined> = {};

interface FakeState {
  reports: { id: string }[];
  media: { storage_path: string; report_id: string; media_type: string; mime_type: string; file_size: number; id: string }[];
  objects: Map<string, { size: number; mimetype: string }>;
  removed: string[];
  failSign: boolean;
}
let state: FakeState;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

before(() => {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NODE_ENV"]) saved[key] = process.env[key];
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
  process.env.SUPABASE_URL = BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_direct_upload_test_only";

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname.endsWith("/rpc/consume_report_rate_limit")) return json({ message: "no limiter" }, 404);

    if (url.pathname === "/rest/v1/damage_logs" && method === "POST") {
      const id = `REPORT_${state.reports.length + 1}`;
      state.reports.push({ id });
      return json({ id }, 201);
    }

    if (url.pathname === "/rest/v1/report_media") {
      if (method === "POST") {
        const row = (await request.json()) as Omit<FakeState["media"][number], "id">;
        if (state.media.some((m) => m.storage_path === row.storage_path)) {
          return json({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
        }
        const created = { ...row, id: `M${state.media.length + 1}` };
        state.media.push(created);
        return json({ id: created.id, media_type: created.media_type }, 201);
      }
      if (method === "GET") {
        const raw = url.searchParams.get("storage_path");
        const inList = url.searchParams.get("storage_path")?.startsWith("in.(");
        const paths = inList ? raw!.slice(4, -1).split(",").map((p) => p.replace(/^"|"$/g, "")) : raw?.startsWith("eq.") ? [raw.slice(3)] : [];
        const rows = state.media.filter((m) => paths.includes(m.storage_path));
        const wantsObject = (request.headers.get("accept") ?? "").includes("vnd.pgrst.object");
        return json(wantsObject ? rows[0] ?? null : rows);
      }
    }

    const sign = /\/storage\/v1\/object\/upload\/sign\/report-evidence\/(.+)$/.exec(url.pathname);
    if (sign && method === "POST") {
      if (state.failSign) return json({ message: "storage down" }, 500);
      const objectPath = decodeURIComponent(sign[1]);
      return json({ url: `/object/upload/sign/report-evidence/${objectPath}?token=tok_${objectPath.length}` });
    }

    if (url.pathname.endsWith("/storage/v1/object/list/report-evidence") && method === "POST") {
      const { prefix } = (await request.json()) as { prefix: string };
      const entries = [...state.objects.entries()]
        .filter(([path]) => path.startsWith(`${prefix}/`))
        .map(([path, meta]) => ({ name: path.slice(prefix.length + 1), metadata: { size: meta.size, mimetype: meta.mimetype } }));
      return json(entries);
    }

    if (url.pathname.endsWith("/storage/v1/object/report-evidence") && method === "DELETE") {
      const { prefixes } = (await request.json()) as { prefixes: string[] };
      for (const path of prefixes) {
        state.objects.delete(path);
        state.removed.push(path);
      }
      return json([]);
    }

    return json({ message: `unhandled fake route ${method} ${url.pathname}` }, 500);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  state = { reports: [], media: [], objects: new Map(), removed: [], failSign: false };
  resetMemoryRateLimit();
});

function submit(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return createReport(
    new Request("https://horizon.test/api/public/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function step(id: string, body: unknown): Promise<Response> {
  return evidenceStep(
    new Request(`https://horizon.test/api/public/reports/${id}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const base = { category: "erosion", description: "Bờ sông sạt lở gần trạm nước", lat: 10.2, lng: 106.0 };
const video = { name: "IMG_0042.MOV", type: "", size: 18 * MB };

describe("report with a video, uploaded directly to Storage", () => {
  it("declares the video, stores the report, and returns a signed upload — recording no evidence yet", async () => {
    const response = await submit({ ...base, media: [video] });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(state.reports.length, 1);
    assert.equal(body.uploads.length, 1);
    assert.equal(body.uploads[0].mimeType, "video/quicktime", "blank browser type resolved from the .MOV extension");
    assert.match(body.uploads[0].path, /^reports\/REPORT_1\/[0-9a-f-]{36}\.mov$/);
    assert.ok(body.uploadTicket);
    assert.equal(state.media.length, 0, "no report_media row before the object exists in Storage");
  });

  it("records the evidence only after the object is present, and is idempotent", async () => {
    const created = await (await submit({ ...base, media: [video] })).json();
    const { path } = created.uploads[0];

    const early = await (await step(created.id, { ticket: created.uploadTicket, action: "finalize", paths: [path] })).json();
    assert.equal(early.media.length, 0);
    assert.deepEqual(early.problems, [{ path, reason: "not_uploaded" }]);
    assert.equal(state.media.length, 0);

    state.objects.set(path, { size: 18 * MB, mimetype: "video/quicktime" });
    const done = await (await step(created.id, { ticket: created.uploadTicket, action: "finalize", paths: [path] })).json();
    assert.equal(done.media.length, 1);
    assert.equal(state.media[0].media_type, "video");
    assert.equal(state.media[0].file_size, 18 * MB);

    const again = await (await step(created.id, { ticket: created.uploadTicket, action: "finalize", paths: [path] })).json();
    assert.equal(again.media.length, 1, "a retry after a dropped response still reports it");
    assert.equal(state.media.length, 1, "and does not write a second row");
  });

  it("removes and refuses an object whose stored type or size is outside the allowlist", async () => {
    const created = await (await submit({ ...base, media: [video] })).json();
    const { path } = created.uploads[0];
    state.objects.set(path, { size: 25 * MB, mimetype: "video/quicktime" });
    const result = await (await step(created.id, { ticket: created.uploadTicket, action: "finalize", paths: [path] })).json();
    assert.deepEqual(result.problems, [{ path, reason: "rejected_object" }]);
    assert.deepEqual(state.removed, [path]);
    assert.equal(state.media.length, 0);
  });

  it("keeps the report when evidence signing fails, and says which file failed", async () => {
    state.failSign = true;
    const response = await submit({ ...base, media: [video] });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(state.reports.length, 1);
    assert.deepEqual(body.mediaFailures, ["IMG_0042.MOV"]);
    assert.deepEqual(body.uploads, []);
  });

  it("rejects an unsupported or oversize file BEFORE writing the report", async () => {
    const pdf = await submit({ ...base, media: [{ name: "a.pdf", type: "application/pdf", size: 10 }] });
    assert.equal(pdf.status, 400);
    const huge = await submit({ ...base, media: [{ name: "a.mp4", type: "video/mp4", size: 21 * MB }] });
    assert.equal(huge.status, 400);
    assert.equal(state.reports.length, 0, "a report that cannot be completed is not half-created");
    const four = await submit({ ...base, media: Array.from({ length: 4 }, (_, i) => ({ name: `${i}.mp4`, type: "video/mp4", size: MB })) });
    assert.equal(four.status, 400);
  });

  it("works without any evidence (JSON, no media)", async () => {
    const response = await submit(base);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.uploads ?? [], []);
    assert.equal(state.reports.length, 1);
  });
});

describe("evidence step authorization", () => {
  it("refuses a missing, forged, or other-report ticket", async () => {
    const a = await (await submit({ ...base, media: [video] })).json();
    const b = await (await submit({ ...base, media: [video] })).json();
    assert.equal((await step(a.id, { action: "finalize", paths: [a.uploads[0].path] })).status, 403);
    assert.equal((await step(a.id, { ticket: "x.y", action: "finalize", paths: [a.uploads[0].path] })).status, 403);
    assert.equal((await step(b.id, { ticket: a.uploadTicket, action: "finalize", paths: [a.uploads[0].path] })).status, 403, "A's ticket does not work on report B");
  });

  it("refuses a path the server did not issue", async () => {
    const a = await (await submit({ ...base, media: [video] })).json();
    const foreign = `reports/${a.id}/00000000-0000-4000-8000-000000000000.mp4`;
    assert.equal((await step(a.id, { ticket: a.uploadTicket, action: "finalize", paths: [foreign] })).status, 400);
    assert.equal((await step(a.id, { ticket: a.uploadTicket, action: "finalize", paths: [] })).status, 400);
    assert.equal((await step(a.id, { ticket: a.uploadTicket, action: "delete", paths: [a.uploads[0].path] })).status, 400);
  });

  it("will not re-open an already recorded object for overwrite", async () => {
    const a = await (await submit({ ...base, media: [video] })).json();
    const { path } = a.uploads[0];
    state.objects.set(path, { size: 5 * MB, mimetype: "video/quicktime" });
    await step(a.id, { ticket: a.uploadTicket, action: "finalize", paths: [path] });
    const resign = await (await step(a.id, { ticket: a.uploadTicket, action: "resign", paths: [path] })).json();
    assert.deepEqual(resign.uploads, []);
    assert.deepEqual(resign.alreadyRecorded, [path]);
  });

  it("re-signs an unrecorded path for a retry", async () => {
    const a = await (await submit({ ...base, media: [video] })).json();
    const { path } = a.uploads[0];
    const resign = await (await step(a.id, { ticket: a.uploadTicket, action: "resign", paths: [path] })).json();
    assert.equal(resign.uploads.length, 1);
    assert.equal(resign.uploads[0].path, path);
  });
});
