/**
 * Browser-level QA for the public journeys: Field Notes navigation, the
 * community-report evidence flow, double-submit protection, responsive
 * overflow, and the admin authorization boundary.
 *
 * HOW TO RUN (against a production build, nothing is written to Supabase):
 *   npm run build -w @eco-sense/web
 *   npm run start -w @eco-sense/web          # http://localhost:4173
 *   npm run qa:public-browser                # in a second terminal
 *
 * WHAT IS REAL AND WHAT IS NOT. The page, the form and every client-side
 * decision run for real in a browser. The network calls the report flow makes
 * (/api/public/reports, the signed Storage URL, /media) are INTERCEPTED here,
 * so this proves the browser behaves correctly given server answers — it does
 * not prove Supabase Storage accepts the upload. That needs a real bucket and
 * is tracked in docs/QA_FLOW_MATRIX.md as an unverified item.
 *
 * Env: BASE_URL (default http://localhost:4173), HORIZON_CHROMIUM_PATH (explicit browser binary), HORIZON_BROWSER_CHANNEL
 * (e.g. "msedge" or "chrome"; default: bundled Chromium),
 * HORIZON_PLAYWRIGHT_MODULE, QA_SHOTS_DIR.
 */
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.HORIZON_PLAYWRIGHT_MODULE || "playwright");

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const SHOTS = process.env.QA_SHOTS_DIR || path.resolve(__dirname, "../docs/qa/screenshots");
mkdirSync(SHOTS, { recursive: true });

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error && error.message ? error.message : error) });
    console.log(`FAIL  ${name}\n      ${String(error && error.message ? error.message : error).split("\n")[0]}`);
  }
}

