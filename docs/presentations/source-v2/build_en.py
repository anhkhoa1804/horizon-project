#!/usr/bin/env python3
"""HORIZON English funding pitch, v2 ("a living laboratory on a river island").
Usage: python3 build_en.py <outdir>     Copy lives here; the visual system lives in hz2.py.
Facts used on slides are traced in ../en/EN-v2-evidence-and-placeholders.md."""
import sys
from hz2 import *

NB = "&#160;"  # keep dates and units together
S, N = {}, {}


def d(s):  # non-breaking date/units
    return s.replace(" ", NB)


# ================================================================ 01 PLACE: cover
S["cover"] = section("cover", CANOPY, "".join([
    img("aerial.jpg", "Aerial view of Cồn Hô, a long narrow green island in a wide river", 0, 0, W, H),
    scrim(0, 0, W, H, "linear-gradient(90deg, rgba(12,22,17,0.9) 0%, rgba(12,22,17,0.72) 34%, rgba(12,22,17,0.2) 58%, rgba(12,22,17,0) 72%)"),
    scrim(0, 780, W, 300, "linear-gradient(180deg, rgba(12,22,17,0) 0%, rgba(12,22,17,0.7) 100%)"),
    img("horizon-wordmark.png", "HORIZON", M, 112, 300, 90, "object-fit:contain"),
    img("frogsleap-logo-1.png", "Frogsleap Foundation", W - M - 104, 104, 104, 96, "object-fit:contain"),
    mono("Cồn Hô · Vĩnh Long · Mekong Delta", M, 384, 900, SUN, 26, 500, ls=2, upper=False),
    headline("A living laboratory<br>on a river island.", M - 6, 430, 1100, WHITE, 120, 300, 1.0),
    text("p", "HORIZON gathers local observations of water, soil and air into one public record, and is working "
              "to make that record dependable enough to support decisions.", M, 704, 760, TEXT, FOG, lh=1.45),
    horizon("Funding proposal · [Month 2026] · Frogsleap Foundation", "", dark=True),
]), "", section_desc="Place and problem")
N["cover"] = ("This is Cồn Hô, a river island in Vĩnh Long province in the Mekong Delta. HORIZON is a small field-monitoring "
 "pilot that our team at the Frogsleap Foundation has built here. In the next ten minutes I want to show you the place and why "
 "local information matters there, what we have actually built and observed, and what it will take to turn this pilot into "
 "information people can rely on. I will be clear throughout about what works today and what is not yet proven.")

# ================================================================ 02 PROBLEM: the information gap
grid_svg = ('<svg aria-label="Schematic: one large forecast cell containing one small plot" width="760" height="720" viewBox="0 0 760 720" '
            f'style="{pin(1032, 160, 760, 720)}">'
            + "".join(f'<line x1="{x}" y1="0" x2="{x}" y2="760" stroke="#17201B" stroke-opacity="0.08" stroke-width="2"/>' for x in range(0, 761, 95)).replace('y2="760"', 'y2="720"')
            + "".join(f'<line x1="0" y1="{y}" x2="760" y2="{y}" stroke="#17201B" stroke-opacity="0.08" stroke-width="2"/>' for y in range(0, 761, 95))
            + '<rect x="95" y="95" width="570" height="570" fill="none" stroke="#17201B" stroke-width="3" stroke-dasharray="14 10"/>'
            + f'<rect x="452" y="452" width="22" height="22" fill="{SUN_D}"/>'
            + f'<line x1="463" y1="452" x2="463" y2="330" stroke="{SUN_D}" stroke-width="3"/></svg>')
S["gap"] = section("gap", SILT, "".join([
    grid_svg,
    mono("One forecast grid cell", 1127, 204, 500, INK, 26, 500, upper=False, ls=0),
    mono("One grower’s plot", 1345, 446, 300, SUN_D, 26, 500, upper=False, ls=0, align="center"),
    headline("Forecasts describe<br>a region.", M - 4, 200, 860, INK, HEAD, 300),
    headline("Growers decide<br>for one plot.", M - 4, 430, 860, SUN_D, HEAD, 300, italic=True),
    text("p", "Whether to take river water in, irrigate or wait depends on conditions at one intake and one root zone, "
              "measured close to where the decision is made.", M, 680, 780, TEXT, MUTE, lh=1.45),
    horizon("Schematic, not to scale", "02", dark=False),
]), "")
N["gap"] = ("Here is the gap in one picture. Weather and river forecasts describe a cell on a grid, an area much larger than a "
 "single garden. A grower on this island decides for one plot: the water at their own intake, the soil around their own roots. "
 "The drawing is schematic. I am not claiming a particular grid size; the point is the difference in scale. HORIZON's idea is "
 "modest: put careful measurement close to where the decision is made, and keep a record of when and where every number came from.")

