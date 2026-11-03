# HORIZON presentation system (shared source)
- `hz.py` shared tokens and helpers. `build_en.py` English funding pitch (13 slides). `build_vi.py` Vietnamese YAI 2026 final (11 slides).
- Build: `python3 build_en.py out_en` (or `build_vi.py out_vi`) writes `deck.json` and `slides/*.html` (the 1920x1080 section files for a Slides artifact; images are `{{img:NAME}}` tokens that resolve to `assets/`).
- Render to PNG and PDF: `python3 render.py <abs out_en> <abs render_dir>` (needs Node, Playwright and a Chromium; set CHROME to its path).
- Real photos: copy them to `assets/slots/` as visit1.jpg, visit2.jpg, visit3.jpg, community.jpg; rebuild `build_vi.py`. Empty slots draw as labelled placeholders.
- Fonts: Be Vietnam Pro 200-700 (OFL), local copies in `fonts/`.
