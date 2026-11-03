/**
 * Accessibility (axe-core), VI/EN and PWA/offline checks against a running production build.
 * Run: BASE_URL=http://localhost:4173 node scripts/a11y-i18n-pwa-qa.cjs
 * Writes docs/qa/a11y-i18n-pwa-results.json. Reads only; no network calls to Supabase are made when
 * the build has no Supabase env. External weather requests may fail offline and are ignored.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.HORIZON_PLAYWRIGHT_MODULE || "playwright");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const PAGES = ["/", "/dashboard", "/report", "/observe", "/offline", "/posts/phan-cung-cua-mot-tram-do", "/posts/vi-sao-bat-dau-tu-do-man"];
const VIEWS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const out = { base: BASE, axe: [], i18n: [], pwa: {} };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM_PATH, args: ["--no-sandbox"] });
  for (const locale of ["vi", "en"]) {
    for (const [vname, vp] of Object.entries(VIEWS)) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.addCookies([{ name: "horizon-locale", value: locale, url: BASE }]);
      const page = await ctx.newPage();
      for (const p of PAGES) {
        try {
          await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(2500);
          await page.addScriptTag({ content: axeSource });
          const r = await page.evaluate(async () => {
            const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
            return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0] && v.nodes[0].target.join(" ").slice(0, 120) }));
          });
          out.axe.push({ locale, view: vname, page: p, violations: r });
          if (vname === "desktop") {
            const txt = await page.evaluate(() => document.body.innerText);
            const lang = await page.evaluate(() => document.documentElement.lang);
            const vi = (txt.match(/[^\n]*[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ][^\n]*/g) || []).map((s) => s.trim()).filter((s) => !/^(Cồn Hô|Vĩnh Long|HORIZON)/.test(s)).slice(0, 12);
            out.i18n.push({ locale, page: p, htmlLang: lang, vietnameseLines: vi });
          }
        } catch (e) { out.axe.push({ locale, view: vname, page: p, error: String(e.message).split("\n")[0] }); }
      }
      await ctx.close();
    }
  }
  // PWA + offline
  const ctx = await browser.newContext({ viewport: VIEWS.mobile, serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const man = await page.goto(BASE + "/manifest.webmanifest");
  const manifest = await man.json();
  out.pwa.manifest = { status: man.status(), name: manifest.name, display: manifest.display, icons: [] };
  for (const i of manifest.icons) { const r = await page.request.get(BASE + i.src); out.pwa.manifest.icons.push({ src: i.src, status: r.status() }); }
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(res, 15000))]));  // never hang if no worker registers
  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  out.pwa.serviceWorker = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { registered: !!r, scope: r && r.scope, controlled: !!navigator.serviceWorker.controller }; });
  await ctx.setOffline(true);
  out.pwa.offline = [];
  for (const p of ["/", "/dashboard", "/report", "/nonexistent-offline-page"]) {
    try {
      await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 15000 });
      const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 140);
      out.pwa.offline.push({ page: p, rendered: true, text: t });
    } catch (e) { out.pwa.offline.push({ page: p, rendered: false, error: String(e.message).split("\n")[0] }); }
  }
  await browser.close();
  fs.writeFileSync(path.resolve(__dirname, "../docs/qa/a11y-i18n-pwa-results.json"), JSON.stringify(out, null, 2));
  const bad = out.axe.flatMap((a) => (a.violations || []).filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${a.locale}/${a.view}${a.page}: ${v.id} x${v.nodes}`));
  console.log("axe serious/critical:", bad.length); bad.slice(0, 40).forEach((b) => console.log(" ", b));
  console.log("axe other:", out.axe.flatMap((a) => (a.violations || []).filter((v) => !["serious", "critical"].includes(v.impact))).length);
  console.log("errors:", out.axe.filter((a) => a.error).length);
  console.log(JSON.stringify(out.pwa, null, 1));
})();
