#!/usr/bin/env python3
"""HORIZON English funding pitch. 10 main slides + 3 appendix. Usage: build_en.py <outdir>"""
import sys
from hz import *

S = {}
TOTAL = 10

def lab(n): return progress(n, TOTAL, True)

# 1 ---------------------------------------------------------------- cover
S["cover"] = section("cover", DEEP, WHITE,
    IMG("cover-aerial.jpg", "Aerial view of Cồn Hô, a narrow green island in a wide brown river in Vĩnh Long", 0, 0, 1920, 1080) +
    '<div style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(to right, rgba(14,34,32,0.9), rgba(14,34,32,0.5) 52%, rgba(14,34,32,0) 88%)"></div>'
    '<div style="position:absolute;left:0;top:700px;width:1920px;height:380px;background:linear-gradient(to bottom, rgba(14,34,32,0), rgba(14,34,32,0.65))"></div>' +
    IMG("horizon-wordmark.png", "HORIZON logo", 128, 96, 340, 102, "contain") +
    IMG("frogsleap-sticker.png", "Frogsleap Foundation logo", 1640, 84, 152, 140, "contain") +
    H("Field notes from<br>a river island.", 128, 400, 1200, 150, WHITE, 300, 1.0, build="rise 1", ls=-5) +
    P("Measuring water, soil and air on Cồn Hô, Vĩnh Long.", 128, 770, 1000, 38, "#EDE7D8", 400, build="fade 2") +
    caption("Aerial view of Cồn Hô", 1292, 1000, 500, True, "right"),
    "I want to start with a place, not a technology. This is Cồn Hô, a river island in Vĩnh Long, in the Mekong Delta. HORIZON is a small monitoring network we are piloting here. It measures the water around the island, the soil on it, and the air above it, and it puts those readings where people can see them. It is a pilot, and I will be plain about that. I will show you what works today, what we still have to prove, and what we are asking you to help us do next.",
    data_section="The place and the idea")

# 2 ---------------------------------------------------------------- the gap
def gridlines():
    v = "".join(f'<div style="position:absolute;left:{x}px;top:0;width:2px;height:1080px;background:rgba(255,255,255,0.75)"></div>' for x in (640, 1280))
    h = "".join(f'<div style="position:absolute;left:0;top:{y}px;width:1920px;height:2px;background:rgba(255,255,255,0.75)"></div>' for y in (360, 720))
    return v + h
S["gap"] = section("gap", SILT, INK,
    IMG("hero.png", "Illustration of Cồn Hô: a long green island between two wide river branches, with three small monitoring stations", 0, 0, 1920, 1080) +
    gridlines() +
    '<div style="position:absolute;left:640px;top:360px;width:640px;height:360px;box-sizing:border-box;border:4px dashed #F28C00"></div>' +
    P("One forecast cell", 664, 372, 290, 28, "#FFFFFF", 500, extra="background:rgba(14,34,32,0.72);padding:4px 14px;box-sizing:content-box;text-shadow:0 1px 8px rgba(0,0,0,0.5)") +
    '<div style="position:absolute;left:1030px;top:530px;width:60px;height:60px;box-sizing:border-box;border:5px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 4px #F28C00"></div>' +
    P("A grower’s plot", 1106, 538, 270, 28, "#FFFFFF", 500, extra="background:rgba(14,34,32,0.72);padding:4px 14px;box-sizing:content-box;text-shadow:0 1px 8px rgba(0,0,0,0.55)", build="fade 2") +
    H("A forecast covers a grid.<br>A farm is one plot.", 128, 110, 1200, 100, INK, 300, 1.04, ls=-3, build="rise 1") +
    caption("Illustration of Cồn Hô supplied by the project. The grid is schematic.", 128, 940, 1100, False) +
    progress(2, TOTAL, False),
    "Here is the gap in one picture. Weather and river forecasts describe a cell on a grid, an area much larger than a single garden. A grower on this island needs to know about their own plot: the water at their intake, the soil around their roots. The grid on this illustration is schematic; I am not claiming a specific cell size. The point is only the difference in scale. Water, soil, and the data connection each change on their own clock. HORIZON's idea is modest: put careful measurement close to where the production happens, and keep a record of when and where each number came from.")

# 3 ---------------------------------------------------------------- approach
words = [("Measure.", "Water, soil and air", 128, 110),
         ("Send.", "By radio, then mobile data", 520, 320),
         ("Keep.", "With its time and source", 912, 530),
         ("Show.", "In public, with limits stated", 1304, 740)]
