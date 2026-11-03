import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * ONE GLOBAL BACKGROUND TEXTURE, EVER.
 *
 * The owner reported the pages looking busy, and the cause was two global
 * textures on screen at once: the survey grid on `.horizon-atmosphere`, plus
 * a 26px dot field attached to the shared `PageHero`. Neither looked wrong on
 * its own, they lived in different files, and every page used both — so the
 * defect was invisible in review and obvious in a screenshot.
 *
 * These tests pin the convention that replaced it:
 *
 *   1. `.horizon-atmosphere` is the SINGLE owner of whole-page background
 *      layers — grid, gradient pools, vignette.
 *   2. No other rule may paint a repeating/viewport-spanning texture.
 *   3. Exactly one BackgroundAtmosphere is mounted, in the root layout.
 *
 * A component that needs decoration inside its own box is unaffected: the
 * rule is about textures that span the viewport, not about styling a card.
 */

const css = () => fs.readFileSync(CSS, "utf8");
const CSS = path.join(process.cwd(), "app", "globals.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

describe("single global background", () => {
  it("routes every whole-page texture through .horizon-atmosphere", () => {
    const css = stripComments(fs.readFileSync(CSS, "utf8"));

    // A repeating texture is a background-image paired with a background-size
    // small enough to tile. Those two together are what makes a "field".
    const tiled: string[] = [];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css))) {
      const [, selector, body] = m;
      if (!/background-image\s*:/.test(body)) continue;
      const size = body.match(/background-size\s*:\s*([^;]+)/);
      const isTiled =
        (size && /\b\d+px\s+\d+px/.test(size[1])) || /repeating-(linear|radial)-gradient/.test(body);
      if (isTiled && !selector.includes("horizon-atmosphere")) {
        tiled.push(selector.trim().slice(0, 70));
      }
    }

    assert.deepEqual(
      tiled,
      [],
      `A second global texture appeared. Whole-page backgrounds belong in BackgroundAtmosphere:\n  ${tiled.join("\n  ")}`,
    );
  });

  it("has removed the dot field rather than merely hiding it", () => {
    const css = fs.readFileSync(CSS, "utf8");
    const live = stripComments(css);

    assert.ok(!/\.horizon-dotfield\s*\{/.test(live), ".horizon-dotfield is back as a live rule");
    assert.ok(!/--h-dot-ink\s*:/.test(live), "--h-dot-ink is back — the dot field is returning");
    // The explanatory note must survive, or the next person re-adds it.
    assert.ok(css.includes("THE DOT FIELD IS GONE"), "the note explaining why was deleted");
  });

  it("mounts exactly one BackgroundAtmosphere, in the root layout", () => {
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const mounts: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          const rel = path.relative(process.cwd(), full).split(path.sep).join("/");
          if (rel.endsWith("background-atmosphere.tsx")) continue;
          if (/<BackgroundAtmosphere\b/.test(src)) mounts.push(rel);
          // The raw class may only appear inside the component itself.
          if (/className="[^"]*horizon-atmosphere/.test(src)) mounts.push(`${rel} (raw class)`);
        }
      }
    };
    for (const r of roots) if (fs.existsSync(r)) walk(r);

    assert.deepEqual(mounts, ["app/layout.tsx"], `expected exactly one mount, got: ${mounts.join(", ")}`);
  });

  it("keeps the atmosphere behind content and out of the accessibility tree", () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), "components", "layout", "background-atmosphere.tsx"),
      "utf8",
    );
    assert.match(component, /aria-hidden/, "atmosphere must not be announced");

    const css = stripComments(fs.readFileSync(CSS, "utf8"));
    const rule = css.match(/\.horizon-atmosphere\s*\{([^}]*)\}/);
    assert.ok(rule, ".horizon-atmosphere rule missing");
    assert.match(rule[1], /position:\s*fixed/);
    assert.match(rule[1], /z-index:\s*-1/);
    assert.match(rule[1], /pointer-events:\s*none/);
  });
});

/**
 * Hero scale.
 *
 * The homepage hero was capped at 40rem, so on a 900px window it filled 71%
 * of the viewport and read as the top of a document rather than a landing
 * page. These pin the corrected geometry at the source level — the visual
 * result still needs a screenshot, but a regression in the CSS itself will
 * fail here first.
 */
