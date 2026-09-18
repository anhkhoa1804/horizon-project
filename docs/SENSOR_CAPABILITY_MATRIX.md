# Sensor Capability Matrix

Current source-of-truth trace from field sensor to public interface. “Available”
means the code path exists; it does not claim a physical field verification or
site calibration that has not been recorded.

| Metric | Firmware | Persistence | Repository / UI | Status |
|---|---|---|---|---|
| Water level | A02YYUW checksum/range path | `environmental_readings.water_level` | snapshot, 24h/daily series, Observatory | Available |
| Water EC | ES-EC-WT-01; `ec_ms_cm` and `ec_us_cm` | `environmental_readings.water_ec_ms_cm` (024) | snapshot + chart | Available; not interchangeable with salinity |
| Water temperature | ES-EC-WT-01 `temperature_c` | `environmental_readings.water_temp_c` (024) | snapshot + chart | Available |
| Water salinity | `salinity_ppt` | `environmental_readings.salinity` | snapshot + chart | Available; no arbitrary conversion to dS/m |
| Water TDS | `tds_ppm` | authenticated raw gateway observation | not promoted to the primary Observatory | Available raw; intentionally not used as EC |
| Soil moisture | ES-SM-THEC-01 | `soil_readings.soil_moisture_pct` | latest, 24h/daily series, Observatory | Available |
| Bulk soil EC | ES-SM-THEC-01 | `soil_readings.soil_ec_ms_cm` | latest, 24h/daily series, Observatory | Available; not ECe |
| Soil temperature | ES-SM-THEC-01 | `soil_readings.soil_temp_c` | latest, 24h/daily series, Observatory | Available |
| Soil pH | ES-PH-SOIL-01 | `soil_readings.soil_ph` | latest, 24h/daily series, Observatory | Available |
| Air temperature / humidity | SHT30 | `soil_readings` | latest, 24h/daily series, context | Available |
| Battery / signal for relayed nodes | payload fields optional | nullable health log fields | honest empty state when absent | Not guaranteed by topology |
| Device acknowledgement of runtime config | no acknowledgement channel | requested config only | Admin says stored / awaiting poll | Future |

Station 01 emits TDS and salinity alongside EC. These fields remain separate
because conductivity, mass concentration, and laboratory soil ECe have
different scientific semantics. A populated field is not, by itself, a
site-validated agronomic threshold.