body = ""
for i, (w, c, x, y) in enumerate(words, 1):
    body += H(w, x, y, 560, 168, WHITE, 200, 1.0, build=f"rise {i}", ls=-5)
    body += P(c, x + 6, y + 176, 520, 32, SAND, 400, build=f"rise {i}")
S["approach"] = section("approach", RIVER, WHITE, body +
    '<div style="position:absolute;left:128px;top:1040px;width:0;height:0"></div>' + lab(3),
    "The whole approach fits on four verbs. Measure: probes in the water and soil read the conditions. Send: each station sends its readings by long-range radio to a gateway, which forwards them over mobile data. Keep: every value is stored with its time and its source, so anyone can ask where a number came from. Show: a public page displays the readings, and states what it does and does not know. Residents can add their own field reports to the same record, because sensors only see what they are built to measure.",)

# 4 ---------------------------------------------------------------- pilot
S["pilot"] = section("pilot", SILT, INK,
    H("Three nodes.<br>One island.", 128, 150, 580, 92, INK, 200, 1.04, ls=-3, build="rise 1") +
    P("A water station, a soil station, and a gateway that carries their data off the island.", 128, 420, 520, 34, INK, 400, build="fade 2") +
    '<div style="position:absolute;left:740px;top:130px;width:1180px;height:800px;overflow:hidden;box-shadow:0 24px 60px rgba(20,48,46,0.25)">'
    f'<img src="{{{{img:map.jpg}}}}" alt="Illustration of Cồn Hô with three marked points: water station, soil station and gateway" style="position:absolute;left:-170px;top:-120px;width:1520px;height:1076px"></div>' +
    caption("Drawn by the project. Not a satellite image.", 740, 950, 900, False) + progress(4, TOTAL, False),
    "The pilot has exactly three nodes. A water station measures level, conductivity, temperature and salinity at the river. A soil station measures moisture, conductivity, pH and temperature, plus the air above the soil. The third node is a gateway: it measures nothing itself. It receives the radio messages from the two stations and sends them over mobile data. The map is a drawing made by the project, and it is labelled as a drawing, not as satellite imagery.")

# 5 ---------------------------------------------------------------- data journey
steps = ["Probe", "Station", "Gateway", "Cloud", "Observatory"]
xs = [208, 584, 960, 1336, 1712]
strip = f'<div style="position:absolute;left:208px;top:900px;width:1504px;height:3px;background:rgba(248,244,234,0.28)"></div>'
for i, (s, x) in enumerate(zip(steps, xs), 1):
    col = DUSK if i == 5 else SAND
    strip += (f'<div data-build-in="fade {i}" style="position:absolute;left:{x-13}px;top:889px;width:26px;height:26px;border-radius:50%;background:{col}"></div>'
              f'<p data-build-in="fade {i}" style="position:absolute;left:{x-140}px;top:934px;width:280px;text-align:center;font-size:30px;font-weight:500;color:{WHITE}">{s}</p>')
S["journey"] = section("journey", RIVER, WHITE,
    H("From the river<br>to the screen.", 1180, 130, 640, 88, WHITE, 200, 1.06, ls=-3) +
    IMG("board-gateway.jpg", "Photograph of the gateway circuit board built by the project, with antenna, LoRa module, cellular module and microcontroller", 128, 96, 960, 720, "cover", "center", "box-shadow:0 24px 60px rgba(0,0,0,0.4)") +
    caption("The gateway board we built. Bench photo.", 128, 830, 900, True) +
    P("Each hop keeps the time and the source of the reading.", 1180, 400, 560, 34, "#EDE7D8", 400, build="fade 2") + strip + progress(5, TOTAL, True),
    "Follow one reading from the water to the screen. A probe measures the water. Our own fabricated station board reads it and prepares a short message. The station sends it by radio to the gateway, the board in this photograph. The gateway checks the message and forwards it over mobile data to the cloud database, and the public Observatory reads from there. The photograph is a bench shot of the gateway board, not an installed unit. One thing we have verified is that new readings from the water station reach the database about every two and a half minutes. That shows the chain works end to end. It does not yet show the readings are accurate; that is what calibration is for.")

