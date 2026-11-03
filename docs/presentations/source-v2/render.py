#!/usr/bin/env python3
"""Render slide sections to PNG (per slide) and a vector PDF. Usage: render.py <srcdir> <outdir>"""
import re, sys, os, json, subprocess, shutil
src, out = sys.argv[1], sys.argv[2]
S = os.path.dirname(os.path.abspath(__file__))
assets = S + "/assets"
os.makedirs(out, exist_ok=True)
deck = json.load(open(src + "/deck.json"))
css = open(S + "/fonts/local.css").read().replace("url(", "url(file://" + S + "/fonts/")
base = css + """
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#777}
.stage{width:1920px;height:1080px;position:relative;overflow:hidden;page-break-after:always;break-after:page}
.stage>section{position:relative;width:1920px;height:1080px;overflow:hidden}
h1,h2,h3,p,ul,ol,li{margin:0}
h1{font-size:96px;font-weight:600;line-height:1.1}h2{font-size:64px;font-weight:600;line-height:1.15}h3{font-size:44px;font-weight:600;line-height:1.2}
p{font-size:32px;line-height:1.4}
aside{display:none}
table{border-collapse:collapse}td,th{padding:.35em .6em;border:1px solid #d6cdbb;vertical-align:top;text-align:left}th{font-weight:600}
@page{size:1920px 1080px;margin:0}
@media print{html,body{background:none}}
"""
pages = []
for sid in deck["order"]:
    h = open(f"{src}/slides/{sid}.html").read()
    h = re.sub(r"\{\{img:([^}]+)\}\}", lambda m: "file://" + assets + "/" + m.group(1), h)
    pages.append((sid, h))
open(out + "/all.html", "w").write("<!doctype html><meta charset=utf-8><style>" + base + "</style>" +
    "".join(f'<div class="stage" id="stage-{sid}">{h}</div>' for sid, h in pages))
js = f"""
const {{ chromium }} = require('playwright');
(async()=>{{
 const b = await chromium.launch({{executablePath:'' + (process.env.CHROME || '') + '', args:['--allow-file-access-from-files']}});
 const p = await b.newPage({{viewport:{{width:1920,height:1080}}}});
 await p.goto('file://{out}/all.html'); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
 const ids = {json.dumps(deck['order'])};
 for (const id of ids) {{
   const el = await p.$('#stage-'+id); await el.screenshot({{path:'{out}/'+id+'.png'}});
 }}
 // overflow probe: report any element whose box exceeds its slide or text overflowing its own box
 const probe = await p.evaluate(()=>{{
   const res=[]; document.querySelectorAll('.stage').forEach(st=>{{
     const sr=st.getBoundingClientRect();
     st.querySelectorAll('section *').forEach(el=>{{
       if(el.tagName==='ASIDE'||el.tagName==='SVG'||el.closest('svg')) return;
       const r=el.getBoundingClientRect(); if(r.width===0||r.height===0) return;
       const off = r.right>sr.right+2||r.bottom>sr.bottom+2||r.left<sr.left-2||r.top<sr.top-2;
       const ov = el.scrollWidth>el.clientWidth+2 && getComputedStyle(el).overflow!=='visible';
       if(off) res.push([st.id, el.tagName, (el.textContent||'').slice(0,30), Math.round(r.left-sr.left), Math.round(r.top-sr.top), Math.round(r.right-sr.left), Math.round(r.bottom-sr.top)]);
     }});
   }}); return res;}});
 console.log('OFFCANVAS', JSON.stringify(probe));
 await p.pdf({{path:'{out}/deck.pdf', width:'1920px', height:'1080px', printBackground:true, preferCSSPageSize:true}});
 await b.close();
}})();
"""
open(out + "/r.cjs", "w").write(js)
r = subprocess.run(["node", out + "/r.cjs"], capture_output=True, text=True)
print(r.stdout[-1500:], r.stderr[-800:])
