# Firmware readiness — I-22 (remove the EC×0.64 salinity fallback)

**Status:** patched at source, host-tested, **compiled for ESP32 (compile-only, 21 Oct, see below), not flashed anywhere.**
Flashing a physical device is on the "needs your explicit approval" list (`docs/APPROVAL_CHECKLIST.md`, items F1-F3).

## The defect
`firmware/esp32-node/src/trạm 1.ino` (STATION_01) read salinity from the probe register `REG_SALINITY_PPM (0x0008)`.
When that register read **failed**, it substituted `ecMsCm × 0.64` and sent the result as if it were a measured salinity.
That is a derived guess presented as a measurement (and EC is not salinity). Downstream, the number looked real.

## The patch (source level)
- New header `firmware/esp32-node/src/shared/water_salinity.h` (`namespace horizon`, header-only, no Arduino dependency):
  - `salinityPptFromRegister(registerOk, registerPpm)` → `ppm/1000` when the register read succeeded (a genuine `0` stays `0`),
    otherwise `NAN`. Never derived from EC.
  - `filteredAverageFinite(values, n)` → averages **finite** samples only (trimmed mean when ≥ 4 valid); returns `NAN`
    if none — a window of failures can no longer average into `0`.
- `.ino`: fallback line replaced by the header call; `filteredAverage` delegates to `filteredAverageFinite`; include added.
  Line endings preserved (CRLF) so the diff is minimal (`git diff -w`: 10 insertions, 63 deletions of which most are the
  removed duplicate averaging code).
- A missing value is transmitted as `x` in the packet (`S1|seq|min|dist|water|ec|temp|tds|sal|bat_v|bat_pct|CRC`), which
  the ingest path already treats as NULL ("missing is never zero").

## Evidence available now
| Check | Result |
|---|---|
| Host C++ test `firmware/esp32-node/tests/water_salinity_host.cpp` (g++ -std=c++17) | pass: register passthrough incl. true zero; failure → NaN regardless of EC; aggregation skips NaN; all-NaN → NaN; trimmed mean |
| `npm run test:firmware-host` | 13/13 (includes a guard that the `.ino` contains no `ecMsCm * 0.64`) |
| Ingest side: edge-ingestion + web tests (missing salinity stays NULL, partial rows accepted) | pass; plus migration `031` partial-reading tests |
| Local stack: a packet with missing salinity ingested through the real Edge Function + Postgres | stored as NULL — `edge-ingest.e2e.mjs` 12/12, see `docs/QA_FLOW_MATRIX.md` |

## NOT yet evidenced (why flashing is not requested casually)
1. **ESP32 compile — DONE (compile-only).** `pio run -e station1|station2|gateway` (PlatformIO 6.2.0, espressif32@6.12.0, framework-arduinoespressif32 3.20017.0, xtensa 8.4.0) on an isolated scratch copy of this repository; nothing was flashed and no device was contacted. Results: **station1 SUCCESS** (RAM 7.2 %, flash 26.1 %), **station2 SUCCESS** (7.2 % / 26.2 %), **gateway SUCCESS** (15.1 % / 66.8 %). This proves the patched sources build; it does not prove runtime behaviour. To reproduce on your machine:
   ```
   npm run firmware:build:station1      # compile only — flashes nothing
   npm run firmware:build:gateway && npm run firmware:build:station2    # regression: other targets still build
   ```
   Send me the last 20 lines of each (or the errors). Compile-only is safe and reversible.
2. **Bench behaviour on a spare board / the probe on a bench** (not the field node): confirm (a) register OK → salinity matches
   the probe display, (b) unplug the RS-485 data line → packet carries `x` for salinity and the ingest stores NULL.
3. **Hardware validation gate** (`docs/HARDWARE_VALIDATION_GATE.md`) remains the authority for any field change.

## Flashing request (to be answered only after 1 and 2 are done)
- Target: STATION_01 only (STATION_02 / gateway sources are unchanged by this patch).
- Rollback: keep the currently flashed binary (`.pio/build/station1/firmware.bin` from a build of the previous commit,
  or the factory image) and re-flash it the same way; no data migration is involved.
- Success evidence after flashing: `docs/READONLY_PRODUCTION_QUERIES.sql` Q5 — rows with `salinity = 0` while EC > 1 mS/cm
  should stop appearing; failed reads show as NULL.
- Until then the dashboard must keep its present honest labelling: salinity shown only when stored, never inferred.