# ================================================================ 03 WHY CỒN HÔ
S["place"] = section("place", PAPER, "".join([
    img("gate.jpg", "The wooden entrance gate of Cồn Hô with a dirt path leading into gardens", 0, 0, 760, H),
    headline("Why Cồn Hô.", 888, 128, 900, INK, HEAD, 300),
    text("p", "A narrow island, about a kilometre long, with river water on every side. Orchards, gardens and homes sit "
              "a short walk from the bank.", 888, 278, 860, LEAD - 8, INK, SERIF, 300, 1.3, -0.3),
    f'<div style="{pin(888, 516, 904, 1)}background:rgba(23,32,27,0.25)"></div>',
    mono("Water", 888, 548, 260, CLAY, 26, 500, upper=False, ls=0),
    text("p", "The river is the island’s water supply. In the Delta’s dry season it can turn brackish.", 1148, 546, 644, TEXT - 2, INK, lh=1.4),
    mono("Soil", 888, 668, 260, CLAY, 26, 500, upper=False, ls=0),
    text("p", "Moisture and salt in the root zone change with irrigation, rain and the river.", 1148, 666, 644, TEXT - 2, INK, lh=1.4),
    mono("People", 888, 788, 260, CLAY, 26, 500, upper=False, ls=0),
    text("p", "A small community of growers and visitors: close enough to see the sensors and use them.", 1148, 786, 644, TEXT - 2, INK, lh=1.4),
    horizon("Entrance to Cồn Hô · photo supplied by the project", "03", dark=False, line=False, x=888, width=900),
]), "")
N["place"] = ("Why here? Cồn Hô is a narrow island, about a kilometre long, with river water on every side. Its orchards and gardens are "
 "never far from the bank, so the river is the water supply. In the Mekong Delta's dry season, river water can turn brackish, and "
 "growers have to judge when it is safe to take water in. That makes the island a natural place to watch water, soil and air "
 "together. It is also small and close-knit, which matters for a pilot: residents and visitors can see the equipment and, in time, "
 "use the information. The island's length comes from our own project description; the dry-season salinity is general regional "
 "context, not a HORIZON measurement.")

# ================================================================ 04 FIELDWORK: the river crossing
S["landing"] = section("landing", CANOPY, "".join([
    img("boat.jpg", "Team members passing a storage box of equipment from a wooden river boat to a concrete landing", 0, 0, W, H),
    scrim(0, 0, W, 520, "linear-gradient(180deg, rgba(12,22,17,0.74) 0%, rgba(12,22,17,0.4) 55%, rgba(12,22,17,0) 100%)"),
    scrim(0, 800, W, 280, "linear-gradient(180deg, rgba(12,22,17,0) 0%, rgba(12,22,17,0.82) 100%)"),
    headline("The road to the pilot<br>is a river.", M - 4, 136, 1100, WHITE, 104, 300, 1.0),
    horizon(d("5 Sep 2026") + " · river landing · the team loading pilot equipment · photo: HORIZON team", "04"),
]), "", section_desc="Fieldwork and technology")
N["landing"] = ("Every part of HORIZON had to reach the island. This photograph is from our field day on 5 September 2026: the team "
 "passing a box of equipment off the boat at the river landing. It is a small moment, but it says something true about the "
 "project. The hardware is built for a place you reach by water, and keeping it working means coming back the same way.")

