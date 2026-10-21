# HORIZON EN pitch v2: asset inventory

Every image in the deck is real or a direct product capture. Processing is limited to cropping, resizing and one light,
uniform grade (contrast ×1.05, saturation ×0.94), done by `source-v2/prep_images.py`. No generative editing and no
content removed or added. EXIF/GPS is not carried into the deck files.

## Used in the deck

| Slide | Deck file | Original | Size (orig.) | Source | What it shows / caption limits |
|---|---|---|---|---|---|
| 01 | `aerial.jpg` | `docs/presentations/source/assets/cover-aerial.jpg` (same scene as `apps/web/public/assets/landscape/con-ho-aerial.jpg`) | 1920×1080 | Supplied by the project (`status: verified` in content/gallery) | Aerial of Cồn Hô. Slightly soft at full screen (master is 1390 px wide). |
| 03 | `gate.jpg` | `apps/web/public/assets/field/con-ho-entrance-gate.jpg` | 800×700 | Supplied by the project (verified) | Entrance gate "Du lịch Cồn Hô". Shown at 760 px wide. |
| 04 | `boat.jpg` | `apps/web/public/assets/IMG_1612.heif` | 4032×3024, iPhone 13, 5 Sep 2026 11:48 | HORIZON team | Team passing an equipment box from a boat at the river landing. 16:9 crop, clouds kept. |
| 05 | `workshop-tall.jpg` | `apps/web/public/assets/IMG_1696.heif` | 4032×3024, iPhone 13, 5 Sep 2026 13:21 | HORIZON team | Three team members assembling/checking open station enclosures under a shelter. Left 560 px of the original cropped. |
| 06 | `station-tall.jpg` | `apps/web/public/assets/IMG_1522.HEIC` | 3024×4032, iPhone 12 Pro Max, 9 Oct 2026 16:26 | HORIZON team | A solar-powered station (panel, sealed enclosure) with a team member, Cồn Hô sign behind. **Which station it is: to confirm.** Annotated with two labels only. Not evidence of validated operation. |
| 13 | `station-wide.jpg` | same IMG_1522 | 16:9 band, rows 900–2601 | HORIZON team | Same scene, closing crop. |
| 08 | `shot-dashboard-live.jpg` | `docs/presentations/source/assets/shot-dashboard-live.jpg` | 2000×1334 | Capture of the live public Observatory, 21 Oct 2026 | Unedited. Shows the pre-21-Oct soil box design and real values (salinity 0.06 ‰, level 293 cm). |
| 08 | `report-mobile.jpg` | `docs/presentations/source/assets/report-mobile.jpg` | 1170×2290 | Capture of the live Report page | Unedited. |
| 11 | `dusk.jpg` | `docs/presentations/source/assets/sunset-tall.jpg` (from `field/con-ho-river-sunset.jpg`) | 1234×1080 | Supplied by the project (verified) | The river at dusk from a landing. |
| 01, 13 | `horizon-wordmark.png` | `docs/presentations/source/assets/horizon-wordmark.png` | 1238×370 | Owner brand asset | Official HORIZON wordmark, unmodified. |
| 01 | `frogsleap-logo-1.png` | `apps/web/public/assets/brand/frogsleap-logo-1.png` | 703×651 | Owner brand asset | Frogsleap Foundation sticker logo, unmodified. |

## Inspected and deliberately not used

| Asset | Reason |
|---|---|
| `field/erosion-riverbank.jpg`, `field/erosion-sandbags.jpg`, `1-3727.avif`, `35-6637.avif` | Báo Tiền Phong press photos with watermark; third-party rights. Usable only with permission and credit. |
| `field/con-ho-visitors.jpg`, `1911.du-lich-con-ho1/2.jpg` | Press/tourism photos (Phụ nữ Online etc.); third-party, not HORIZON fieldwork. |
| `lua-tom.jpg`, `vuon-cay-gia-tri-cao.webp`, `awd.webp`, `sequence-…webp` | Generic agriculture images of unknown provenance; would imply HORIZON results. |
| `backgrounds/*.png`, `hero/hero.png`, `map/con-ho-network-illustration.png` | Illustrations. Good for the website; in a funding pitch they compete with real photographs and can read as evidence. |
| `hardware/*.jpg` (boards, probes on cardboard) | Bench photos. Real, but the new field photos tell the hardware story better; kept as candidates for an appendix or Q&A. |
| `technical stuffs/*` | Empty folders. |

## People in photographs
IMG_1612, IMG_1696 and IMG_1522 show identifiable team members (and, at the landing, possibly bystanders). Confirm consent
before any external distribution. This is listed as a placeholder in `EN-v2-design-rationale.md`.
