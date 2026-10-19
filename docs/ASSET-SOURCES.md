# Asset and reference sources

Everything in this file is a claim the product makes on screen. If a line here
cannot be traced to the source named beside it, the corresponding UI must be
removed rather than left in place.

## Imagery

`apps/web/public/assets/` contains project-made material plus a small number
of owner-supplied photographs:

| Path | What it is |
| --- | --- |
| `brand/horizon-logo.png` | Owner-supplied logo. Not redrawn, not regenerated. |
| `brand/horizon-icon.png` | Owner-supplied favicon source. |
| `brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | PWA icons derived from the supplied icon. |
| `hero/hero.png` | Owner-supplied illustration of the islet, used as the Home hero backdrop. An illustration, not a photograph — it is never captioned as one. |
| `field/con-ho-entrance-gate.jpg` | Owner-supplied photograph: the entrance to Cồn Hô. |
| `field/con-ho-river-sunset.jpg` | Owner-supplied photograph: the river branch around the islet at dusk. |
| `hardware/board-gateway.jpg`, `board-station-water-soil.jpg` | Photographs of the project's own fabricated boards. Vietnamese silkscreen, ESP32-S3 + LoRa + cellular. |
| `hardware/sensor-*.jpg` | Photographs of the actual sensor units: ultrasonic, water EC, soil EC, soil pH, air temp/humidity. |
| `illustrations/con-ho-station-map.png` | Project-drawn station map. Labelled in the UI as an illustration, never as satellite imagery. |
| `illustrations/*-placeholder.svg` | Project-drawn technical diagrams. Labelled as diagrams, never as photographs of hardware. |
| `gallery/gallery-placeholder-*.svg` | Project-drawn placeholders, still used as covers for three field notes. |

The two `field/` photographs show the PLACE — the islet and its river. They
are not photographs of installed hardware, and nothing in the product
presents them as such. No deployment photography exists, because no
deployment has happened.

### Third-party press photography — used with credit

At the owner's direction these are published, each carrying its outlet credit
in the gallery entry's `source` field (rendered small, beneath the caption):

| File | Credit | Note |
| --- | --- | --- |
| `field/erosion-riverbank.jpg` | Báo Tiền Phong | Regional context, not Cồn Hô |
| `field/erosion-sandbags.jpg` | Báo Tiền Phong | Regional context, not Cồn Hô |
| `field/con-ho-visitors.jpg` | Phụ nữ Online | Cồn Hô entrance |

Each is captioned `status: illustrative`, and the two erosion frames say in
their caption that they show the region rather than the islet, so neither can
be read as HORIZON field documentation.

**Standing caveat, recorded rather than argued:** these carry visible outlet
watermarks and no reuse licence has been established. Credit is attribution,
not permission. If any outlet objects the file should be removed — which is
why they are isolated in `field/` and referenced from exactly one gallery
entry each.

### Supplied but not used

| File | Why |
| --- | --- |
| `1911.du-lich-con-ho2.jpg` | Near-duplicate of the visitors frame already used |
| `1080.avif`, `Thiết kế chưa có tên.png` | Source files; their converted outputs (`landscape/con-ho-aerial.jpg`, `map/con-ho-network-illustration.png`) are what ship |
| `technical stuffs/*` | HEIC masters; converted into `hardware/*.jpg`, which is what ships |
| `brand/frogsleap-logo-*.png` | Partner marks, no placement decided |
| `qr-dashboard.svg` | Encodes a pre-`/observe` URL; regenerate before printing |
| `sequence-…webp` | Provenance unknown |

### If field imagery is added later

Accept only public domain, CC0, or an explicitly permissive licence, or
institutional media with written reuse terms. Record the URL, the licence and
the date checked in the table above. If reuse status cannot be established,
the file does not enter `public/`.

## Basemap

| Item | Source |
| --- | --- |
| Tiles | Esri World Light Gray Base / World Dark Gray Base (`server.arcgisonline.com`), key-free |
| Attribution | Rendered once, in the site footer (`footer.mapAttribution`), on every page |

Esri's and OpenStreetMap's terms require the credit be **displayed**, not that
it be displayed inside the map frame. It is therefore printed in the footer
rather than as a Leaflet control over the Bento's map cell.

## Station coordinates

Supplied by the project owner in degrees/minutes/seconds, converted once in
`apps/web/lib/geo.ts`:

| Station | DMS | Decimal |
| --- | --- | --- |
| STATION_01 | 10°04'26.3"N 106°15'01.5"E | 10.073972, 106.250417 |
| STATION_02 | 10°04'20.8"N 106°15'11.0"E | 10.072444, 106.253056 |
| STATION_03 | 10°04'15.6"N 106°15'15.0"E | 10.071000, 106.254167 |

The island reference point (`CON_HO`) is the centroid of these three,
**computed** from them rather than typed in. It replaced a hand-entered
constant of 10.2419, 105.826 that was roughly 48 km away — which mattered,
because that value was the query point for regional weather, so the product
was showing another location's conditions.

## Weather

| Item | Source |
| --- | --- |
| Provider | Open-Meteo (`api.open-meteo.com`), key-free, model output |
| Nature | Regional model grid cell — **not** a measurement from HORIZON hardware |

## Interpretation rules

Only two of the four regional readings carry a one-line interpretation. The
rule applied in `apps/web/lib/monitoring/context.ts` is that a value gets a
context line **only if a published single-variable classification exists**.

### Wind — Beaufort scale (WMO)

Standard wind-force bands, km/h at 10 m. Collapsed to five phrases; the force
number is not printed, because a regional model grid cell does not justify
that precision.

| Band | km/h |
| --- | --- |
| Calm | < 1 |
| Light | 1 – 11 (B1–B2) |
| Moderate | 12 – 28 (B3–B4) |
| Fresh | 29 – 49 (B5–B6) |
| Strong | ≥ 50 (B7+) |

### Precipitation — rainfall intensity classes

Standard meteorological intensity bands, mm/h. Open-Meteo's `precipitation`
for a `current` query is the accumulation over the current hour, so mm/h
boundaries apply directly.

| Band | mm/h |
| --- | --- |
| None | 0 |
| Light | < 2.5 |
| Moderate | 2.5 – 7.6 |
| Heavy | 7.6 – 50 |
| Violent | ≥ 50 |

### Temperature and humidity — deliberately NO interpretation

There is no published single-variable classification for either. Every
official index that judges "muggy", "oppressive" or "comfortable" — heat
index, humidex, WBGT — is a **function of temperature and humidity together**.
Labelling a bare temperature, or a bare relative humidity, would be inventing
a rule no source supports. The two cells therefore show the value alone.

Neither context line implies danger. This is regional model data from outside
the network, and the network has no basis for issuing a weather warning.

## Device state

`signal` and `battery` carry a one-line state derived from the **same** bands
`statusFor()` already uses for the box's status colour
(`BATTERY_V`, `SIGNAL_DBM` in `apps/web/lib/monitoring/status.ts`), so the
phrase and the colour cannot disagree. These describe the hardware, not the
environment.

## Salinity and EC — UNRESOLVED, and stated as such

The product must not convert between ‰ and dS/m.

`1 mS/cm = 1 dS/m` is a definition and is safe. **Salinity in ‰ is not
convertible from conductivity by a universal constant** — the relationship
depends on ionic composition and temperature, and the appropriate standard
(e.g. PSS-78 for seawater) does not transfer to brackish river water of
unknown composition without local calibration.

Current state of the pipeline:

- The water station's intended salinity source is an EC probe
  (`ES-EC-WT-01`).
- **The firmware does not yet read that probe** — documented on Home's
  hardware chapter as the largest unfinished part of the system.
- The salinity thresholds configured in the database come from internal
  project notes and have **not** been reconciled against an independent
  scientific source. The Monitoring reference panel says so, in the UI, rather
  than presenting them as recognised standards.

Until calibration is resolved, no conversion is performed and no threshold is
presented as authoritative.
