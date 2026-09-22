-- Raw relay provenance is useful to operators but must never be exposed by
-- the anonymous PostgREST surface. Keep public Monitoring on typed columns.
-- Column grants require removing the earlier table-wide grants from 018/019.

revoke select on public.environmental_readings from anon;
grant select (
  id, message_id, station_id, salinity, water_level, water_ec_ms_cm,
  water_temp_c, fault_flags, ec_probe_status, ultrasonic_status, timestamp,
  created_at
) on public.environmental_readings to anon;

revoke select on public.soil_readings from anon;
grant select (
  id, message_id, station_id, air_temp_c, air_humidity_pct, soil_temp_c,
  soil_moisture_pct, soil_ec_ms_cm, soil_ph, fault_flags, timestamp, created_at
) on public.soil_readings to anon;
