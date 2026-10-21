-- Rollback for 035: removes the trigger and function. The copied values are NOT reverted because each equals its
-- source column (ec_ms_cm / temperature_c) and nothing was overwritten; reverting them would lose public EC/temperature.
-- To also clear copies made by 035 (only if required): take the pre-flight list of affected ids first (see runbook).
drop trigger if exists environmental_mirror_water_columns on public.environmental_readings;
drop function if exists public.mirror_water_ec_temperature();