describe("hero geometry", () => {
  const heroSrc = () =>
    fs.readFileSync(path.join(process.cwd(), "components", "layout", "page-hero.tsx"), "utf8");

  it("gives the display hero a full-viewport opening shell", () => {
    // The hero is now the OPENING SCENE: 100svh, starting at the document top
    // with the header sitting on it, rather than 88svh starting below the
    // header. The geometry lives in `.home-hero-shell` so the negative offset
    // and the height stay in one place.
    const css = fs.readFileSync(CSS, "utf8");
    assert.match(heroSrc(), /home-hero-shell/, "the display hero lost its opening shell");
    assert.match(
      css,
      /\.home-hero-shell\s*\{[\s\S]*?min-height:\s*calc\(100svh/,
      "the shell is no longer sized against the viewport",
    );
    assert.ok(
      !/min-h-\[clamp\([^)]*40rem\)\]/.test(heroSrc()),
      "the 40rem cap is back - it is what made the hero short",
    );
  });

  it("uses svh rather than vh, so mobile browser chrome cannot clip it", () => {
    const css = fs.readFileSync(CSS, "utf8");
    assert.ok(!/min-height:\s*100vh/.test(css.split(".home-hero-shell")[1]?.slice(0, 400) ?? ""),
      "vh lets mobile toolbars clip the hero");
  });

  it("paints the hero canvas as a sibling of the header, not inside the page", () => {
    // The canvas must sit at SHELL level. An earlier attempt rendered it
    // inside <main> and clawed back the header height and main's padding with
    // a negative margin — but --header-h is 5.5rem while the header actually
    // renders at 65px, so the hero over-pulled and left a bare strip at the
    // bottom of the first screen. At shell level `top: 0` is simply the top of
    // the page and there is nothing to compensate for.
    const shell = fs.readFileSync(
      path.join(process.cwd(), "components", "layout", "public-shell.tsx"),
      "utf8",
    );
    assert.match(shell, /backdrop/, "PublicShell lost its backdrop slot");
    const css = fs.readFileSync(CSS, "utf8");
    assert.ok(
      !/\.home-hero-shell\s*\{[\s\S]*?margin-top:\s*calc\(\(var\(--header-h\)/.test(css),
      "the fragile negative-margin offset is back",
    );
  });

  it("carries the hero canvas full-bleed from the document top", () => {
    const css = fs.readFileSync(CSS, "utf8");
    assert.match(css, /\.hero-canvas\s*\{[\s\S]*?top:\s*0/, "the hero canvas no longer starts at the page top");
    assert.match(css, /\.hero-canvas\s*\{[\s\S]*?height:\s*100svh/, "the hero canvas no longer covers the first screen");
  });

  it("puts NO gradient on any edge of the hero canvas", () => {
    // THE "BÓNG MA". The scrim used to end with `var(--h-canvas) 100%` — a
    // bottom fade meant to dissolve the picture into the page. In dark mode
    // --h-canvas is graphite, so it rendered as a dark band across the bottom
    // of the hero; in light mode, a muddy beige one. Several passes treated it
    // as a tuning problem and moved the stop lower, which only made the band
    // thinner.
    //
    // The separation from Section 01 is whitespace, not a gradient. This test
    // fails if any edge-anchored fade comes back.
    const start = css().indexOf(".hero-canvas__scrim");
    const rule = css().slice(start, css().indexOf("}", start));
    const decl = rule.slice(rule.indexOf("background:"));

    assert.ok(!/linear-gradient/.test(decl), "an edge gradient is back on the hero scrim");
    assert.ok(!/to bottom|to top/.test(decl), "a vertical fade is back on the hero scrim");
    assert.ok(!/border|box-shadow/.test(rule), "the hero canvas grew a border or shadow");
    // The one permitted treatment: a radial pool that is fully transparent
    // before it reaches the frame.
    assert.match(decl, /radial-gradient/, "the copy pool is gone");
    assert.match(decl, /transparent\s*(8\d|9\d)%/, "the pool no longer clears the frame edge");
  });

  it("keeps the reveal slow enough to be perceived as motion", () => {
    const css = fs.readFileSync(CSS, "utf8");
    const reveal = css.match(/--motion-reveal:\s*(\d+)ms/);
    assert.ok(reveal, "--motion-reveal is missing");
    const ms = Number(reveal[1]);
    assert.ok(ms >= 500 && ms <= 900, `reveal at ${ms}ms is outside the perceptible-but-not-theatrical range`);
  });

  it("has no scroll-driven parallax anywhere in the background system", () => {
    // The whole `--parallax` system — a scroll listener publishing a variable
    // that three atmosphere layers and the hero multiplied by their own
    // factors — was removed. It was repeatedly reported as either invisible
    // or wrong, and the owner asked for it gone rather than retuned.
    //
    // This guards against it being reintroduced piecemeal: a stray transform
    // reading the variable would start the same cycle again, and a partial
    // implementation left in CSS is the specific thing that was asked not to
    // happen.
    const css = fs.readFileSync(CSS, "utf8");
    assert.ok(!/var\(--parallax/.test(css), "a layer is reading --parallax again");
    assert.ok(
      !fs.existsSync(path.join(process.cwd(), "components", "ui", "parallax-root.tsx")),
      "parallax-root.tsx is back",
    );
  });
});
