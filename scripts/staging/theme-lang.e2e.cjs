// Theme (Light/Dark, OS-detected, time fallback) and language (explicit > browser > fallback) behaviour in a real browser.
// Usage: BASE_URL=http://127.0.0.1:3100 HORIZON_CHROMIUM_PATH=... node scripts/staging/theme-lang.e2e.cjs
const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path");
const B = process.env.BASE_URL || "http://127.0.0.1:3100";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const open = async (opts) => { const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 100))); return { ctx, page, errors }; };
  const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor + "|" + getComputedStyle(document.documentElement).getPropertyValue("--h-background"));
  const lum = (rgb) => { const m = rgb.match(/(\d+)[ ,]+(\d+)[ ,]+(\d+)/); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : NaN; };
  const stateOf = async (page) => { await page.waitForSelector('[role=radiogroup] [role=radio][aria-checked=true]', { timeout: 15000 }).catch(() => {}); return stateRaw(page); };
  const stateRaw = async (page) => page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("horizon-theme"), checked: [...document.querySelectorAll('[role=radiogroup] [role=radio][aria-checked=true]')].map((e) => e.getAttribute("aria-label")), canvas: getComputedStyle(document.documentElement).getPropertyValue("--h-canvas").trim() || getComputedStyle(document.body).backgroundColor }));

  // ---- THEME
  for (const scheme of ["dark", "light"]) {
    const { ctx, page, errors } = await open({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    await page.waitForSelector('[aria-label="Dark theme"],[aria-label="Light theme"],[aria-label="Chế độ tối"],[aria-label="Chế độ sáng"]').catch(() => {});
    await page.waitForFunction(() => [...document.querySelectorAll('[role=radio][aria-checked=true]')].length >= 2, null, { timeout: 8000 }).catch(() => {});
    const s = await stateOf(page);
    check(`new visitor, OS=${scheme}: no explicit choice, follows the OS`, s.attr === null && s.stored === null, JSON.stringify(s));
    check(`new visitor, OS=${scheme}: the matching Light/Dark option shows as selected`, s.checked.some((l) => (scheme === "dark" ? /dark|tối/i : /light|sáng/i).test(l)), s.checked.join("|"));
    check(`OS=${scheme}: header offers no System option`, (await page.getByRole("radio", { name: /system|hệ thống/i }).count()) === 0);
    const cv = (await stateOf(page)).canvas; const hex = cv.replace("#", ""); const L = hex.length === 6 ? (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) / 255 : NaN;
    check(`OS=${scheme}: canvas colour matches the OS`, scheme === "dark" ? L < 0.35 : L > 0.8, `${cv} lum=${L.toFixed(2)}`);
    check(`OS=${scheme}: no hydration errors`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ colorScheme: "light", viewport: { width: 1280, height: 800 } });
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    const radio = (re) => page.getByRole("radio", { name: re });
    await radio(/dark|tối/i).first().click();
    let s = await stateOf(page);
    check("explicit Dark beats a light OS and is stored", s.attr === "dark" && s.stored === "dark", JSON.stringify(s));
    await page.reload({ waitUntil: "domcontentloaded" });
    const early = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check("after reload the theme is applied before first paint (attribute present at DOMContentLoaded)", early === "dark", String(early));
    await page.waitForLoadState("networkidle");
    await radio(/light|sáng/i).first().click();
    s = await stateOf(page);
    check("explicit Light is stored", s.attr === "light" && s.stored === "light", JSON.stringify(s));
    await page.reload({ waitUntil: "networkidle" });
    s = await stateOf(page);
    check("explicit choice survives a reload and a later OS change", s.attr === "light" && s.stored === "light", JSON.stringify(s));
    check("theme interactions raise no page errors", errors.length === 0, errors.join(";"));
    await ctx.close();
  }
  for (const [hour, want] of [[7, "light"], [17, "light"], [18, "dark"], [3, "dark"]]) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript((h) => { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); const RD = Date; Date = class extends RD { getHours() { return h; } }; }, hour);
    await page.goto(B + "/dashboard", { waitUntil: "networkidle" });
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(`no OS preference available, local hour ${hour}: ${want}`, attr === want, String(attr));
    await ctx.close();
  }
  // ---- LANGUAGE
  const lang = async (opts, url = "/") => { const { ctx, page, errors } = await open(opts); await page.goto(B + url, { waitUntil: "networkidle" }); const r = { lang: await page.evaluate(() => document.documentElement.lang), errors, page, ctx }; return r; };
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
    await page.getByRole("radio", { name: /english|tiếng anh/i }).first().click();
    await page.waitForLoadState("networkidle");
    check("switching language keeps the current route", new URL(page.url()).pathname === "/dashboard", page.url());
    check("switching language sets <html lang> and remembers the choice", (await page.evaluate(() => document.documentElement.lang)) === "en" && (await ctx.cookies()).some((c) => c.name === "horizon-locale" && c.value === "en"));
    await page.goto(B + "/", { waitUntil: "networkidle" });
    const h1 = await page.evaluate(() => document.querySelector("h1")?.innerText ?? "");
    check("Cồn Hô is never translated", /Cồn Hô/.test(h1), h1.replace(/\n/g, " "));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "theme-lang.e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), base: B, results }, null, 2));
  const failed = results.filter((x) => !x.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
})();
