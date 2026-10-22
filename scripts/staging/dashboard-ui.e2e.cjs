// Dashboard revision checks: banner gone, 2x1 soil cards, status markup, map credits, hero, responsive, axe.
// Usage: BASE_ON=http://127.0.0.1:3100 (fixture on) BASE_OFF=http://127.0.0.1:3101 (fixture off) HORIZON_CHROMIUM_PATH=... node ...
const { chromium } = require("playwright");
const fs = require("node:fs");
const ON = process.env.BASE_ON || "http://127.0.0.1:3100", OFF = process.env.BASE_OFF || "http://127.0.0.1:3101";
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HORIZON_CHROMIUM_PATH, args: ["--no-sandbox"] });
  for (const [label, base] of [["fixture ON", ON], ["fixture OFF", OFF]]) {
    for (const [vn, w, h] of [["mobile", 390, 844], ["tablet", 820, 1100], ["desktop", 1440, 900]]) for (const scheme of ["light", "dark"]) {
      const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, locale: "vi-VN" });
      const p = await c.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 90)));
      await p.goto(base + "/dashboard", { waitUntil: "networkidle", timeout: 120000 }); await p.waitForTimeout(1500);
      const t = `${label} ${vn} ${scheme}`;
      const body = await p.evaluate(() => document.body.innerText);
      check(`${t}: no dev banner / fake-data banner`, !/BẢN XEM TRƯỚC DEV|DEV PREVIEW/.test(body) && !(await p.$("[data-dev-fixture-banner]")));
      const g = await p.evaluate(() => { const r = (id) => { const e = document.querySelector(`[data-testid=${id}]`); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), txt: e.innerText.replace(/\n+/g, " | ") }; }; return { a: r("soil-card-conditions"), b: r("soil-card-chemistry"), ov: document.documentElement.scrollWidth > innerWidth + 1 }; });
      check(`${t}: two soil cards identical size`, g.a && g.b && g.a.w === g.b.w && g.a.h === g.b.h, JSON.stringify([g.a?.w, g.a?.h, g.b?.w, g.b?.h]));
      check(`${t}: no horizontal overflow`, !g.ov);
      if (label === "fixture OFF") check(`${t}: no soil value without real data (no zero, no fixture)`, g.a && /—/.test(g.a.txt) && !/\b0\b/.test(g.a.txt) && !/34\.2/.test(g.a.txt), g.a?.txt);
      else if (vn === "desktop" && scheme === "light") check(`${t}: fixture values show in dev`, g.a && /34\.2/.test(g.a.txt) && /28\.6/.test(g.b.txt + g.a.txt), g.a?.txt + " // " + g.b?.txt);
      if (label === "fixture ON" && vn === "desktop") check(`${t}: chemistry card shows bulk EC with mS/cm and pH, not salinity`, /EC KHỐI|EC khối/i.test(g.b.txt) && /mS\/cm/.test(g.b.txt) && !/MẶN/i.test(g.b.txt), g.b?.txt);
      await p.addScriptTag({ content: axeSrc });
      const ax = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }); return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id + ":" + v.nodes.length); });
      check(`${t}: axe serious/critical`, ax.length === 0, ax.join(","));
      check(`${t}: no page errors`, errs.length === 0, errs.join(";"));
      if (vn === "desktop" && scheme === "light" && label === "fixture ON") {
        check("map shows no inline attribution text", !(await p.evaluate(() => !!document.querySelector(".leaflet-control-attribution"))));
        const btn = p.locator(".horizon-map-credits-btn").first(); await btn.scrollIntoViewIfNeeded(); await btn.click();
        const credit = await p.locator(".horizon-map-credits-panel").innerText();
        check("map credits panel opens with Leaflet, Esri and OpenStreetMap links", /Leaflet/.test(credit) && /Esri/.test(credit) && /OpenStreetMap/.test(credit) && (await p.locator(".horizon-map-credits-panel a").count()) >= 3, credit);
        await p.keyboard.press("Escape");
      }
      await c.close();
    }
  }
  const fails = results.filter((r) => !r.ok).length; console.log(`${results.length - fails}/${results.length} passed`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