# ================================================================ 05 FIELDWORK: building on site
S["workshop"] = section("workshop", CANOPY, "".join([
    img("workshop-tall.jpg", "Three team members wiring and checking open white station enclosures on a table under a thatched shelter", 680, 0, 1240, H),
    scrim(680, 0, 220, H, "linear-gradient(90deg, rgba(20,35,28,1) 0%, rgba(20,35,28,0) 100%)"),
    scrim(680, 800, 1240, 280, "linear-gradient(180deg, rgba(20,35,28,0) 0%, rgba(20,35,28,0.85) 100%)"),
    headline("Built and checked<br>on the island.", M - 4, 128, 640, WHITE, 80, 300, 1.04),
    text("p", "The station electronics were designed by the team. On site, the team assembled, checked and "
              "troubleshot them before installation.", M, 352, 520, TEXT - 2, FOG, lh=1.45),
    mono("What the team did", M, 600, 520, SUN, 24, 500, upper=False, ls=0),
    text("p", "Designed the station boards<br>Wrote the firmware<br>Built the public website<br>Installed the stations in person",
         M, 640, 520, TEXT - 2, WHITE, lh=1.55),
    horizon(d("5 Sep 2026") + " · Cồn Hô · assembling station enclosures · photo: HORIZON team", "05"),
]), "")
N["workshop"] = ("This is the engineering side of the same day. Team members are wiring and checking station enclosures on the island "
 "itself, under a shelter, with the boards, batteries and radios open on the table. The station boards, the firmware and the website "
 "were made by the team. Field days like this one are where things fail and get fixed: loose connections, power, radio range. "
 "That practical experience is the main asset we bring to the next phase. [Confirm with the team: the exact tasks done on 5 Sep, "
 "and that everyone pictured has agreed to the photo being used.]")

# ================================================================ 06 TECHNOLOGY: two stations, one gateway
def node(y, code, name, what, note, kind):
    return "".join([
        glyph(kind, 904, y + 14, dark=False, size=22),
        mono(code, 944, y + 6, 360, CLAY, 24, 500, upper=False, ls=0),
        text("h3", name, 944, y + 42, 820, 44, INK, SERIF, 400, 1.1, -0.5),
        text("p", what, 944, y + 100, 848, TEXT - 4, INK, lh=1.4),
        text("p", note, 944, y + 138, 848, TEXT - 4, SUN_D, lh=1.4) if note else "",
    ])

S["network"] = section("network", PAPER, "".join([
    img("station-tall.jpg", "A team member beside a solar-powered HORIZON station: a white pole with a solar panel and a sealed enclosure, in a garden at Cồn Hô", 0, 0, 810, H),
    # restrained annotation, two components only
    f'<div style="{pin(396, 300, 96, 2)}background:{WHITE}"></div>',
    mono("Solar panel", 500, 282, 280, WHITE, 24, 500, upper=False, ls=0, build=None),
    f'<div style="{pin(366, 490, 126, 2)}background:{WHITE}"></div>',
    mono("Station enclosure", 500, 472, 300, WHITE, 24, 500, upper=False, ls=0),
    headline("Two sensing stations.<br>One gateway.", 900, 128, 900, INK, 72, 300, 1.05),
    node(300, "STATION_01", "Water station", "Water level, conductivity, temperature and salinity.",
         "", "observed"),
    node(500, "STATION_02", "Soil station", "Soil moisture, EC, temperature and pH; the air above it.",
         "No readings stored yet: battery replacement pending.", "built"),
    node(728, "STATION_03", "Gateway", "Measures nothing. Relays both stations to the cloud.",
         "", "observed"),
    horizon(d("9 Oct 2026") + " · installed station [confirm which] · not proof of validated operation", "06", dark=False, line=False, x=904, width=700),
]), "")
N["network"] = ("The physical pilot is two sensing stations and one gateway, not three sensing stations. The water station at the "
 "river measures level, conductivity, temperature and salinity. The soil station measures soil moisture, bulk conductivity, "
 "temperature and pH, plus the air temperature and humidity above it. The third node, the gateway, measures nothing itself: it "
 "receives both stations by long-range LoRa radio and forwards their messages over mobile data. The photograph shows one of our "
 "solar-powered stations installed on the island on 9 October 2026. It shows that the station is physically there; it is not "
 "evidence that it is measuring accurately. One honest caveat: the soil station has not yet stored any readings, because its "
 "battery needs replacing. The full shape here means observed in the field, the half shape means built but not yet observed working. "
 "[Confirm which station the photograph shows.]")

