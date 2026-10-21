// REAL offline test for the service worker. Playwright's context.setOffline() does NOT apply to service-worker fetches, so it
// cannot prove offline behaviour; this script starts its own production server, warms the cache, then KILLS the server.
// Usage (from repo root, after `next build`): node scripts/staging/offline-sw.e2e.cjs
// Env: HORIZON_CHROMIUM_PATH, PORT (default 3102), NEXT_DIST_DIR (if the build used a different distDir) + the app's usual env.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const PORT = process.env.PORT || "3102", B = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
(async () => {
  const server = spawn("npx", ["next", "start", "--port", PORT], { cwd: path.resolve(__dirname, "../../apps/web"), env: process.env, stdio: "ignore", detached: true });
  const stop = () => { try { process.kill(-server.pid, "SIGKILL"); } catch {} };
  process.on("exit", stop);
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B + "/offline")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
  const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(B + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 15000))]));
  for (const p of ["/dashboard", "/report", "/admin/login"]) { await page.goto(B + p, { waitUntil: "networkidle" }); await page.waitForTimeout(1500); }
  await page.reload({ waitUntil: "networkidle" });
  check("service worker registered and controlling", await page.evaluate(() => !!navigator.serviceWorker.controller));
  const cached = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) out.push(new URL(r.url).pathname); return out; });
  check("no /admin or /api response is stored in any browser cache", !cached.some((u) => u.startsWith("/admin") || u.startsWith("/api/")), cached.filter((u) => /^\/(admin|api)/.test(u)).join(","));
  stop(); await new Promise((r) => setTimeout(r, 1500));
  let down = false; try { await fetch(B + "/offline", { signal: AbortSignal.timeout(2000) }); } catch { down = true; }
  check("server is really down", down);
  const text = async (u) => { const r = await page.goto(B + u, { waitUntil: "domcontentloaded", timeout: 20000 }); return { status: r.status(), text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ") }; };
  for (const u of ["/dashboard", "/report", "/"]) { const r = await text(u).catch((e) => ({ status: 0, text: String(e.message) })); check(`visited ${u} renders offline from cache`, r.status === 200 && !/ngoại tuyến|offline/i.test(r.text.slice(0, 60)) || (u === "/" && r.status === 200), `${r.status} ${r.text.slice(0, 50)}`); }
  for (const u of ["/offline", "/never-visited", "/posts/never-visited-slug"]) { const r = await text(u).catch((e) => ({ status: 0, text: String(e.message) })); check(`${u} shows the offline page (200), not a 404 or a browser error`, r.status === 200 && /ngoại tuyến/.test(r.text) && !/không tìm thấy|not found/i.test(r.text), `${r.status} ${r.text.slice(0, 50)}`); }
  await browser.close(); stop();
  fs.writeFileSync(path.join(__dirname, "offline-sw.e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
})();