# 6 ---------------------------------------------------------------- observatory
S["observatory"] = section("observatory", PAPER, INK,
    H("What anyone can see today.", 128, 150, 440, 72, INK, 300, 1.08, ls=-2, build="rise 1") +
    P("No login. Missing data stays missing, never zero.", 128, 470, 420, 30, MUTE_L, 400, build="fade 2") +
    '<div style="position:absolute;left:620px;top:86px;width:1300px;height:867px;overflow:hidden;border-radius:18px 0 0 18px;box-shadow:0 26px 70px rgba(20,48,46,0.28)">'
    '<img src="{{img:shot-dashboard-live.jpg}}" alt="The public HORIZON Observatory in Vietnamese: salinity and water level, a map of the three stations, a 24-hour chart, weather cards, and a soil section marked no data" style="width:1300px;height:867px"></div>' +
    caption("Public Observatory, live capture, 21 Oct 2026.", 620, 975, 900, False) + progress(6, TOTAL, False),
    "This is the public Observatory as it looked when we captured it, in Vietnamese because that is the interface the community uses. Salinity and water level from the water station are at the top left, a map of the three points sits below, and the chart covers the last twenty-four hours. Look at the soil box at the bottom left. It says there is no data. That is deliberate, and it is a rule of the product: missing data is shown as missing, never as zero. The weather cards come from an external service and are labelled that way. I will be upfront that the chart includes some long flat stretches at zero salinity. We have found them and we are investigating whether they are real or a probe reading problem. That is in the appendix. We would rather show you the real page than a polished mock-up.")

# 7 ---------------------------------------------------------------- community
S["community"] = section("community", RIVER, WHITE,
    IMG("cover-aerial.jpg", "Aerial view of Cồn Hô, darkened as a backdrop", 0, 0, 1920, 1080, "cover", "center", "") +
    '<div style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(to right, rgba(22,48,47,0.96), rgba(22,48,47,0.88) 60%, rgba(22,48,47,0.72))"></div>' +
    H("Residents add what<br>sensors cannot see.", 128, 170, 1000, 96, WHITE, 200, 1.04, ls=-3, build="rise 1") +
    P("Pick the nearest station, describe what you saw, add a photo or a short video. No account.", 128, 500, 760, 34, "#EDE7D8", 400, build="fade 2") +
    '<div style="position:absolute;left:1290px;top:80px;width:500px;height:900px;box-sizing:border-box;border:12px solid #0A1514;border-radius:56px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,0.5)">'
    '<img src="{{img:report-mobile.jpg}}" alt="The HORIZON report page on a phone: a banner reading See it, Record it, Send it, and a map to choose the nearest station" style="width:476px;height:931px;object-fit:cover;object-position:top"></div>' +
    caption("The report page on a phone.", 1290, 1000, 500, True, "center") + progress(7, TOTAL, True),
    "The sensors cover what they are built to measure. Residents see the rest: bank erosion, a stuck gate, an unusual smell. The report page is deliberately simple. No account. You choose the nearest station, say what you saw, and optionally attach a photo or a short video. If a file fails to upload, the report is still saved and marked incomplete, and the person can retry. What I can honestly say is that the flow is built and covered by automated and browser tests. What I cannot say is how many residents use it, because that has not been measured, and we have not yet confirmed large video uploads against the real production storage.")

# 8 ---------------------------------------------------------------- status
def bar(color, dashed=False):
    st = f"border-left:6px dashed {color}" if dashed else f"border-left:6px solid {color}"
    return st
S["status"] = section("status", SILT, INK,
    H("A working pilot,<br>not yet a proven<br>instrument.", 1056, 120, 780, 84, INK, 200, 1.04, ls=-3, build="rise 1") +
    A(1056, 520, 740, f'<div style="{bar(INK)};padding-left:28px"><p style="font-size:34px;font-weight:700;line-height:1.2">Working</p><p style="font-size:32px;line-height:1.35;margin-top:6px">Readings travel from the island to a public page.</p></div>', build="fade 2") +
    A(1056, 710, 740, f'<div style="{bar(DUSK_D, True)};padding-left:28px"><p style="font-size:34px;font-weight:700;line-height:1.2">Still to prove</p><p style="font-size:32px;line-height:1.35;margin-top:6px">Calibration, field validation and long-term reliability.</p></div>', build="fade 3") +
    IMG("sensor-water-ec.jpg", "Photograph of the water conductivity and temperature probe with its coiled cable", 128, 120, 832, 624, "cover", "center", "box-shadow:0 24px 60px rgba(20,48,46,0.25)") +
    caption("Water conductivity probe. Bench photo, not an installed unit.", 128, 762, 832, False) + progress(8, TOTAL, False),
    "This slide is the honest summary. What works: readings travel from the island to a public page, and the system labels what it knows. What we have not proven: the sensors are not calibrated against reference measurements, no threshold is validated for this site, and we have no long-term reliability record. The probe in the photograph is a bench photograph. The detailed findings from our own audit, including the open data issues, are in the appendix. A funder should know them before deciding, and we would rather tell you than have you find them.")

