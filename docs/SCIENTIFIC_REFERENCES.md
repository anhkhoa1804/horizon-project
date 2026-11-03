# Scientific references and threshold specification

The basis for every interpretation HORIZON puts on screen — and, more often,
the reason it refuses to put one there.

## The rule

**A number gets a colour only when a published threshold applies to the exact
quantity the sensor produces, in the context it is produced in.** Where that is
not true the value is shown plainly. Filling every box with a status would make
the dashboard look more knowledgeable than the project is.

## Three kinds of threshold, kept separate

The single most important structural decision in this document. Collapsing
these into one `OK/WARN/CRITICAL` ladder is what turns a reference figure into
an overstated scientific claim.

| Layer | Meaning | Example |
| --- | --- | --- |
| **REFERENCE** | Published guidance, used to explain a reading | FAO ECw < 0.7 dS/m = no restriction |
| **OPERATIONAL** | What HORIZON actually colours and alerts on | pilot ECw ladder for a pomelo orchard |
| **QUALITY** | Whether the measurement itself is trustworthy | soil EC is unreliable below 20% moisture |

A threshold may be REFERENCE without ever becoming OPERATIONAL. That is a
normal outcome, not an unfinished one.

---

## P0 — unit verification before any operational salinity threshold

**HORIZON records the probe's EC, temperature, TDS and salinity registers, but
the salinity register-to-display unit chain has not been field-verified.**

The ES-EC-WT-01 measures **electrical conductivity** and exposes separate
salinity/TDS registers. Nothing in the device documentation licenses treating
every "salinity" value it returns as ‰. The current `readWaterEc()` path is
implemented and real observations are retained, but implementation is not the
same as calibration or physical verification at the installation site.

If the raw register is mg/L or ppm and the UI prints ‰, that is a **unit
error**, not a threshold disagreement — and no threshold placed on top of it
would mean anything.

**Required order of work:**

1. Verify `register → raw unit → conversion → displayed unit` against the
   datasheet.
2. Keep **water EC** as its own stored quantity (mS/cm, numerically equivalent
   to dS/m) rather than deriving it from salinity.
3. Only if salinity in ‰ is still wanted, calibrate EC ↔ salinity against the
   actual water at Cồn Hô.
4. Only then enable a salinity threshold.

Until step 1 is done, no salinity threshold should enter the database.

---

## ‰ ↔ dS/m — still not converted

Salinity (‰, a mass concentration) and conductivity (dS/m) are different
physical quantities. The constant relating them depends on ionic composition
and temperature, and at Cồn Hô the water is a river/seawater mixture whose
composition varies with the very quantity being measured — the worst case for a
fixed factor. Rules of thumb (TDS ≈ 640 × EC) are calibrated for particular
water types and carry errors large enough to move a reading across a decision
boundary.

**No conversion is performed anywhere in the codebase, and none should be.**

---

## Water — ECw

The strongest basis available. FAO Irrigation & Drainage Paper 29 rev. 1
(Ayers & Westcot, 1985) classifies irrigation water by conductivity:

| ECw (dS/m) | Degree of restriction on use |
| --- | --- |
| < 0.7 | None |
| 0.7 – 3.0 | Slight to moderate |
| > 3.0 | Severe |

FAO is explicit that EC must be read together with soil, crop and use context
rather than as an absolute biological boundary.
Source: <https://www.fao.org/4/x5871e/x5871e07.htm>

### Why the FAO ladder is not used directly here

Cồn Hô grows **pomelo (Citrus maxima)**, which FAO classes as salt **sensitive**.
FAO's crop salt-tolerance data gives pummelo roughly **1.5 dS/m — but as ECe,
the soil saturated-paste extract**, not as ECw of irrigation water. The two must
not be equated.
Source: <https://www.fao.org/4/y4263e/y4263e0e.htm>

Citrus irrigation-water guidance (grapefruit as the nearest proxy) puts ~1.2
dS/m at no yield loss, ~1.6 at ≈10%, ~2.2 at ≈25%, ~3.3 at ≈50%.

### Adopted: two layers

**REFERENCE (FAO):** `<0.7` none · `0.7–3.0` slight-to-moderate · `>3.0` severe.

**OPERATIONAL (pilot, pomelo orchard):**

| ECw (dS/m) | Status |
| --- | --- |
| < 0.7 | NORMAL |
| 0.7 – 1.2 | WATCH |
| 1.2 – 1.6 | WARNING |
| > 1.6 | CRITICAL |

**This ladder must always ship with its provenance:** *pilot operational
threshold derived from citrus proxy data; not calibrated for Da Xanh pomelo at
Cồn Hô.* The figures 1.2 and 1.6 are **not** "FAO thresholds" and **not**
"scientific thresholds for Da Xanh pomelo".

Blocked behind the P0 unit work above.

---

## Water — pH · READY TO ADOPT