# ================================================================ 07 INFORMATION: from conditions to information
STAGES = [
    ("Sense", "Probes measure water, soil and air.", "observed"),
    ("Connect", "Radio to the gateway, then mobile data to the cloud.", "observed"),
    ("Trust", "Every value keeps its time and source. Missing stays missing.", "built"),
    ("Understand", "A public page shows readings and their limits.", "built"),
    ("Act", "Growers use validated information to decide.", "open"),
]
st = []
for i, (w, line, kind) in enumerate(STAGES):
    x = M + i * 342
    order = f"rise {i + 1}"
    st.append(f'<div data-build-in="fade {i + 1}" style="{pin(x, 556, 30, 30)}border-radius:50%;'
              + ("background:" + WHITE + ";border:2px solid " + WHITE if kind == "observed" else
                 ("background:linear-gradient(90deg," + WHITE + " 50%," + CANOPY + " 50%);border:2px solid " + WHITE if kind == "built"
                  else "background:" + CANOPY + ";border:2px dashed " + WHITE)) + '"></div>')
    st.append(text("h3", w, x - 4, 456, 330, 54, SUN if kind == "open" else WHITE, SERIF, 300, 1.0, -1, build=order))
    st.append(text("p", line, x, 622, 300, TEXT - 4, FOG, lh=1.42, build=order))
S["approach"] = section("approach", CANOPY, "".join([
    headline("From conditions<br>to information.", M - 4, 128, 1100, WHITE, HEAD, 300),
    f'<div style="{pin(M, 570, W - 2 * M - 300, 2)}background:rgba(251,248,242,0.55)"></div>',
    f'<div style="{pin(W - M - 300, 570, 300, 2)}background:repeating-linear-gradient(90deg, rgba(251,248,242,0.55) 0px, rgba(251,248,242,0.55) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 20px)"></div>',
    *st,
    f'<div style="{pin(1312, 557, 28, 28)}border-radius:50%;background:{SUN}"></div>',
    mono("Today", 1296, 516, 120, SUN, 24, 500, upper=False, ls=0),
    glyph("observed", M, 908, True, 20), mono("Observed", M + 32, 904, 220, FOG, 24, upper=False, ls=0),
    glyph("built", M + 230, 908, True, 20), mono("Built, not yet complete", M + 262, 904, 400, FOG, 24, upper=False, ls=0),
    glyph("open", M + 640, 908, True, 20), mono("Not yet proven", M + 672, 904, 300, FOG, 24, upper=False, ls=0),
    mono("07", W - M - 200, CAP_Y, 200, FOG, 24, align="right"),
]), "", section_desc="Information")
N["approach"] = ("This is the whole approach in five steps, and the shapes are honest about where each one stands. Sense: probes "
 "measure the water, the soil and the air. Connect: each station sends its readings by radio to the gateway, which forwards them "
 "over mobile data; we observe that working every few minutes. Trust: every value is stored with its time and source, and a missing "
 "value is shown as missing, never as zero. That is built, but trust also needs calibration, which we have not done yet. "
 "Understand: a public page shows the readings and states what it cannot yet tell you, for example that no threshold is validated "
 "for this site. Act: growers using validated information to make decisions. That is the goal of the next phase, not something "
 "we claim today.")

# ================================================================ 08 INFORMATION: the digital experience
S["observatory"] = section("observatory", SILT, "".join([
    f'<div style="{pin(616, 128, 1176, 760)}background:{WHITE};box-shadow:0 24px 80px rgba(23,32,27,0.18)"></div>',
    shot("shot-dashboard-live.jpg", "The public HORIZON Observatory: salinity and water level, a 24-hour chart, a map of the stations, and soil panels that say no data", 640, 152, 1128, 712),
    img("report-mobile.jpg", "The community report page on a phone", M, 500, 200, 392, "border-radius:28px;border:8px solid #17201B;box-shadow:0 20px 60px rgba(23,32,27,0.3)"),
    headline("One public<br>page.", M - 4, 128, 460, INK, 72, 300, 1.05),
    text("p", "Readings, their time and their source, in Vietnamese and English. Where data is missing, the page says so.",
         M, 312, 420, TEXT - 2, INK, lh=1.45),
    text("p", "Residents add what sensors cannot see, with a photo or a short video.", 356, 712, 236, TEXT - 6, MUTE, lh=1.42),
    horizon("Live-site captures, " + d("21 Oct 2026") + " · Vietnamese interface shown; English available", "08", dark=False, line=False),
]), "")
N["observatory"] = ("This is the real public Observatory, captured from the live site on 21 October 2026, in Vietnamese because that is "
 "the language the community uses; an English version is a click away. Salinity and water level from the water station sit at the "
 "top left, with a 24-hour chart and a map of the stations. Look at the soil panels: they say there is no data, because the soil "
 "station has not reported yet. That is deliberate. Missing data is shown as missing, never as zero. On the phone is the community "
 "report page. Anyone can pick the nearest station, describe what they saw and add a photo or short video, without an account. "
 "The report flow is built and tested in software; how many residents will use it has not been measured. I should also be candid "
 "that the chart includes long flat stretches at zero salinity; we are investigating whether those are real or a probe problem, "
 "and it is listed in the appendix.")