# 9 ---------------------------------------------------------------- roadmap
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3*a + 3*u*u*t*b + 3*u*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
A0, A1, A2, A3 = (128, 700), (560, 480), (760, 900), (1000, 690)
B1, B2, B3 = (1240, 480), (1560, 520), (1792, 600)
stops = [bez(A0, A1, A2, A3, 0.28), A3, bez(A3, B1, B2, B3, 0.72)]
path = f'M{A0[0]} {A0[1]} C{A1[0]} {A1[1]}, {A2[0]} {A2[1]}, {A3[0]} {A3[1]} S{B2[0]} {B2[1]}, {B3[0]} {B3[1]}'
# smooth join: reflect control point
refl = (2*A3[0]-A2[0], 2*A3[1]-A2[1])
path = f'M{A0[0]} {A0[1]} C{A1[0]} {A1[1]}, {A2[0]} {A2[1]}, {A3[0]} {A3[1]} C{refl[0]} {refl[1]}, {B2[0]} {B2[1]}, {B3[0]} {B3[1]}'
svg = (f'<svg style="position:absolute;left:0;top:0" width="1920" height="1080" viewBox="0 0 1920 1080">'
       f'<path d="{path}" fill="none" stroke="rgba(205,188,147,0.55)" stroke-width="4" stroke-linecap="round"/></svg>')
labels = [("Harden", "Close the open release checks."), ("Validate", "Calibrate on site, with expert review."), ("Use", "Support irrigation and crop decisions.")]
sx = ""
for i, ((x, y), (w, c)) in enumerate(zip(stops, labels), 1):
    col = DUSK if i == 1 else SAND
    sx += (f'<div data-build-in="fade {i}" style="position:absolute;left:{x-16:.0f}px;top:{y-16:.0f}px;width:32px;height:32px;border-radius:50%;background:{col}"></div>')
    top_word = y - 250 if i != 2 else y + 70
    lx = {1: x-56, 2: x-120, 3: 1180}[i]
    sx += H(w, lx, top_word, 520, 84, WHITE, 200, 1.0, build=f"rise {i}", ls=-3)
    sx += P(c, lx+4, top_word + 100, 640, 30, MUTE_D, 400, build=f"rise {i}")
    sx += P("[time to confirm]", lx+4, top_word + 152, 400, 24, SAND, 500, extra="text-decoration:underline", build=f"rise {i}")
S["roadmap"] = section("roadmap", RIVER, WHITE,
    H("From pilot to instrument.", 128, 110, 1200, 80, WHITE, 200, 1.04, ls=-3) + svg + sx +
    P("Who operates it long term, and the yearly cost: [to confirm]", 128, 226, 1400, 30, SAND, 500) + progress(9, TOTAL, True),
    "Here is a realistic path, and I have left the durations blank because we should not promise dates we have not planned with partners. Harden: close the release checks we already track, such as rotating device credentials, confirming large uploads on real storage, and capturing a real network trace of the gateway link. Validate: run the bench test, then a supervised field soak, calibrate on site, and work with agronomy and hydrology reviewers so any threshold we publish is validated. Use: the same stations can then support decisions for orchards, rice and shrimp. What changes is the interpretation layer. We treat carbon measurement and verification as a goal, not a claim. And for a funder, who runs this long term and what it costs each year is still to be confirmed.")

# 10 --------------------------------------------------------------- ask
def ask(lead, txt):
    return (f'<div style="border-top:1px solid rgba(248,244,234,0.25);padding:20px 0 16px"><p style="font-size:26px;font-weight:500;color:{SAND}">{lead}</p>'
            f'<p style="font-size:36px;line-height:1.3;color:{WHITE};margin-top:6px">{txt}</p></div>')
PH = lambda t: f'<span style="color:{DUSK};text-decoration:underline">[{t}]</span>'
S["ask"] = section("ask", DEEP, WHITE,
    IMG("sunset-tall.jpg", "The river beside Cồn Hô at dusk: orange sky over dark water, with a gate and poles in silhouette", 1180, 0, 740, 1080) +
    '<div style="position:absolute;left:1180px;top:0;width:300px;height:1080px;background:linear-gradient(to right, #0E2220, rgba(14,34,32,0))"></div>' +
    H("Help turn a pilot<br>into an instrument.", 128, 120, 1100, 92, WHITE, 200, 1.04, ls=-3, build="rise 1") +
    A(128, 380, 960, ask("Funding", f"{PH('Amount and period')} for calibration and upkeep.") +
      ask("Field partners", f"{PH('Growers and cooperatives')} to use the readings.") +
      ask("Science advisors", f"{PH('Agronomy and hydrology advisors')} to validate.") + '<div style="border-top:1px solid rgba(248,244,234,0.25)"></div>', build="fade 2") +
    IMG("horizon-wordmark.png", "HORIZON logo", 128, 905, 200, 60, "contain") +
    P(f"{PH('Name')} · {PH('email')} · horizon.frogsleap.com.vn", 360, 909, 800, 28, WHITE, 400) + progress(10, TOTAL, True),
    "Here is what we are asking. Funding for the unglamorous work that turns a pilot into something people can rely on: calibration, validation and field maintenance. The amount and period are placeholders on the slide; fill them in before presenting. Second, field partners, growers and cooperatives who will use these readings in real decisions, because a monitoring system is only proven when someone acts on it. Third, science advisors in agronomy and hydrology to validate every threshold we publish. HORIZON will not publish a colour-coded limit until it has been validated. The photograph is the river beside Cồn Hô at dusk. Thank you. Before this deck is shown, replace every bracketed item with real names, figures and contact details.")