FAO treats **6.5 – 8.4** as the normal range for irrigation water; outside it is
a signal to investigate.
Source: <https://www.fao.org/4/x5871e/x5871e07.htm>

| Water pH | Status |
| --- | --- |
| 6.5 – 8.4 | NORMAL |
| outside 6.5 – 8.4 | WARNING — needs assessment |
| outside sensor range | SENSOR FAULT |

Deliberately **three states, not four**. FAO does not provide a severity ladder
strong enough to call any specific pH a critical environmental risk, so no
CRITICAL band is invented.

---

## Soil — pH · READY TO ADOPT

The one metric with genuinely local evidence. A January 2026 study of
**saline-alluvial soil under Da Xanh pomelo at Lương Hòa, Vĩnh Long** recorded
topsoil pH(H₂O) of **4.47 – 5.68** across three profiles and concluded that pH,
EC and organic matter needed improvement.
Source: <https://vjol.vista.gov.vn/tcnongnghiepmoitruong-vie/vi/article/view/125451>

Other Mekong Delta pomelo work reports better development above pH 5.0;
UF/IFAS citrus guidance puts the optimum near 6.0 – 6.5.

| Soil pH | Status |
| --- | --- |
| < 5.0 | CRITICAL |
| 5.0 – 5.5 | WATCH |
| 5.5 – 6.5 | NORMAL / target |
| 6.5 – 7.0 | WATCH |
| > 7.0 | WARNING |

Provenance to display: *citrus/pomelo agronomic reference — not a
Cồn Hô-specific validated threshold.*

The 5.0 boundary is preferred precisely because Mekong Delta pomelo literature
stands behind it rather than a generic table.

---

## Soil — EC · NOT SET, deliberately

FAO's soil-salinity figures describe **ECe**, the saturated paste extract — a
laboratory preparation. The ES-SM-THEC-01 reports **bulk soil EC in situ**.
These are different quantities, related through soil-specific factors (water
content, bulk density, temperature).

**No soil-EC colour ladder is adopted.** Applying 1.3 / 3 / 6 / 10 dS/m to a
bulk in-situ reading would be a category error.

## Soil EC measurement confidence · READY TO ADOPT (QUALITY layer)

The sensor manufacturer requires soil moisture **above 20%** for a dependable
ion/EC reading, and recommends measuring after rain or irrigation.

| Soil moisture | Meaning for soil EC |
| --- | --- |
| ≤ 20% | LOW CONFIDENCE — treat EC with caution |
| > 20% | measurement conditions adequate |

This is a **measurement-quality** threshold, not a statement about salinity. It
prevents the dashboard turning a cell red for "high EC" when the probe is
simply in unsuitable conditions.

---

## Soil — moisture · SITE-DERIVED, no fixed percentage

USDA/NRCS defines field capacity, permanent wilting point and available water,
and is clear that an irrigation trigger should be expressed as a **fraction of
available water depleted**, not as a bare "moisture < 30%".
Sources: <https://www.nrcs.usda.gov/sites/default/files/2022-10/nrcs142p2_051590.pdf>,
<https://www.wcc.nrcs.usda.gov/ftpref/wntsc/waterMgt/irrigation/NEH15/ch4.pdf>

USDA offers 50% depletion as a starting assumption where local data is absent —
a management rule, not a biological constant.

**Formula to implement rather than a number to hard-code:**

```
threshold = FC − MAD × (FC − PWP)
```

Illustration only: FC 35%, PWP 17%, MAD 50% → ≈26%. **26% must not be
hard-coded for Cồn Hô**; it has to come from the site's own FC and PWP.

Admin should therefore carry a soil-water model — field capacity, permanent
wilting point, management-allowed depletion — and derive the warning and
critical moisture levels from them.

---

## Not interpreted, and why

| Metric | Status shown | Reason |
| --- | --- | --- |
| Soil temperature | value only | Crop optima do not map cleanly onto a probe-depth temperature alarm |
| Air temperature | value only | Every official index (heat index, humidex, WBGT) is a function of temperature **and** humidity, sometimes radiation and wind |
| Air humidity | value only | Same |
| Water level | value only | `water_level_cm` is geometry from the A02YYUW mount. A flood threshold needs a surveyed datum tying it to bank, root-zone and path elevations at Cồn Hô. Sensor range ≈ 3–450 cm, ±1 cm — outside that is a sensor fault, not a flood |

---

## Device health — engineering, not environment

Implemented in `lib/monitoring/status.ts`:

| Metric | WATCH | WARNING | CRITICAL |
| --- | --- | --- | --- |
| Battery | ≤ 3.8 V | ≤ 3.6 V | ≤ 3.4 V |
| Signal | ≤ −85 dBm | ≤ −95 dBm | ≤ −100 dBm |

These are the hardware's own operating limits — a Li-ion discharge floor and a
link budget — which is why they are allowed a status while soil pH is not.
Label them **DEVICE HEALTH**, never environmental status.

## Wind and rainfall