# ================================================================ 09 VALIDATION: what has been achieved
def figure(x, big, unit, label, source):
    return "".join([
        text("p", big + (f'<span style="color:{FOG}">{unit}</span>' if unit else ""), x, 336, 520, FIG, WHITE, SERIF, 300, 1.0, -4),
        f'<div style="{pin(x, 552, 470, 1)}background:rgba(251,248,242,0.3)"></div>',
        text("p", label, x, 580, 470, TEXT, WHITE, lh=1.4),
        mono(source, x, 744, 470, FOG, 24, upper=False, ls=0),
    ])

S["achieved"] = section("achieved", CANOPY, "".join([
    headline("A working pilot, observed in the field.", M - 4, 150, 1664, WHITE, HEAD, 300),
    figure(M, "2 + 1", "", "sensing stations and a gateway, built by the team and taken to Cồn Hô", d("Field photos, 5 Sep and 9 Oct 2026")),
    figure(M + 568, "6,465", "", "water-station readings stored in the public record since " + d("25 Sep 2026"), d("Counted read-only, 21 Oct 2026")),
    figure(M + 1136, "2.5", "&#8202;min", "typical interval between new water readings", d("Recent rows, 21 Oct 2026")),
    glyph("observed", M, 908, True, 20),
    mono("All three observed in the field. Software test results are in the appendix.", M + 34, 904, 1300, FOG, 24, upper=False, ls=0),
    mono("09", W - M - 200, CAP_Y, 200, FOG, 24, align="right"),
]), "", section_desc="Validation")
N["achieved"] = ("Here is what we can say from evidence. First, the physical pilot exists: two sensing stations and one gateway, built "
 "by the team and taken to the island; our photographs from 5 September and 9 October 2026 show the work. Second, the water "
 "station's readings reach the public record: on 21 October we counted 6,465 stored readings since 25 September, with a read-only "
 "query. Third, on recent rows, new water readings arrived roughly every two and a half minutes. These are observations of a "
 "working data chain. They are not measures of accuracy; that is the next slide. The soil station has not yet stored readings, so "
 "no soil data is counted here, and automated software test results are in the appendix rather than on this slide.")

# ================================================================ 10 VALIDATION: what still needs to be proven
OPEN = [
    ("Accuracy", "No calibration against reference measurements yet."),
    ("Thresholds", "No limit is validated for this site."),
    ("Soil record", "STATION_02 has stored no readings yet."),
    ("Zero-salinity runs", "Long runs of exactly 0 are under investigation."),
    ("Reliability", "No long-term uptime or maintenance record."),
    ("Use", "Community use and decision impact are unmeasured."),
]
cells = []
for i, (t, line) in enumerate(OPEN):
    col, row = i % 3, i // 3
    x, y = M + col * 568, 520 + row * 196
    cells.append(glyph("open", x, y + 12, False, 22))
    cells.append(text("h3", t, x + 40, y, 500, 40, INK, SERIF, 400, 1.1, -0.4))
    cells.append(text("p", line, x + 40, y + 58, 480, TEXT - 4, MUTE, lh=1.4))
ticks = [("Built", 0, "built"), ("Observed", 560, "observed"), ("Proven", 1640, "open")]
scale = [f'<div style="{pin(M, 380, 1664, 2)}background:rgba(23,32,27,0.35)"></div>']
for word, dx, kind in ticks:
    scale.append(glyph(kind, M + dx, 370, False, 22))
    scale.append(mono(word, M + dx + (-120 if dx > 1600 else 0), 410, 240, INK, 26, 500, upper=False, ls=0, align="right" if dx > 1600 else "left"))
scale.append(f'<div style="{pin(M + 880, 360, 44, 44)}border-radius:50%;background:{SUN_D}"></div>')
scale.append(mono("HORIZON today", M + 820, 296, 300, SUN_D, 26, 500, upper=False, ls=0))
S["unproven"] = section("unproven", PAPER, "".join([
    headline("What we have not proven yet.", M - 4, 128, 1600, INK, HEAD, 300),
    *scale, *cells,
    horizon("Details, causes and evidence: appendix A2 and A3", "10", dark=False),
]), "")
N["unproven"] = ("This slide matters as much as the last one. On a line from built, to observed, to proven, HORIZON today sits "
 "between observed and proven. Six things are not proven. Accuracy: we have not yet compared our probes with reference measurements. "
 "Thresholds: no limit is validated for this site, and the Observatory says so. Soil: the soil station has stored no readings yet "
 "because its battery needs replacing. Zero-salinity runs: in the water data there are long stretches of exactly zero; we need an "
 "administrator query and a probe check to tell a real condition from a data problem, and we will not rewrite those records. "
 "Reliability: we have no long-term uptime or maintenance record. And use: we have not measured whether people use the information "
 "or whether it changes decisions. Each of these maps to a step on the next slide.")