# ---------------------------------------------------------------- appendix
def arow(lead, txt, tone=INK):
    return (f'<div style="display:flex;gap:36px;border-top:1px solid rgba(20,48,46,0.25);padding:16px 0"><p style="width:420px;font-size:30px;font-weight:700;color:{tone};line-height:1.25">{lead}</p>'
            f'<p style="width:900px;font-size:30px;line-height:1.35;color:{INK}">{txt}</p></div>')
def appx(id_, title, rows, notes, n):
    return section(id_, SILT, INK,
        P("Appendix", 128, 100, 400, 26, MUTE_L, 500) + H(title, 128, 150, 1400, 80, INK, 200, 1.04, ls=-2) +
        A(128, 290, 1664, "".join(rows)) + P(f"A{n}", 1700, 1000, 92, 24, MUTE_L, 500, extra="text-align:right"), notes)
S["appx1"] = appx("appx1", "What has been checked", [
    arow("356 automated tests pass", "Software tests of the web app and data handling, run on 21 Oct 2026. A software result, not a field result."),
    arow("19 browser checks pass", "Public flows tested in a browser, with a simulated storage service for uploads."),
    arow("6,465 readings stored", "From the water station since 25 Sep 2026, counted read-only on 21 Oct 2026. Shows data arrives, not that it is accurate."),
    arow("Readings about every 2.5 minutes", "Observed on the water station’s recent rows. Not a recorded network trace of the gateway link."),
], "Appendix. These are the verified results behind the main slides, labelled by what kind of evidence they are. Test counts are software results. The stored-readings count is a live observation. Neither is a field validation.", 1)
S["appx2"] = appx("appx2", "Open findings from our audit", [
    arow("Zero-salinity runs", "322 of the last 1,000 water-station readings store salinity as exactly 0 while flagged healthy. Cause not yet established; the probe may have been out of the water, or the register may read 0 at very low conductivity."),
    arow("Soil station has no stored readings", "The soil station has not yet stored any readings, so the soil section shows no data."),
    arow("Water EC and temperature missing publicly", "The public view shows salinity and level, but EC and temperature are empty. A database fix is written and reviewed, not applied."),
    arow("Firmware fallback", "If the salinity register fails, firmware estimates salinity from EC. It is an approximation sent as a reading. Recommended: send “missing” instead. Not changed; needs flashing approval."),
], "Appendix. These are open issues we found by auditing our own live system. None is hidden. The first needs an administrator database query to separate a probe condition from a data-handling cause. We have not changed firmware or applied any database change without approval.", 2)
S["appx3"] = appx("appx3", "Before this is called production-ready", [
    arow("Hardware validation", "A 20-step bench and supervised field gate is defined; no completed run is on record."),
    arow("Credential rotation", "Device and service credentials must be rotated before wider use."),
    arow("Real-storage video upload", "Direct upload is tested against a simulated service; a safe staging test is pending."),
    arow("Network trace", "A recorded trace of the gateway’s DNS, TLS and upload path is pending."),
    arow("Calibration and thresholds", "Calibration against references and site-validated thresholds. Until then the Observatory states that no threshold is set."),
], "Appendix. These are the release gates still open. They match the roadmap on slide nine.", 3)

order = ["cover", "gap", "approach", "pilot", "journey", "observatory", "community", "status", "roadmap", "ask", "appx1", "appx2", "appx3"]
if __name__ == "__main__":
    write(sys.argv[1], S, order, "HORIZON Funding Pitch",
          {"s1": {"description": "The place, the gap, the approach.", "start": "cover"},
           "s2": {"description": "The pilot, its data path and what people see.", "start": "pilot"},
           "s3": {"description": "Status, roadmap and the ask.", "start": "status"},
           "s4": {"description": "Appendix.", "start": "appx1"}})
