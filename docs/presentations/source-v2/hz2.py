"""HORIZON presentation design system v2: "a living laboratory on a river island".

Shared by the English deck (build_en.py) and any future Vietnamese adaptation: copy lives in the build files,
everything visual lives here. Output follows the Slides artifact format (one <section> per slide, inline styles,
1920x1080 canvas). Images are written as {{img:NAME}} tokens; the renderer resolves them to local files and the
publisher resolves them to uploaded asset URLs.
"""
import json, os

# ---- type: three faces, all with Vietnamese coverage
SERIF = "'Newsreader', Georgia, serif"          # headlines, big figures
SANS = "'Be Vietnam Pro', Arial, sans-serif"     # text
MONO = "'IBM Plex Mono', monospace"              # field-log captions, units, labels
FACES = {
    "newsreader": {"family": "Newsreader", "href": "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&display=swap"},
    "be-vietnam-pro": {"family": "Be Vietnam Pro", "href": "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap"},
    "ibm-plex-mono": {"family": "IBM Plex Mono", "href": "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"},
}
# ---- scale (px): figure / headline / lead / text / caption
FIG, HEAD, LEAD, TEXT, CAP = 168, 88, 44, 30, 24

# ---- colour, sampled from the field photographs
CANOPY = "#14231C"   # deep vegetation shade: dark ground
CANOPY2 = "#1C2F26"  # lifted dark (panels on dark)
SILT = "#EDE6D8"     # river silt: light ground
PAPER = "#F7F3EA"    # paper: lightest ground
INK = "#17201B"      # text on light
MUTE = "#5A645D"     # secondary text on light (5.6:1 on PAPER)
FOG = "#C9D1C8"      # secondary text on dark (10:1 on CANOPY)
CLAY = "#7A5C3A"     # silt brown, secondary accent on light (5.4:1 on PAPER)
SUN = "#E8892B"      # HORIZON orange, one accent per slide (on dark)
SUN_D = "#96490F"    # orange for text on light (5.6:1 on PAPER, 5.0:1 on SILT)
WHITE = "#FBF8F2"

W, H, M = 1920, 1080, 128
LINE_Y = 952           # the horizon line
CAP_Y = 904            # field-log caption row, sits on the line


def section(id_, bg, body, notes, color=INK, transition="fade", section_desc=None):
    ds = f' data-section="{section_desc}"' if section_desc else ""
    return (f'<section id="{id_}"{ds} data-transition="{transition}" style="background:{bg};color:{color};'
            f'font-family:{SANS};padding:{M}px;display:flex;flex-direction:column">\n{body}\n<aside>{notes}</aside>\n</section>\n')


def pin(left, top, width, height=None):
    h = f"height:{height}px;" if height is not None else ""
    return f"position:absolute;left:{left}px;top:{top}px;width:{width}px;{h}"


def img(name, alt, left, top, w, h, extra=""):
    return f'<img src="{{{{img:{name}}}}}" alt="{alt}" style="{pin(left, top, w, h)}object-fit:cover;{extra}">'


def shot(name, alt, left, top, w, h, extra=""):
    """Screenshots: contain, never cropped by the frame."""
    return f'<img src="{{{{img:{name}}}}}" alt="{alt}" style="{pin(left, top, w, h)}object-fit:contain;{extra}">'


def scrim(left, top, w, h, gradient):
    return f'<div style="{pin(left, top, w, h)}background:{gradient}"></div>'


def text(tag, html, left, top, width, size, color, family=SANS, weight=400, lh=1.35, ls=0, extra="", build=None):
    b = f' data-build-in="{build}"' if build else ""
    return (f'<{tag}{b} style="{pin(left, top, width)}font-family:{family};font-size:{size}px;font-weight:{weight};'
            f'line-height:{lh};letter-spacing:{ls}px;color:{color};{extra}">{html}</{tag}>')


def headline(html, left, top, width, color, size=HEAD, weight=300, lh=1.04, build=None, italic=False):
    st = "font-style:italic;" if italic else ""
    return text("h2", html, left, top, width, size, color, SERIF, weight, lh, -1.5, st, build)


def mono(html, left, top, width, color, size=CAP, weight=400, align="left", ls=1, upper=True, build=None):
    tt = "text-transform:uppercase;" if upper else ""
    return text("p", html, left, top, width, size, color, MONO, weight, 1.3, ls, f"text-align:{align};{tt}", build)


def horizon(caption, number, dark=True, line=True, x=M, width=1400):
    """The identity device: one hairline at a fixed height, carrying the field-log caption and the slide number."""
    c = "rgba(251,248,242,0.78)" if dark else MUTE
    stroke = "rgba(251,248,242,0.42)" if dark else "rgba(23,32,27,0.28)"
    out = []
    if line:
        out.append(f'<div style="{pin(M, LINE_Y, W - 2 * M, 1)}background:{stroke}"></div>')
    out.append(mono(caption, x, CAP_Y, width, c, upper=False, ls=0))
    if number:
        out.append(mono(number, W - M - 200, CAP_Y, 200, c, align="right"))
    return "".join(out)


# evidence glyphs: shape + word, never colour alone
def glyph(kind, left, top, dark=True, size=22):
    col = WHITE if dark else INK
    if kind == "observed":
        st = f"background:{col};border:2px solid {col}"
    elif kind == "built":
        st = f"background:linear-gradient(90deg,{col} 50%,transparent 50%);border:2px solid {col}"
    else:  # designed / not yet proven
        st = f"border:2px dashed {col}"
    return f'<div style="{pin(left, top, size, size)}border-radius:50%;{st}"></div>'


GLYPH_WORD = {"observed": "Observed in the field", "built": "Built and software-tested", "open": "Designed, not yet proven"}


def write(out, slides, order, title, sections):
    os.makedirs(out + "/slides", exist_ok=True)
    for k in order:
        open(f"{out}/slides/{k}.html", "w").write(slides[k])
    deck = {"v": 4, "createdOnFiles": {"v": 1, "at": "2026-10-21T17:00:00Z"}, "lists": "css", "title": title,
            "order": order, "cover": order[0], "sections": sections, "faces": FACES, "designSystems": []}
    json.dump(deck, open(out + "/deck.json", "w"), ensure_ascii=False, indent=1)
