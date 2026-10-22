// Theme (single icon button, OS-detected, local-time fallback) and language (single VI/EN button,
// explicit > browser > fallback) behaviour in a real browser.
// Usage: BASE_URL=http://127.0.0.1:3100 HORIZON_CHROMIUM_PATH=... node scripts/staging/theme-lang.e2e.cjs
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path");
const B = process.env.BASE_URL || "http://127.0.0.1:3100";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
// The theme button is named for its DESTINATION; the language button for the other language.
const themeBtn = (page) => page.locator('button[aria-label*="theme" i], button[aria-label*="giao diện" i]').first();
const langBtn = (page) => page.locator('button[aria-label*="English" i], button[aria-label*="tiếng Anh" i], button[aria-label*="Vietnamese" i], button[aria-label*="tiếng Việt" i]').first();
const themeLabel = async (page) => { await page.waitForFunction(() => { const b = document.querySelector('button[aria-label*="theme" i], button[aria-label*="giao diện" i]'); return !!b; }, null, { timeout: 15000 }).catch(() => {}); return (await themeBtn(page).getAttribute("aria-label").catch(() => null)) || ""; };
const state = (page) => page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("horizon-theme"), canvas: getComputedStyle(document.documentElement).getPropertyValue("--h-canvas").trim() || getComputedStyle(document.body).backgroundColor }));
const lumOf = (c) => { const h = c.replace("#", ""); if (h.length === 6) return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255; const m = c.match(/(\d+)[ ,]+(\d+)[ ,]+(\d+)/); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : NaN; };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const open = async (opts) => { const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 100))); return { ctx, page, errors }; };

  // ---- THEME: one icon button
  for (const scheme of ["dark", "light"]) {
    const { ctx, page, errors } = await open({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    const s = await state(page);
    check(`new visitor, OS=${scheme}: no explicit choice stored, follows the OS`, s.attr === null && s.stored === null, JSON.stringify(s));
    const label = await themeLabel(page);
    const wantNext = scheme === "dark" ? /light|sáng/i : /dark|tối/i;
    check(`OS=${scheme}: the button offers the opposite theme`, wantNext.test(label), label);
    check(`OS=${scheme}: canvas matches the OS`, scheme === "dark" ? lumOf(s.canvas) < 0.35 : lumOf(s.canvas) > 0.8, `${s.canvas}`);
    check(`OS=${scheme}: no System option anywhere in the header`, (await page.locator('[role=radio], button').filter({ hasText: /system|hệ thống/i }).count()) === 0);
    check(`OS=${scheme}: no hydration errors`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ colorScheme: "light", viewport: { width: 1280, height: 800 } });
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    await themeLabel(page);
    await themeBtn(page).click();
    await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
    let s = await state(page);
    check("one press on a light OS switches to dark, stored explicitly", s.attr === "dark" && s.stored === "dark", JSON.stringify(s));
    check("after the press the button now offers light", /light|sáng/i.test(await themeLabel(page)), await themeLabel(page));
    await page.reload({ waitUntil: "domcontentloaded" });
    const early = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check("after reload the explicit theme is applied before first paint", early === "dark", String(early));
    await page.waitForLoadState("networkidle");
    await themeLabel(page);
    await themeBtn(page).click();
    await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
    s = await state(page);
    check("second press returns to light and stores it", s.attr === "light" && s.stored === "light", JSON.stringify(s));
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(300);
    s = await state(page);
    check("explicit light is NOT overridden when the OS changes to dark", s.attr === "light" && lumOf(s.canvas) > 0.8, JSON.stringify(s));
    check("theme interactions raise no page errors", errors.length === 0, errors.join(";"));
    await ctx.close();
  }
  for (const [hour, want] of [[7, "light"], [17, "light"], [18, "dark"], [3, "dark"]]) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript((h) => {
      window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      const RD = Date; Date = class extends RD { getHours() { return h; } };
    }, hour);
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(`no OS preference available, local hour ${hour}: ${want}`, attr === want, String(attr));
    await ctx.close();
  }

  // ---- LANGUAGE: one VI/EN button
  const lang = async (opts, url = "/") => { const { ctx, page, errors } = await open(opts); await page.goto(B + url, { waitUntil: "networkidle" }); return { lang: await page.evaluate(() => document.documentElement.lang), errors, page, ctx }; };
  let r = await lang({ locale: "en-US", extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });
  check("no cookie + browser English -> English", r.lang === "en", r.lang); await r.ctx.close();
  r = await lang({ locale: "vi-VN", extraHTTPHeaders: { "accept-language": "vi-VN,vi;q=0.9,en;q=0.5" } });
  check("no cookie + browser Vietnamese -> Vietnamese", r.lang === "vi", r.lang); await r.ctx.close();
  r = await lang({ extraHTTPHeaders: { "accept-language": "fr-FR,fr;q=0.9" } });
  check("no cookie + unsupported language -> documented fallback (Vietnamese)", r.lang === "vi", r.lang); await r.ctx.close();
  {
    const { ctx, page } = await open({ extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });
    await ctx.addCookies([{ name: "horizon-locale", value: "vi", url: B }]);
    await page.goto(B + "/", { waitUntil: "networkidle" });
    check("explicit cookie (vi) beats a browser that prefers English", (await page.evaluate(() => document.documentElement.lang)) === "vi");
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    const shown = (await langBtn(page).textContent()).trim();
    check("the language button shows the CURRENT language (VI)", shown === "VI", shown);
    await langBtn(page).click();
    await page.waitForLoadState("networkidle");
    check("one press switches to English and keeps the route", (await page.evaluate(() => document.documentElement.lang)) === "en" && new URL(page.url()).pathname === "/dashboard", page.url());
    check("the button now shows EN", (await langBtn(page).textContent()).trim() === "EN");
    check("the choice is remembered in the cookie", (await ctx.cookies()).some((c) => c.name === "horizon-locale" && c.value === "en"));
    await page.goto(B + "/", { waitUntil: "networkidle" });
    const h1 = await page.evaluate(() => document.querySelector("h1")?.innerText ?? "");
    check("Cồn Hô is never translated", /Cồn Hô/.test(h1), h1.replace(/\n/g, " "));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "theme-lang.e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), base: B, results }, null, 2));
  const failed = results.filter((x) => !x.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
})();