# ================================================================ 11 NEXT STEPS: from pilot to trusted instrument
STEPS = [
    ("Data quality", "Explain the zero-salinity runs. Publish water conductivity and temperature. Restore soil data."),
    ("Calibration", "Compare against reference measurements on site, reviewed by agronomy and hydrology advisors."),
    ("Reliability", "Bench test, supervised field soak, a maintenance routine and a public uptime record."),
    ("Local ownership", "Trained local caretakers, spare parts and an agreed operator for the long term."),
]
rows = []
for i, (t, line) in enumerate(STEPS):
    y = 330 + i * 134
    rows.append(mono(f"0{i + 1}", M, y + 8, 60, SUN, 26, 500, upper=False, ls=0, build=f"fade {i + 1}"))
    rows.append(text("h3", t, M + 76, y, 520, 44, WHITE, SERIF, 400, 1.1, -0.5, build=f"fade {i + 1}"))
    rows.append(text("p", line + f' <span style="color:{SUN}">[duration]</span>', M + 76, y + 56, 820, TEXT - 6, FOG, lh=1.4, build=f"fade {i + 1}"))
S["roadmap"] = section("roadmap", CANOPY, "".join([
    img("dusk.jpg", "The river beside Cồn Hô at dusk, seen from a landing", 1100, 0, 820, H),
    scrim(1100, 0, 260, H, "linear-gradient(90deg, rgba(20,35,28,1) 0%, rgba(20,35,28,0) 100%)"),
    headline("From pilot to<br>trusted instrument.", M - 4, 128, 1000, WHITE, 80, 300, 1.04),
    *rows,
    mono("11", W - M - 200, CAP_Y, 200, FOG, 24, align="right"),
    mono("Durations and the long-term operator: to agree with partners", M, CAP_Y, 960, FOG, 24, upper=False, ls=0),
]), "", section_desc="Next steps and the ask")
N["roadmap"] = ("Here is the path from a working pilot to an instrument people can trust, in the order we would do it. Data quality "
 "first: explain the zero-salinity runs, publish the water conductivity and temperature we already collect, and restore the soil "
 "station. Then calibration: compare our readings with reference measurements on site, with agronomy and hydrology advisors reviewing "
 "the method, so that any threshold we publish is validated. Then reliability: a bench test, a supervised field soak, a maintenance "
 "routine and a public uptime record. And local ownership: trained caretakers on the island, spare parts, and an agreed long-term "
 "operator. I have left the durations blank on purpose; we will set them with partners rather than promise dates we have not planned.")

# ================================================================ 12 ASK: partnership and funding
ASKS = [
    ("Funding", f'<u>[Amount]</u> over <u>[period]</u>', "Calibration, spare parts, field visits and maintenance.", "Quarterly progress and an open data record."),
    ("Field partners", "Growers and cooperatives on and near Cồn Hô.", "Readings tested against real irrigation decisions.", "Early access to local information, shaped by their needs."),
    ("Science advisors", "Agronomy and hydrology reviewers.", "Validated methods and site thresholds.", "Co-authorship of the validation work."),
]
ask = []
for c, (t, a, e, r) in enumerate(ASKS):
    x = 560 + c * 432
    ask.append(text("h3", t, x, 360, 400, 44, INK, SERIF, 400, 1.1, -0.5))
    for j, body in enumerate([a, e, r]):
        ask.append(text("p", body, x, 456 + j * 150, 392, TEXT - 4, INK if j else SUN_D, lh=1.4))
for j, lab in enumerate(["We ask for", "It enables", "Partners receive"]):
    ask.append(f'<div style="{pin(M, 440 + j * 150, 1664, 1)}background:rgba(23,32,27,0.22)"></div>')
    ask.append(mono(lab, M, 458 + j * 150, 380, CLAY, 26, 500, upper=False, ls=0))
