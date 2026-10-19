# Static assets

Everything the app serves from `/assets/*` lives here. This is the single
asset root — there is no second image tree. (There used to be
`public/images/`; it was merged into this one so a reader does not have to
guess which folder is authoritative.)

## Status vocabulary

Every non-brand asset is one of:

| status        | meaning                                                     |
| ------------- | ----------------------------------------------------------- |
| `placeholder` | Abstract stand-in. Not a photograph. Safe to replace.       |
| `illustrative`| A diagram or drawing. Accurate, but not a photograph.       |
| `verified`    | Real HORIZON imagery, cleared for public use.               |

**Nothing here may be presented as HORIZON fieldwork unless it is `verified`.**
Content files under `content/gallery/*.md` carry the status for each image;
the gallery UI reads it and labels the image accordingly.

## Layout

```
assets/
├── brand/          owner-supplied identity — do not regenerate
├── hero/           per-route hero artwork (empty; awaiting owner assets)
├── gallery/        gallery + post cover images
├── illustrations/  diagrams and hardware drawings
└── backgrounds/    reserved per-route background slot
```

## brand/

Owner-supplied. **Do not regenerate, redraw, optimise or substitute these.**

| File | Used by | Notes |
| --- | --- | --- |
| `horizon-logo.png` | `components/ui/wordmark.tsx` (header + footer) | 829×301, byte-identical to the owner's original |
| `horizon-icon.png` | source of truth for every app icon | 464×333 |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `public/manifest.webmanifest` | PWA install icons |

The browser favicon and Apple touch icon are **not** here: Next.js requires
them at `app/icon.png` and `app/apple-icon.png` by file convention, and serves
them automatically. Both are the same artwork as `horizon-icon.png`, square-
cropped. If the owner supplies a new icon, all five files must be re-cut from
it together.

## hero/

Empty by design, awaiting owner-supplied artwork. `components/layout/page-hero.tsx`
already accepts a `backdrop` slot that renders behind the hero copy at z-0, so
dropping an image in and passing it needs no layout change.

## gallery/ and illustrations/

`gallery/` holds gallery entries and post cover images; `illustrations/` holds
diagrams and hardware drawings. Everything currently in both is a
`placeholder` or `illustrative` SVG — none is a photograph, and none is
presented as one.

To add a gallery image: drop the file in `gallery/`, add a matching
`content/gallery/NN-name.md` with its `image:` path and `status:`.