const VIEWPORTS = [
  { label: "mobile-390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { label: "desktop-1440", width: 1440, height: 900 },
];

// Scroll-reveal and enter animations are time/scroll driven; a screenshot
// taken immediately after navigation catches them half-faded.
async function settle(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += Math.max(400, innerHeight / 2)) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

async function openFilledReport(page) {
  await page.goto(`${BASE}/report`, { waitUntil: "networkidle" });
  await page.locator(".report-station-choice").first().click();
  await page.locator("label:has(input[name=category])").first().click();
  await page.locator("#description").fill("Bờ sông sạt lở khoảng ba mét gần trạm nước, cần kiểm tra.");
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.HORIZON_BROWSER_CHANNEL || undefined, executablePath: process.env.HORIZON_CHROMIUM_PATH || undefined });
  const consoleErrors = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      locale: "vi-VN",
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`[${vp.label}] ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`[${vp.label}] pageerror ${error.message}`));
    page.on("response", (response) => {
      // Vercel Web Analytics is only served on Vercel; locally it 404s by design.
      if (response.status() >= 400 && !/\/_vercel\/|fake-storage\.test/.test(response.url())) consoleErrors.push(`[${vp.label}] HTTP ${response.status()} ${response.url()}`);
    });

    await check(`${vp.label}: Field Notes cards are links to existing articles`, async () => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const links = page.locator('#ghi-chep a[href^="/posts/"]');
      assert.ok((await links.count()) >= 6, "every note must be reachable from the carousel");
      const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
      for (const href of hrefs) {
        const response = await page.request.get(`${BASE}${href}`);
        assert.equal(response.status(), 200, `${href} must resolve`);
      }
      await settle(page);
      await links.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(SHOTS, `home-field-notes-${vp.label}.png`) });
      await links.first().click();
      await page.waitForURL(/\/posts\//);
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok((await page.locator(".prose-horizon p").count()) > 0, "article body rendered");
      await page.locator('a[href="/#ghi-chep"]').first().click();
      await page.waitForURL(/\/#ghi-chep|\/$/);
    });

    await check(`${vp.label}: no horizontal overflow on public pages`, async () => {
      for (const route of ["/", "/dashboard", "/report", "/admin/login"]) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${route} overflows by ${overflow}px`);
      }
    });

    await check(`${vp.label}: dashboard soil-signals box replaces gateway signal/battery (demo mode)`, async () => {
      await page.goto(`${BASE}/dashboard?mode=demo`, { waitUntil: "networkidle" });
      await settle(page);
      const bento = page.locator(".observatory-bento");
      await bento.waitFor();
      const text = await bento.innerText();
      assert.match(text, /EC đất/i);
      assert.match(text, /Nhiệt độ đất/i);
      assert.ok(!/Tín hiệu|Pin\b/.test(text), "gateway signal/battery must be gone from the Bento");
      await bento.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `dashboard-demo-${vp.label}.png`), fullPage: true });
    });

    await check(`${vp.label}: dashboard real mode without data shows no zeros or healthy claims`, async () => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await settle(page);
      const text = await page.locator(".observatory-bento").innerText();
      assert.ok(!/\b0\.0+\b/.test(text.replace(/\d{1,2}[:.]\d{2}/g, "")), "a missing value must not render as 0");
      await page.screenshot({ path: path.join(SHOTS, `dashboard-real-nodata-${vp.label}.png`), fullPage: true });
    });

    await check(`${vp.label}: video + report goes direct to Storage in a small JSON request, then is confirmed`, async () => {
      const seen = { reportBodies: [], puts: 0, finalize: 0 };
      await page.route("**/api/public/reports", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        seen.reportBodies.push(route.request().postData() || "");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            id: "QA_REPORT_1",
            uploadTicket: "ticket.qa",
            uploads: [{ index: 0, name: "clip.mp4", path: "reports/QA_REPORT_1/a.mp4", token: "t", signedUrl: "https://fake-storage.test/upload/a?token=t", mimeType: "video/mp4" }],
            media: [],
            mediaFailures: [],
          }),
        });
      });
      await page.route("https://fake-storage.test/**", async (route) => {
        seen.puts += 1;
        await route.fulfill({ status: 200, body: "{}" });
      });
      await page.route("**/api/public/reports/*/media", async (route) => {
        seen.finalize += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, media: [{ path: "reports/QA_REPORT_1/a.mp4", id: "M1", media_type: "video" }], problems: [] }),
        });
      });
      await openFilledReport(page);
      await page.locator('input[type=file][accept*="video/mp4"]').setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(6 * 1024 * 1024, 1) });
      await page.screenshot({ path: path.join(SHOTS, `report-with-video-${vp.label}.png`), fullPage: true });
      await page.getByRole("button", { name: /Gửi báo cáo/ }).click();
      await page.getByText("Đã ghi nhận hiện trường").waitFor();
      assert.equal(seen.reportBodies.length, 1);
      assert.ok(seen.reportBodies[0].length < 4096, `report request must not carry file bytes (was ${seen.reportBodies[0].length})`);
      assert.equal(seen.puts, 1, "video PUT directly to the signed URL");
      assert.equal(seen.finalize, 1, "server asked to confirm the upload");
      await page.getByText("1/1").waitFor();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, `report-success-${vp.label}.png`), fullPage: true });
      await page.unroute("**/api/public/reports");
      await page.unroute("https://fake-storage.test/**");
      await page.unroute("**/api/public/reports/*/media");
    });

    await check(`${vp.label}: a failed upload is reported as partial success, never as saved`, async () => {
      await page.route("**/api/public/reports", (route) =>
        route.request().method() !== "POST"
          ? route.fallback()
          : route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                id: "QA_REPORT_2",
                uploadTicket: "ticket.qa",
                uploads: [{ index: 0, name: "clip.mp4", path: "reports/QA_REPORT_2/a.mp4", token: "t", signedUrl: "https://fake-storage.test/upload/b?token=t", mimeType: "video/mp4" }],
              }),
            }),
      );
      await page.route("https://fake-storage.test/**", (route) => route.fulfill({ status: 500, body: "boom" }));
      await openFilledReport(page);
      await page.locator('input[type=file][accept*="video/mp4"]').setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024 * 1024, 1) });
      await page.getByRole("button", { name: /Gửi báo cáo/ }).click();
      await page.getByText("Đã ghi nhận hiện trường").waitFor();
      await page.getByRole("alert").filter({ hasText: "chưa tải lên" }).waitFor();
      assert.equal(await page.getByText("Chưa tải lên").count() > 0, true);
      assert.equal(await page.getByText("Đã lưu").count(), 0, "failed file must not be labelled saved");
      assert.ok(await page.getByRole("button", { name: /Thử tải lại/ }).isVisible(), "retry offered on the same report");
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, `report-partial-${vp.label}.png`), fullPage: true });
      await page.unroute("**/api/public/reports");
      await page.unroute("https://fake-storage.test/**");
    });

    await check(`${vp.label}: double-click on submit creates one report`, async () => {
      let posts = 0;
      await page.route("**/api/public/reports", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "QA_REPORT_3" }) });
      });
      await openFilledReport(page);
      const submit = page.getByRole("button", { name: /Gửi báo cáo/ });
      await submit.dblclick();
      await page.getByText("Đã ghi nhận hiện trường").waitFor();
      assert.equal(posts, 1);
      await page.unroute("**/api/public/reports");
    });

    await check(`${vp.label}: unsupported and oversize files are refused with a reason before upload`, async () => {
      await openFilledReport(page);
      const input = page.locator('input[type=file][accept*="video/mp4"]');
      await input.setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
      await page.getByRole("alert").filter({ hasText: "chưa được hỗ trợ" }).waitFor();
      await input.setInputFiles({ name: "big.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(21 * 1024 * 1024, 1) });
      await page.getByRole("alert").filter({ hasText: "vượt giới hạn" }).waitFor();
      assert.equal(await page.locator(".evidence-previews li").count(), 0);
    });

    await check(`${vp.label}: admin and its export are not reachable without a session`, async () => {
      for (const route of ["/admin", "/admin/export?dataset=soil"]) {
        const response = await page.request.get(`${BASE}${route}`, { maxRedirects: 0 });
        assert.ok([302, 303, 307, 308].includes(response.status()), `${route} gave ${response.status()}`);
        assert.match(response.headers()["location"] || "", /\/admin\/login/);
      }
      const forged = await page.request.post(`${BASE}/api/public/reports/QA/media`, {
        data: { ticket: "forged.ticket", action: "finalize", paths: ["reports/QA/x.mp4"] },
      });
      assert.equal(forged.status(), 403);
    });

    await context.close();
  }

  await browser.close();

  const realConsoleErrors = consoleErrors.filter((line) => !/fake-storage\.test|_vercel\/insights|Failed to load resource/.test(line));
  results.push({ name: "no unexpected console errors", ok: realConsoleErrors.length === 0, error: realConsoleErrors.slice(0, 5).join(" | ") });
  console.log(realConsoleErrors.length === 0 ? "PASS  no unexpected console errors" : `FAIL  console errors:\n  ${realConsoleErrors.slice(0, 5).join("\n  ")}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
