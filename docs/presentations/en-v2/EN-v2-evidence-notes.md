# HORIZON EN pitch v2: technical appendix — source and evidence notes

The deck's appendix slides (A1–A4) summarise these. Evidence levels:
- **F**: field photograph;
- **L**: live observation of the production system (read-only);
- **S**: software test (unit, or the isolated local staging stack);
- **C**: compile-only;
- **R**: regional context, not a HORIZON measurement;
- **P**: plan.

| Slide | Statement | Level | Source in the repository |
|---|---|---|---|
| 01, 03 | Cồn Hô is a river island in Vĩnh Long, about 1 km long | R / project description | `apps/web/content/gallery/*` (aerial caption) |
| 03 | Dry-season river water in the Mekong Delta can turn brackish | R | General regional context; no HORIZON figure is quoted |
| 04, 05 | Team transported and assembled equipment on 5 Sep 2026 | F | IMG_1612, IMG_1696 (EXIF dates); user description |
| 06 | Two sensing stations + one gateway; the gateway measures nothing | design + F | `docs/CURRENT_PRODUCT_STATUS.md` (STATION_01 water, STATION_02 soil, STATION_03 gateway) |
| 06 | Sensors per station | design | `docs/SENSOR_CAPABILITY_MATRIX.md` |
| 06, 09, 10 | STATION_02 has no stored readings; battery replacement pending | L + owner statement | `docs/AUDIT_ISSUES.md`; owner brief 21 Oct 2026 |
| 07 | Values stored with time and source; missing shown as missing | S + L | `apps/web/tests/dataIntegrity.test.ts`, `observatoryComposition.test.ts`; live capture |
| 08 | Observatory and Report pages | L | Live-site captures 21 Oct 2026 (`docs/presentations/source/assets/`) |
| 09 | 6,465 water readings since 25 Sep 2026 | L | Read-only count made on 21 Oct 2026 during the audit; recorded in the v1 deck appendix (`source/build_en.py`, A1) |
| 09 | New water readings ≈ every 2.5 min | L | `docs/AUDIT_ISSUES.md` I-18 live observation |
| 10, A2 | 322 of the last 1,000 water readings store salinity = 0 | L | `docs/AUDIT_ISSUES.md` I-23; SQL in `docs/READONLY_PRODUCTION_QUERIES.sql` |
| A2 | EC/temperature not shown publicly; fix 035 ready | S | `docs/MIGRATION_035_RUNBOOK.md` |
| A2 | Firmware EC×0.64 fallback removed, compiled, not flashed | S + C | `docs/FIRMWARE_I22_READINESS.md` |
| A1 | 368 unit tests; browser and staging suites | S | `docs/RELEASE_REPORT.md`, `docs/QA_FLOW_MATRIX.md` (local staging, not production) |
| A3 | Release gates | P | `docs/APPROVAL_CHECKLIST.md`, `docs/MIGRATION_036_RUNBOOK.md`, `docs/HARDWARE_VALIDATION_GATE.md` |
| 11, 12 | Roadmap and asks | P | Durations, amounts, operator and partner names are placeholders |

**Not claimed anywhere in the deck:**
- sensor accuracy;
- calibration results;
- validated thresholds;
- long-term uptime;
- crop or yield impact;
- community adoption figures;
- soil readings of any kind;
- carbon measurement.

The development soil fixture (`HORIZON_DEV_SOIL_FIXTURE`) is never shown.