Wind uses the WMO Beaufort scale, which is defined on wind speed alone — the
reason it is safe to apply where the humidity/temperature indices above are
not. Rainfall uses conventional intensity classes on depth per unit time. Both
values come from the external weather model (Open-Meteo), not from HORIZON
hardware, and carry `origin: "external"` in the model.

---

## Consolidated table

| Metric | Unit | Normal | Watch | Warning | Critical | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| Water ECw | dS/m | <0.7 | 0.7–1.2 | 1.2–1.6 | >1.6 | FAO + citrus proxy — **blocked on P0** |
| Water pH | pH | 6.5–8.4 | — | outside 6.5–8.4 | sensor fault only | FAO |
| Soil pH | pH | 5.5–6.5 | 5.0–5.5 / 6.5–7.0 | >7.0 | <5.0 | Citrus + Vĩnh Long pomelo |
| Soil EC | dS/m | **not set** | **not set** | **not set** | **not set** | bulk EC ≠ ECe |
| Soil EC confidence | — | moisture >20% | — | — | ≤20% ⇒ low confidence | Sensor spec |
| Soil moisture | % | site-derived | site-derived | site-derived | PWP-derived | FAO/USDA |
| Soil temperature | °C | value only | — | — | sensor validity | insufficient basis |
| Air temp / RH | °C / % | value only | — | — | — | avoid single-variable claim |
| Water level | cm | value only | — | site-derived | site-derived | needs local elevation survey |
| Battery | V | >3.8 | ≤3.8 | ≤3.6 | ≤3.4 | engineering |
| Signal | dBm | >−85 | ≤−85 | ≤−95 | ≤−100 | engineering |

---

## Known defect: hard-coded advice in station firmware

`buildGrapefruitAdvice()` in `firmware/esp32-node/src/trạm 2.ino` applies fixed
values with no derivation:

- soil moisture **> 80%** → "too wet"
- soil moisture **< 35%** → "consider irrigation"
- soil EC **≥ 1.5 / ≥ 2.0 mS/cm** → warnings

35% is the most dangerous of these: it *looks* precise while having no FC/PWP
basis for Cồn Hô's soil. The EC values inherit the bulk-EC-vs-ECe problem above.

Its **pH ladder (<5.0, 5.5–6.5, >7.0) already matches** the soil-pH
recommendation in this document and can stay.

Intended shape:

```
measurement → site calibration → FC / PWP → MAD
            → calculated moisture thresholds → advice
```

Not changed in this pass: it is firmware belonging to another contributor and
altering agronomic behaviour on a field device is not a frontend edit.

---

## Threshold registry — the intended data model

Every stored threshold should carry its own provenance, so a pilot figure can
never be read as settled science:

```
metric · unit · value · severity · basis · source · scope
       · status · effective_from · updated_by
```

`status` progresses **REFERENCE → PILOT → SITE-VALIDATED**. Only a
site-validated threshold should drive an operational alert without a caveat
beside it.

**Implemented in migration 023** as `threshold_registry`, with the full
provenance set — `quantity`, `basis`, `source_title`, `source_url`,
`source_locator`, `scope`, `validation_status`, `effective_from`.

Two safeguards are in the schema rather than in application discipline:

- `is_active` decides whether a row produces status at all. Twenty-one rows are
  seeded; **six are active, and all six are `DEVICE_HEALTH`** (battery and
  signal). Every scientific reference colours nothing.
- A CHECK constraint (`reference_rows_cannot_be_active`) makes it impossible to
  activate a row still marked `REFERENCE`. A citation cannot become an alert
  rule by an edit that forgets the distinction.

`quantity` is a separate column from `metric_key` and the resolver matches on
it, so an ECe figure can never be evaluated against a bulk in-situ EC reading.
`water_salinity` and `soil_ec_bulk` are seeded with **no threshold at all** —
the first because its unit chain is unverified, the second because FAO's
figures describe ECe.

Soil moisture has no percentage in the registry. `soil_water_models` stores
FC, PWP and MAD per station and Postgres **generates** the irrigation trigger
from them, so it cannot drift from its inputs. No default row is seeded: a
guessed field capacity would produce a confident-looking threshold for soil
nobody has measured.

The registry is published on Quan trắc under "Cơ sở diễn giải số liệu", with
each row's basis, source and whether it is currently in use — so the claim
that every figure is traceable can be checked without an account.

---

## Ready to adopt now

1. **Water pH** — 6.5–8.4 normal, outside = warning.
2. **Soil pH** — 5.5–6.5 target, <5.0 critical, with pomelo-reference provenance.
3. **Soil EC measurement confidence** — moisture ≤20% ⇒ low confidence.

Reference-only pending site validation: water ECw. Not to be hard-coded: soil
EC, soil moisture %, flood level, soil temperature, air temperature/RH status.

**Research credit:** the threshold analysis, the local Vĩnh Long pomelo source
and the three-layer REFERENCE/OPERATIONAL/QUALITY model are the project owner's
work, recorded here.