S["ask"] = section("ask", PAPER, "".join([
    headline("What your support<br>makes possible.", M - 4, 128, 1200, INK, HEAD, 300),
    *ask,
    horizon("All amounts, periods and roles are placeholders to confirm before presenting", "12", dark=False),
]), "")
N["ask"] = ("We are asking for three kinds of partner. Funding, for the unglamorous work that turns a pilot into something people can "
 "rely on: calibration, spare parts, field visits and maintenance. The amount and period are placeholders; fill them in before "
 "presenting. In return, funders receive regular progress reports and access to an open data record. Field partners, growers and "
 "cooperatives on and near the island, who will test the readings against real irrigation decisions and help shape what the "
 "information looks like. And science advisors in agronomy and hydrology, to validate our methods and any threshold before it is "
 "published, as co-authors of that work.")

# ================================================================ 13 CLOSE
S["close"] = section("close", CANOPY, "".join([
    img("station-wide.jpg", "A smiling team member with arms outstretched beside a solar-powered HORIZON station and the Cồn Hô sign", 0, 0, W, H),
    scrim(0, 0, W, H, "linear-gradient(90deg, rgba(12,22,17,0.88) 0%, rgba(12,22,17,0.6) 30%, rgba(12,22,17,0) 52%)"),
    scrim(0, 820, W, 260, "linear-gradient(180deg, rgba(12,22,17,0) 0%, rgba(12,22,17,0.75) 100%)"),
    headline("Help us turn readings<br>into information<br>people can trust.", M - 4, 300, 900, WHITE, 92, 300, 1.04),
    text("p", "[Name] · [email] · horizon.frogsleap.com.vn", M, 690, 900, TEXT - 2, FOG, lh=1.4),
    img("horizon-wordmark.png", "HORIZON", M, 112, 260, 78, "object-fit:contain"),
    horizon(d("9 Oct 2026") + " · Cồn Hô · photo: HORIZON team", "13"),
]), "")
N["close"] = ("We started with a place, and I want to end there. This is one of our stations on Cồn Hô, on the day it went up. "
 "The pilot works: readings travel from the island to a public page. What it needs now is the careful, patient work that makes "
 "those readings trustworthy and useful to the people who live here. We would like you to be part of that. Thank you. "
 "[Before presenting, replace every bracketed item with real names, figures and contact details.]")

# ================================================================ APPENDIX
def table(rows, top, widths, size=24):
    head = "".join(f'<th style="width:{w}%;text-align:left">{h}</th>' for h, w in zip(rows[0], widths))
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows[1:])
    return (f'<table style="{pin(M, top, W - 2 * M)}font-family:{SANS};font-size:{size}px;color:{INK};border-collapse:collapse">'
            f'<tr style="background:{SILT}">{head}</tr>{body}</table>')


def appendix(id_, num, title, rows, widths, note, size=24, top=290):
    return section(id_, PAPER, "".join([
        mono("Appendix " + num, M, 128, 400, CLAY, 26, 500, upper=False, ls=0),
        headline(title, M - 4, 168, 1600, INK, 64, 300),
        table(rows, top, widths, size),
        horizon(note, num, dark=False),
    ]), "", section_desc="Appendix" if num == "A1" else None)

S["a1"] = appendix("a1", "A1", "Evidence behind the main slides", [
    ["Claim", "Kind of evidence", "Source and date"],
    ["Two sensing stations and one gateway exist on Cồn Hô", "Field photographs", "Team photos, 5 Sep and 9 Oct 2026"],
    ["6,465 water readings stored since 25 Sep 2026", "Live observation", "Read-only count of the public record, 21 Oct 2026"],
    ["New water readings about every 2.5 minutes", "Live observation", "Timestamps of recent rows, 21 Oct 2026"],
    ["Missing data shown as missing, never zero", "Software test + live page", "Unit tests; Observatory capture, 21 Oct 2026"],
    ["Web app checks: 368 unit tests, browser and staging suites", "Software, isolated local staging", "21 Oct 2026; not proof of production behaviour"],
    ["Firmware builds for both stations and the gateway", "Compile-only", "PlatformIO, 21 Oct 2026; nothing flashed"],
    ["Dry-season salinity in the Mekong Delta", "Regional context", "General knowledge; not a HORIZON measurement"],
], [40, 24, 36], "Software results are not field validation; live observations are not accuracy measurements")
N["a1"] = ("Appendix. These are the facts behind the main slides, labelled by the kind of evidence. Test counts are software results "
 "from an isolated local staging environment. Stored-readings counts are live observations of the data chain. Neither is a field "
 "validation of accuracy.")

