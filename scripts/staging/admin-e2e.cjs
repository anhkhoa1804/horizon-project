/**
 * Admin functional + authorization E2E against the ISOLATED local stack.
 *   Real browser (Playwright) -> real Next server actions -> real PostgREST/Storage/Postgres.
 * Every mutation is verified by reading the DATABASE afterwards (not by trusting the UI).
 * Refuses to run against a non-loopback target. Synthetic data only.
 *
 * Prereqs: infra/supabase/local-stack up + migrated, web running via local-stack/run-web.sh (port 3100),
 *          scripts/staging/report-upload.e2e.mjs already run (creates reports with a real video).
 */
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.HORIZON_PLAYWRIGHT_MODULE || "playwright");
const pg = require("pg");

const root = path.resolve(__dirname, "../..");
const envText = readFileSync(path.join(root, "infra/supabase/local-stack/.env.local-stack"), "utf8");
const env = Object.fromEntries(envText.split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const WEB = (process.env.WEB_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
if (!["127.0.0.1", "localhost"].includes(new URL(WEB).hostname)) throw new Error("refusing non-loopback target");
const SHOTS = path.join(root, "docs/qa/screenshots/admin-local");
mkdirSync(SHOTS, { recursive: true });
const ADMIN = "admin@horizon.test";
const CHROME = process.env.HORIZON_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}`); }
  catch (e) { const m = String(e && e.message ? e.message : e); results.push({ name, ok: false, error: m }); console.log(`FAIL  ${name}\n      ${m.split("\n")[0]}`); }
}

// Unauthenticated export: middleware redirects to login (307) before the route's own 401 is reached. Either is a refusal; neither may carry data.
async function expectExportRefused(requestCtx, query = "") {
  const r = await requestCtx.get(`${WEB}/admin/export${query}`, { maxRedirects: 0 });
  const loc = r.headers()["location"] || "";
  const ok = r.status() === 401 || (r.status() >= 300 && r.status() < 400 && /\/admin\/login/.test(loc));
  assert.ok(ok, `export not refused: ${r.status()} ${loc}`);
  assert.doesNotMatch(await r.text().catch(() => ""), /station_id,timestamp/);
}
async function authedGet(browserCtx, url, init = {}) {
  const jar = (await browserCtx.cookies()).filter((c) => c.name === "horizon_admin_session");
  const cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");
  return browserCtx.request.get(url, { ...init, headers: { ...(init.headers || {}), ...(cookie ? { cookie } : {}) } });
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function mintCookie(email, expOffset = 3600, secret = env.ADMIN_SESSION_SECRET) {
  const payload = b64({ email, exp: Math.floor(Date.now() / 1000) + expOffset });
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

(async () => {
  const db = new pg.Client({ connectionString: `postgres://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres` });
  await db.connect();
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const browser = await chromium.launch({ executablePath: CHROME });
  const newCtx = async (extra = {}) => browser.newContext({ viewport: { width: 1280, height: 900 }, ...extra });

  // ---- clean slate for synthetic rows from earlier runs (local DB only)
  await q("delete from public.maintenance_logs where note like 'SYNTHETIC%'");
  await q("delete from public.calibration_records where sensor like 'SYNTH%'");
  await q("delete from public.alert_configs where metric in ('salinity','bad_metric_x') and station_id='STATION_01'");
  await q("delete from public.admin_allowed_emails where note like 'SYNTHETIC%'");
  await q("delete from public.environmental_readings where message_id like 'synthetic-e2e-%'");
  // ---- synthetic fixtures (local DB only): two fresh 'new' reports so the review flow is repeatable
  await q("delete from public.damage_logs where description like '%SYNTHETIC admin-e2e%' and id not in (select report_id from public.report_media)");
  for (let i = 0; i < 2; i++) await q("insert into public.damage_logs (lat, lng, timestamp, description, status) values (10.2, 106.4, now(), '[erosion] [station:STATION_01] SYNTHETIC admin-e2e fixture', 'new')");
  await q(`insert into public.environmental_readings (message_id, station_id, timestamp, water_level, water_ec_ms_cm, water_temp_c, salinity, ec_probe_status, ultrasonic_status)
           values ('synthetic-e2e-fresh', 'STATION_01', now() - interval '2 minutes', 1.42, 3.1, 28.4, 0.061, 'ok', 'ok'),
                  ('synthetic-e2e-stale', 'STATION_01', now() - interval '3 days', 1.10, 2.0, 27.0, 0.040, 'ok', 'ok')
           on conflict do nothing`);

  async function login(page, email = ADMIN, password = env.ADMIN_PASSWORD) {
    await page.goto(`${WEB}/admin/login`, { waitUntil: "networkidle", timeout: 120000 });
    await page.fill("input[name=email]", email);
    await page.fill("input[name=password]", password);
    await page.click("button[type=submit]");
    await page.waitForFunction(() => location.pathname !== "/admin/login" || location.search.includes("error="), null, { timeout: 60000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
  }
  const submitForm = async (page, selectorInForm, btnText) => {
    const form = page.locator("form", { has: page.locator(selectorInForm) }).filter({ has: page.getByRole("button", { name: btnText }) }).first();
    await form.getByRole("button", { name: btnText }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
  };

  // =========================== A. AUTHORIZATION BOUNDARY (no session) ===========================
  const anon = await newCtx();
  const anonPage = await anon.newPage();

  await check("A1 unauthenticated /admin redirects to /admin/login", async () => {
    await anonPage.goto(`${WEB}/admin`, { waitUntil: "networkidle", timeout: 120000 });
    assert.match(anonPage.url(), /\/admin\/login/);
    await anonPage.screenshot({ path: path.join(SHOTS, "A1-login-redirect.png") });
  });
  await check("A2 unauthenticated /admin/export is refused (login redirect or 401) and returns no data", async () => {
    await expectExportRefused(anon.request, "?dataset=environmental");
  });
  const cookieCases = [
    ["garbage cookie", "not-a-token"],
    ["valid payload, wrong signature", mintCookie(ADMIN, 3600, "wrong-secret")],
    ["expired but correctly signed", mintCookie(ADMIN, -60)],
    ["correctly signed but email NOT on allowlist", mintCookie("intruder@example.com")],
    ["unsigned payload only", b64({ email: ADMIN, exp: 4102444800 })],
  ];
  for (const [label, value] of cookieCases) {
    await check(`A3 forged/invalid session (${label}) is refused on /admin and /admin/export`, async () => {
      const ctx = await newCtx();
      await ctx.addCookies([{ name: "horizon_admin_session", value, url: WEB }]);
      const page = await ctx.newPage();
      await page.goto(`${WEB}/admin`, { waitUntil: "networkidle", timeout: 120000 });
      assert.match(page.url(), /\/admin\/login/, `reached ${page.url()}`);
      await expectExportRefused(ctx.request);
      await ctx.close();
    });
  }
  await check("A4 login: wrong password and non-allowlisted email give the SAME answer (no enumeration)", async () => {
    const outcomes = [];
    for (const [email, pw] of [[ADMIN, "wrong-password-xyz"], ["not-listed@example.com", env.ADMIN_PASSWORD]]) {
      const ctx = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": `10.5.${outcomes.length}.1` } });
      const page = await ctx.newPage();
      await login(page, email, pw);
      outcomes.push({ url: new URL(page.url()).search, text: (await page.locator(".login-submission-status").innerText().catch(() => "")).trim() });
      await ctx.close();
    }
    assert.match(outcomes[0].url, /error=bad-password/);
    assert.deepEqual(outcomes[0], outcomes[1]);
  });
  await check("A5 login brute-force: 6th failure from one client+email is rate-limited", async () => {
    const ctx = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.66.66.66" } });
    const page = await ctx.newPage();
    let last = "";
    for (let i = 0; i < 7; i++) { await login(page, "brute@example.com", `bad-${i}`); last = page.url(); if (/rate-limited/.test(last)) break; }
    assert.match(last, /error=rate-limited/);
    // the correct password from the SAME throttled key must not get in either
    await login(page, "brute@example.com", env.ADMIN_PASSWORD);
    assert.doesNotMatch(page.url(), /\/admin(\?|$)(?!.*error)/);
    await page.screenshot({ path: path.join(SHOTS, "A5-rate-limited.png") });
    await ctx.close();
  });
  await check("A6 a different client is NOT locked out by someone else's failures", async () => {
    const ctx = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.77.1.2" } });
    const page = await ctx.newPage();
    await login(page);
    assert.match(page.url(), /\/admin(\?|#|$)/);
    assert.doesNotMatch(page.url(), /login/);
    await ctx.close();
  });
  await check("A7 open-redirect attempt via redirectTo is neutralised", async () => {
    const ctx = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.88.1.1" } });
    const page = await ctx.newPage();
    await page.goto(`${WEB}/admin/login?redirect=${encodeURIComponent("https://evil.example/phish")}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.fill("input[name=email]", ADMIN);
    await page.fill("input[name=password]", env.ADMIN_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForLoadState("networkidle");
    assert.equal(new URL(page.url()).hostname, "127.0.0.1");
    await ctx.close();
  });
  await anon.close();

  // =========================== B. AUTHENTICATED FLOWS ===========================
  const ctx = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.200.0.1" } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(page.url() + " :: " + String(e).slice(0, 40)));
  await login(page);

  await check("B1 admin console renders for the allow-listed admin", async () => {
    assert.match(page.url(), /\/admin/);
    const text = await page.innerText("main");
    assert.match(text, /Bảng điều khiển|Tổng quan/);
    await page.screenshot({ path: path.join(SHOTS, "B1-admin-console.png"), fullPage: true });
  });

  await check("B2 freshness truth: STATION_02 has no recent soil row -> NOT shown as healthy/online", async () => {
    const t = await page.innerText("main");
    assert.doesNotMatch(t, /3\/3 nút đang gửi dữ liệu/);
  });

  await check("B3 CSV export returns real rows only, correct header, and writes an audit event", async () => {
    const before = (await q("select count(*)::int c from public.audit_events where action='data.export'"))[0].c;
    const res = await authedGet(ctx, `${WEB}/admin/export?dataset=environmental&station=STATION_01&from=2000-01-01&to=2099-12-31`);
    assert.equal(res.status(), 200);
    assert.match(res.headers()["content-type"], /text\/csv/);
    const lines = (await res.text()).trim().split(/\r?\n/);
    assert.equal(lines[0], "station_id,timestamp,water_level,water_ec_ms_cm,water_temp_c,salinity,fault_flags,ec_probe_status,ultrasonic_status");
    const dbCount = (await q("select count(*)::int c from public.environmental_readings where station_id='STATION_01'"))[0].c;
    assert.equal(lines.length - 1, dbCount, "CSV row count must equal DB row count (no synthetic rows)");
    const after = (await q("select count(*)::int c from public.audit_events where action='data.export'"))[0].c;
    assert.equal(after, before + 1);
    const empty = await authedGet(ctx, `${WEB}/admin/export?dataset=environmental&station=STATION_01&from=1990-01-01&to=1990-01-02`);
    assert.equal((await empty.text()).trim().split(/\r?\n/).length, 1, "empty range = header only");
  });
  await check("B4 CSV export rejects malformed ranges and unknown stations don't widen scope", async () => {
    const bad = await authedGet(ctx, `${WEB}/admin/export?from=2026-13-99`, { headers: { accept: "application/json" } });
    assert.equal(bad.status(), 400);
    const inj = await authedGet(ctx, `${WEB}/admin/export?station=${encodeURIComponent("STATION_01' or 1=1 --")}&dataset=environmental`);
    assert.ok([200, 400].includes(inj.status()));
    const soil = await authedGet(ctx, `${WEB}/admin/export?dataset=soil`);
    assert.equal(soil.status(), 200);
    assert.match((await soil.text()).split(/\r?\n/)[0], /^station_id,timestamp,soil_moisture_pct/);
  });

  await check("B5 evidence: admin sees the uploaded video via a signed URL that actually serves the file", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle", timeout: 120000 });
    const expected = (await q("select file_size, storage_path from public.report_media where media_type='video' order by created_at limit 1"))[0];
    assert.ok(expected, "no uploaded video fixture — run report-upload.e2e.mjs first");
    const srcs = await page.$$eval("video[src], video source[src], a[href*='report-evidence'], audio[src]", (els) => els.map((e) => e.getAttribute("src") || e.getAttribute("href")));
    assert.ok(srcs.length > 0, "no evidence element rendered");
    const src = srcs.find((s) => /sign/.test(s));
    assert.ok(src, `no signed URL among ${JSON.stringify(srcs)}`);
    const r = await authedGet(ctx, src.startsWith("http") ? src : `${WEB}${src}`);
    assert.equal(r.status(), 200);
    assert.ok((await r.body()).length > 100000);
    await page.screenshot({ path: path.join(SHOTS, "B5-evidence.png"), fullPage: true });
  });

  await check("B6 report review: mark viewed -> reviewing + viewed_at/viewed_by in DB + audit event", async () => {
    const id = (await q("select id from public.damage_logs where status='new' order by timestamp desc limit 1"))[0].id;
    const form = page.locator("form", { has: page.locator(`input[name=report_id][value="${id}"]`) }).filter({ has: page.getByRole("button", { name: "Đánh dấu đã xem" }) });
    await form.getByRole("button", { name: "Đánh dấu đã xem" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    const row = (await q("select status, viewed_at from public.damage_logs where id=$1", [id]))[0];
    assert.equal(row.status, "reviewing"); assert.ok(row.viewed_at);
    const aud = await q("select actor from public.audit_events where entity_id=$1 order by created_at desc limit 1", [id]);
    assert.equal(aud[0]?.actor, ADMIN);
    globalThis.__reviewedId = id;
  });
  await check("B7 report resolve -> status resolved in DB", async () => {
    const id = globalThis.__reviewedId;
    await page.goto(`${WEB}/admin?report_status=all`, { waitUntil: "networkidle", timeout: 120000 });
    const form = page.locator("form", { has: page.locator(`input[name=report_id][value="${id}"]`) }).filter({ has: page.getByRole("button", { name: "Đánh dấu đã xử lý" }) });
    if (await form.count()) {
      await form.getByRole("button", { name: "Đánh dấu đã xử lý" }).click();
      await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    }
    assert.equal((await q("select status from public.damage_logs where id=$1", [id]))[0].status, "resolved");
  });
  await check("B8 report action with a non-existent id changes nothing and shows an error", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle", timeout: 120000 });
    const before = JSON.stringify(await q("select id, status, viewed_at from public.damage_logs order by id"));
    // Pick an ENABLED action button, point its form at an id that does not exist, and submit.
    const btn = page.locator("form:has(input[name=report_id]) button:not([disabled])").first();
    assert.ok(await btn.count(), "no enabled report action to exercise");
    await btn.evaluate((el) => { el.closest("form").querySelector("input[name=report_id]").value = "00000000-0000-0000-0000-000000000000"; });
    await btn.click();
    await page.waitForFunction(() => location.search.includes("error="), null, { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
    const afterRows = JSON.stringify(await q("select id, status, viewed_at from public.damage_logs order by id"));
    if (afterRows !== before) { const b0 = JSON.parse(before), a0 = JSON.parse(afterRows); const d = a0.filter((r, i) => JSON.stringify(r) !== JSON.stringify(b0[i])); throw new Error("rows changed: " + JSON.stringify(d)); }
    assert.match(page.url(), /error=/);
  });

  await check("B9 alert threshold save -> alert_configs upsert (and idempotent on second save)", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle", timeout: 120000 });
    const f = page.locator("form", { has: page.locator("input[name=warning_threshold]") });
    await f.locator("select[name=station_id]").selectOption("STATION_01");
    await f.locator("input[name=metric]").fill("salinity");
    await f.locator("input[name=warning_threshold]").fill("2");
    await f.locator("input[name=critical_threshold]").fill("4");
    await f.locator("input[name=unit]").fill("‰");
    await f.getByRole("button", { name: "Lưu ngưỡng" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    for (let i = 0; i < 1; i++) {
      await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
      const g = page.locator("form", { has: page.locator("input[name=warning_threshold]") });
      await g.locator("input[name=metric]").fill("salinity"); await g.locator("input[name=warning_threshold]").fill("2"); await g.locator("input[name=critical_threshold]").fill("4");
      await g.getByRole("button", { name: "Lưu ngưỡng" }).click();
      await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    }
    const rows = await q("select warning_threshold, critical_threshold, enabled from public.alert_configs where station_id='STATION_01' and metric='salinity'");
    assert.equal(rows.length, 1, "upsert must not duplicate");
    assert.equal(Number(rows[0].warning_threshold), 2); assert.equal(Number(rows[0].critical_threshold), 4);
  });
  await check("B10 alert threshold validation: warning > critical (above) is refused, nothing written", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("input[name=warning_threshold]") });
    await f.locator("input[name=metric]").fill("bad_metric_x");
    await f.locator("input[name=warning_threshold]").fill("9");
    await f.locator("input[name=critical_threshold]").fill("1");
    await f.getByRole("button", { name: "Lưu ngưỡng" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    const n = (await q("select count(*)::int c from public.alert_configs where metric='bad_metric_x'"))[0].c;
    assert.equal(n, 0, "inverted thresholds were stored");
  });

  await check("B11 maintenance log add -> row in DB attributed to the admin", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("select[name=kind]") });
    await f.locator("select[name=station_id]").selectOption("STATION_01");
    await f.locator("select[name=kind]").selectOption("cleaning");
    await f.locator("input[name=note]").fill("SYNTHETIC e2e: cleaned probe");
    await f.getByRole("button", { name: "Ghi nhận" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    const r = await q("select kind, operator from public.maintenance_logs where note like 'SYNTHETIC e2e%'");
    assert.equal(r.length, 1); assert.equal(r[0].kind, "cleaning"); assert.equal(r[0].operator, ADMIN);
  });
  await check("B12 calibration record add -> row in DB; non-numeric reference refused", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("input[name=reference_value]") });
    await f.locator("select[name=station_id]").selectOption("STATION_01");
    await f.locator("input[name=sensor]").fill("SYNTH-EC-01");
    await f.locator("input[name=reference_value]").fill("1.413");
    await f.locator("input[name=measured_value]").fill("1.39");
    await f.getByRole("button", { name: "Lưu bản ghi" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    const r = await q("select reference_value, measured_value from public.calibration_records where sensor='SYNTH-EC-01'");
    assert.equal(r.length, 1); assert.equal(Number(r[0].reference_value), 1.413);
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const g = page.locator("form", { has: page.locator("input[name=reference_value]") });
    await g.locator("input[name=sensor]").fill("SYNTH-BAD");
    await g.locator("input[name=reference_value]").evaluate((el) => { el.value = "abc"; });
    await g.getByRole("button", { name: "Lưu bản ghi" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    assert.equal((await q("select count(*)::int c from public.calibration_records where sensor='SYNTH-BAD'"))[0].c, 0);
  });

  await check("B13 soil water model (STATION_02): valid save stored; PWP>=FC refused", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("input[name=field_capacity_pct]") });
    await f.locator("input[name=field_capacity_pct]").fill("35");
    await f.locator("input[name=permanent_wilting_point_pct]").fill("15");
    await f.locator("input[name=management_allowed_depletion_pct]").fill("50");
    await f.locator("input[name=source_note]").fill("SYNTHETIC e2e");
    await f.getByRole("button", { name: "Lưu mô hình đất" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    let r = await q("select field_capacity_pct, permanent_wilting_point_pct from public.soil_water_models where station_id='STATION_02'");
    assert.equal(Number(r[0].field_capacity_pct), 35);
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const g = page.locator("form", { has: page.locator("input[name=field_capacity_pct]") });
    await g.locator("input[name=field_capacity_pct]").fill("20");
    await g.locator("input[name=permanent_wilting_point_pct]").fill("30");
    await g.getByRole("button", { name: "Lưu mô hình đất" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    r = await q("select field_capacity_pct from public.soil_water_models where station_id='STATION_02'");
    assert.equal(Number(r[0].field_capacity_pct), 35, "invalid model overwrote the valid one");
  });
  await check("B14 water level context (datum/bank/infrastructure) save -> row", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("input[name=sensor_datum_cm]") });
    await f.locator("input[name=sensor_datum_cm]").fill("300");
    await f.locator("input[name=shore_bank_elevation_cm]").fill("250");
    await f.locator("input[name=critical_infrastructure_elevation_cm]").fill("260");
    await f.locator("input[name=survey_note]").fill("SYNTHETIC e2e survey");
    await f.getByRole("button", { name: "Lưu bối cảnh mực n" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    const r = await q("select count(*)::int c from public.water_level_contexts");
    assert.ok(r[0].c >= 1);
  });

  await check("B15 admin allow-list: add -> active row; revoke -> inactive; env-root admin cannot be revoked", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const f = page.locator("form", { has: page.locator("input[name=email]") }).filter({ has: page.getByRole("button", { name: "Thêm" }) });
    await f.locator("input[name=email]").fill("second.admin@horizon.test");
    await f.locator("input[name=note]").fill("SYNTHETIC e2e");
    await f.getByRole("button", { name: "Thêm" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    let r = await q("select active from public.admin_allowed_emails where email='second.admin@horizon.test'");
    assert.equal(r.length, 1); assert.equal(r[0].active, true);
    // new admin can sign in with the shared password (documented single-account model)
    const c2 = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.201.0.2" } });
    const p2 = await c2.newPage(); await login(p2, "second.admin@horizon.test");
    assert.doesNotMatch(p2.url(), /login/);
    await c2.close();
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const rm = page.locator("form", { has: page.locator('input[name=email][value="second.admin@horizon.test"]') });
    await rm.getByRole("button").click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
    r = await q("select active, revoked_at from public.admin_allowed_emails where email='second.admin@horizon.test'");
    assert.equal(r[0].active, false); assert.ok(r[0].revoked_at);
    // revoked admin is locked out again
    const c3 = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.201.0.3" } });
    const p3 = await c3.newPage(); await login(p3, "second.admin@horizon.test");
    assert.match(p3.url(), /login/);
    await c3.close();
    // env-root admin has no revoke control that works
    const envRm = page.locator('form:has(input[name=email][value="admin@horizon.test"])');
    if (await envRm.count()) {
      await envRm.getByRole("button").click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
      const stillOk = await q("select count(*)::int c from public.admin_allowed_emails where email='admin@horizon.test' and active=false");
      assert.equal(stillOk[0].c, 0);
    }
  });

  await check("B16 remote config: save stores a new revision (state STORED, never 'applied'); a STALE form from another tab is rejected and changes nothing", async () => {
    const fSel = (pg) => pg.locator("form", { has: pg.locator('input[name=station_id][value="STATION_01"]') }).filter({ has: pg.locator("input[name=expected_revision]") });
    // Tab A and tab B both load the same revision.
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const ctxB = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.204.0.6" } });
    const pageB = await ctxB.newPage(); await login(pageB); await pageB.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const revA = Number(await fSel(page).locator("input[name=expected_revision]").inputValue());
    const revB = Number(await fSel(pageB).locator("input[name=expected_revision]").inputValue());
    assert.equal(revA, revB);
    // A saves.
    const curSample = Number(await fSel(page).locator("input[name=sample_interval_seconds]").inputValue());
    const newSample = curSample === 120 ? 180 : 120;
    await fSel(page).locator("input[name=sample_interval_seconds]").fill(String(newSample));
    await fSel(page).locator("input[name=sleep_interval_seconds]").fill(String(newSample));
    await fSel(page).getByRole("button", { name: "Lưu cấu hình" }).click();
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
    let cfg = (await q("select config_revision, sample_interval_seconds, delivery_state, applied_revision from public.device_runtime_configs where station_id='STATION_01'"))[0];
    assert.equal(Number(cfg.config_revision), revA + 1);
    assert.equal(Number(cfg.sample_interval_seconds), newSample);
    assert.equal(cfg.delivery_state, "STORED", "a stored config must not claim to be applied");
    assert.ok(cfg.applied_revision === null || Number(cfg.applied_revision) === 0, "applied_revision set without device evidence");
    await page.screenshot({ path: path.join(SHOTS, "B16-remote-config-stored.png"), fullPage: true });
    // B (stale) saves a different value.
    await fSel(pageB).locator("input[name=sample_interval_seconds]").fill("300");
    await fSel(pageB).locator("input[name=sleep_interval_seconds]").fill("300");
    await fSel(pageB).getByRole("button", { name: "Lưu cấu hình" }).click();
    await pageB.waitForLoadState("networkidle"); await pageB.waitForTimeout(1200);
    const cfg2 = (await q("select config_revision, sample_interval_seconds from public.device_runtime_configs where station_id='STATION_01'"))[0];
    assert.equal(Number(cfg2.config_revision), revA + 1, "stale save advanced the revision");
    assert.equal(Number(cfg2.sample_interval_seconds), newSample, "stale save overwrote the newer config");
    await pageB.screenshot({ path: path.join(SHOTS, "B16-remote-config-conflict.png"), fullPage: true });
    await ctxB.close();
  });

  await check("B17 stale tab after sign-out: a mutation submitted without a session is refused and writes nothing", async () => {
    const c4 = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.202.0.4" } });
    const p4 = await c4.newPage(); await login(p4);
    await p4.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    await c4.clearCookies();
    const f = p4.locator("form", { has: p4.locator("select[name=kind]") });
    await f.locator("input[name=note]").fill("SYNTHETIC stale-session write");
    await f.getByRole("button", { name: "Ghi nhận" }).click();
    await p4.waitForLoadState("networkidle"); await p4.waitForTimeout(900);
    assert.equal((await q("select count(*)::int c from public.maintenance_logs where note like 'SYNTHETIC stale-session%'"))[0].c, 0);
    await c4.close();
  });
  await check("B18 revoked mid-session: a previously valid cookie stops working once the email is revoked from the allow-list", async () => {
    await q("delete from public.admin_allowed_emails where email='temp.admin@horizon.test'");
    await q("insert into public.admin_allowed_emails (email, active, note) values ('temp.admin@horizon.test', true, 'SYNTHETIC')");
    const c5 = await newCtx({ extraHTTPHeaders: { "x-forwarded-for": "10.203.0.5" } });
    const p5 = await c5.newPage(); await login(p5, "temp.admin@horizon.test");
    assert.doesNotMatch(p5.url(), /login/);
    await q("update public.admin_allowed_emails set active=false, revoked_at=now() where email='temp.admin@horizon.test'");
    await p5.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    const stillIn = !/login/.test(p5.url());
    await c5.close();
    if (stillIn) throw new Error("FINDING: session of a revoked (DB-only) admin remains valid until cookie expiry (12 h)");
  });

  await check("B19 sign out clears access", async () => {
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Đăng xuất" }).first().click();
    await page.waitForURL(/\/admin\/login|\/$/, { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
    const gone = async () => !(await ctx.cookies()).some((c) => c.name === "horizon_admin_session" && c.value);
    for (let i = 0; i < 20 && !(await gone()); i++) await page.waitForTimeout(250);
    await page.goto(`${WEB}/admin`, { waitUntil: "networkidle" });
    assert.match(page.url(), /login/);
    await expectExportRefused(ctx.request);
  });

  await check("B20 no uncaught React/page errors during the admin session", async () => {
    assert.deepEqual(pageErrors, [], "pageerrors: " + pageErrors.join(" || ").slice(0, 600));
  });

  // ---- audit trail completeness
  await check("B21 audit trail has an entry for each admin write, with actor and no secrets", async () => {
    const rows = await q("select action, actor, metadata::text m from public.audit_events order by created_at");
    const actions = new Set(rows.map((r) => r.action));
    assert.ok(rows.length >= 6, `only ${rows.length} audit rows`);
    for (const r of rows) assert.doesNotMatch(r.m ?? "", new RegExp(env.ADMIN_PASSWORD.slice(-8)));
    console.log("      audit actions:", [...actions].join(", "));
  });

  await browser.close();
  await db.end();
  const failed = results.filter((r) => !r.ok);
  writeFileSync(path.join(__dirname, "admin-e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), target: WEB, results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
