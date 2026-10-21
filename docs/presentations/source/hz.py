"""Shared HORIZON presentation system (used by both decks).
One typeface (Be Vietnam Pro, Vietnamese-safe), photo-led compositions, no badges/plate labels.
Tokens: RIVER deep teal, DEEP darker, SILT paper, SAND secondary text on dark, DUSK brand orange (one accent per slide)."""
import json, os, re

SANS = "'Be Vietnam Pro', Arial, sans-serif"
RIVER, DEEP, SILT, PAPER = "#16302F", "#0E2220", "#E9E2D0", "#F8F4EA"
INK, MUTE_L = "#14302E", "#52605C"
WHITE, MUTE_D, SAND = "#F8F4EA", "#B9C7C0", "#CDBC93"
DUSK, DUSK_D = "#F28C00", "#A85500"


def section(id_, bg, color, body, notes, data_section=None, pad="0px"):
    ds = f' data-section="{data_section}"' if data_section else ""
    return (f'<section id="{id_}"{ds} data-transition="fade" style="background:{bg};color:{color};font-family:{SANS};'
            f'padding:{pad};display:flex;flex-direction:column">\n{body}\n<aside>{notes}</aside>\n</section>\n')


def A(left, top, width, inner, extra="", build=None):
    b = f' data-build-in="{build}"' if build else ""
    return f'<div{b} style="position:absolute;left:{left}px;top:{top}px;width:{width}px;{extra}">{inner}</div>'


def H(text, left, top, width, size=104, color=WHITE, weight=200, lh=1.04, build=None, ls=-3):
    b = f' data-build-in="{build}"' if build else ""
    return (f'<h2{b} style="position:absolute;left:{left}px;top:{top}px;width:{width}px;font-size:{size}px;font-weight:{weight};'
            f'line-height:{lh};letter-spacing:{ls}px;color:{color}">{text}</h2>')


def P(text, left, top, width, size=34, color=WHITE, weight=400, lh=1.38, build=None, extra=""):
    b = f' data-build-in="{build}"' if build else ""
    return (f'<p{b} style="position:absolute;left:{left}px;top:{top}px;width:{width}px;font-size:{size}px;font-weight:{weight};'
            f'line-height:{lh};color:{color};{extra}">{text}</p>')


def IMG(src, alt, left, top, w, h, fit="cover", pos="center", extra="", build=None):
    b = f' data-build-in="{build}"' if build else ""
    return (f'<img{b} src="{{{{img:{src}}}}}" alt="{alt}" style="position:absolute;left:{left}px;top:{top}px;width:{w}px;height:{h}px;'
            f'object-fit:{fit};object-position:{pos};{extra}">')


def progress(n, total, dark=True, label=""):
    """Ten short segments. Sequence is real information here: where we are in the talk."""
    on = DUSK
    done = "rgba(248,244,234,0.7)" if dark else "rgba(20,48,46,0.65)"
    todo = "rgba(248,244,234,0.2)" if dark else "rgba(20,48,46,0.18)"
    segs = "".join(f'<div style="width:44px;height:4px;border-radius:2px;background:{on if i+1==n else (done if i+1<n else todo)}"></div>'
                   for i in range(total))
    cap = f'<p style="font-size:24px;font-weight:500;color:{MUTE_D if dark else MUTE_L};margin-left:16px;white-space:nowrap">{label}</p>' if label else ""
    return (f'<div style="position:absolute;left:128px;top:1000px;display:flex;gap:8px;align-items:center">{segs}{cap}</div>')


def caption(text, left, top, width, dark=True, align="left"):
    return P(text, left, top, width, 24, MUTE_D if dark else MUTE_L, 500, 1.35, extra=f"text-align:{align}")


def write(out, slides, order, deck_title, sections, notes_title=""):
    os.makedirs(out + "/slides", exist_ok=True)
    for k in order:
        open(f"{out}/slides/{k}.html", "w").write(slides[k])
    deck = {"v": 4, "createdOnFiles": {"v": 1, "at": "2026-10-21T08:00:00Z"}, "lists": "css", "title": deck_title,
            "order": order, "cover": order[0],
            "sections": sections,
            "faces": {"be-vietnam-pro": {"family": "Be Vietnam Pro",
                      "href": "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@200;300;400;500;700&display=swap"}},
            "designSystems": []}
    json.dump(deck, open(out + "/deck.json", "w"), ensure_ascii=False)