S["a2"] = appendix("a2", "A2", "Open findings from our own audit", [
    ["Finding", "What we know", "Status"],
    ["Zero-salinity runs (I-23)", "322 of the last 1,000 water readings store salinity as exactly 0 while flagged healthy", "Open: needs a read-only admin query and a probe check; no records rewritten"],
    ["Water EC and temperature not public (I-18)", "Stored in one column set, read from another", "Fix written and rehearsed; awaiting approval to apply"],
    ["Salinity estimated from EC on read failure (I-22)", "Old firmware sent EC × 0.64 as a measurement", "Removed at source, compiled; not yet flashed"],
    ["Soil station silent", "STATION_02 has no stored readings", "Battery replacement pending"],
    ["Device acknowledgement of remote settings", "Settings are stored, not confirmed by a device", "Software-tested; hardware unverified"],
], [26, 38, 36], "We have not changed firmware on devices or applied database changes without approval")
N["a2"] = ("Appendix. These are open findings from auditing our own live system. None is hidden. The zero-salinity runs need an "
 "administrator query to separate a probe condition from a data-handling cause. The firmware fix for the salinity estimate is "
 "written and compiles, but has not been flashed to any device.")

S["a3"] = appendix("a3", "A3", "Before HORIZON is called production-ready", [
    ["Gate", "What remains", "Roadmap step"],
    ["Hardware validation", "Bench test and supervised field soak, on record", "Reliability"],
    ["Calibration and thresholds", "Reference comparison; site-validated limits", "Calibration"],
    ["Database changes 035 and 036", "Reviewed and rehearsed; to apply with approval", "Data quality"],
    ["Device credentials", "Rotate every production device secret", "Data quality"],
    ["Uploads on real storage", "Confirm large video uploads on production storage", "Data quality"],
    ["Network trace", "Record the gateway's mobile-data path once", "Reliability"],
], [30, 46, 24], "Each gate maps to a step on slide 11")
N["a3"] = "Appendix. These are the release gates still open, and the roadmap step each belongs to."

S["a4"] = appendix("a4", "A4", "Images used in this deck", [
    ["Slide", "Image", "Source and status"],
    ["01", "Aerial view of Cồn Hô", "Supplied by the project"],
    ["03", "Entrance gate of Cồn Hô", "Supplied by the project"],
    ["04", "Loading equipment at the river landing (IMG_1612)", "HORIZON team, 5 Sep 2026; cropped, light grade"],
    ["05", "Assembling station enclosures (IMG_1696)", "HORIZON team, 5 Sep 2026; cropped, light grade"],
    ["06, 13", "Installed solar-powered station (IMG_1522)", "HORIZON team, 9 Oct 2026; cropped, light grade"],
    ["08", "Observatory and Report pages", "Live-site captures, 21 Oct 2026; unedited"],
    ["11", "The river at dusk", "Supplied by the project"],
], [14, 46, 40], "No image was generated or altered in content; people pictured: consent to confirm [ ]")
N["a4"] = "Appendix. Every image in the deck, with its source. All photographs are real; edits are limited to cropping and a light, uniform grade."

ORDER = ["cover", "gap", "place", "landing", "workshop", "network", "approach", "observatory", "achieved", "unproven",
         "roadmap", "ask", "close", "a1", "a2", "a3", "a4"]
SECTIONS = {
    "s1": {"description": "Place and problem: Cồn Hô and the information gap", "start": "cover"},
    "s2": {"description": "Fieldwork and technology: how the pilot reached the island", "start": "landing"},
    "s3": {"description": "Information: from conditions to a public page", "start": "approach"},
    "s4": {"description": "Validation: what is observed and what is not yet proven", "start": "achieved"},
    "s5": {"description": "Next steps and the ask", "start": "roadmap"},
    "s6": {"description": "Appendix: evidence, findings, gates and image sources", "start": "a1"},
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out_en"
    only = sys.argv[2].split(",") if len(sys.argv) > 2 else ORDER
    order = [k for k in ORDER if k in only]
    slides = {k: S[k].replace("<aside></aside>", f"<aside>{N.get(k, '')}</aside>") for k in order}
    write(out, slides, order, "HORIZON — a living laboratory on a river island", SECTIONS)
    print("built", len(order))
