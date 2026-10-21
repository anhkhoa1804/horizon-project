# HORIZON presentation system v2 ("a living laboratory on a river island")
- `hz2.py`: tokens and helpers (type, colour, horizon line, evidence glyphs). Shared by every language version.
- `build_en.py`: English funding pitch copy and layout (13 main slides plus appendix A1–A4) with speaker notes.
- `prep_images.py`: makes `assets/` from `raw/`. The three field photos are the HEIF originals in
  `apps/web/public/assets/IMG_1612.heif`, `IMG_1696.heif` and `IMG_1522.HEIC`. Convert them to `raw/IMG_*.jpg` first, e.g.
  `python3 -c "from PIL import Image; import pillow_heif; pillow_heif.register_heif_opener(); Image.open(SRC).convert('RGB').save(DST, quality=94)"`.
  Copy the other originals from the paths in `../en-v2/EN-v2-asset-inventory.md`. `raw/` is not committed; `assets/` is.
- Build and render:
  `python3 build_en.py out && CHROME=<chromium> NODE_PATH=<repo>/node_modules python3 render.py $PWD/out $PWD/render`
  This writes the PNG per slide, `deck.pdf` and an off-canvas report.
- Slides artifact:
  `python3 publish_prep.py out <folder>` resolves image tokens with `blob_map.json`, the asset URLs already uploaded to the
  deck. Publish `<folder>/project/*` to the deck's URL.
- Fonts: Newsreader, Be Vietnam Pro and IBM Plex Mono (all OFL), with local copies in `fonts/` for rendering. All three
  cover Vietnamese.
- Vietnamese adaptation: copy `build_en.py` to `build_vi.py`, translate the strings and the notes, and keep `hz2.py`.
