-- 035: keep the public water columns in step with the ingest columns.
--
-- Background (audit item I-18)
-- ----------------------------
-- The public Observatory view (033, observatory_live_readings) and the typed
-- read models read `water_ec_ms_cm` and `water_temp_c`. Older edge-ingest
-- builds stored the probe's EC and temperature only in `ec_ms_cm` and
-- `temperature_c` (024_station_summary_ingest_fields). On the live project the
-- last readings carry a numeric salinity and water level, `fault_flags = 0`,
-- probe status "ok", and NULL `water_ec_ms_cm` / `water_temp_c`. That pattern
-- is what an ingest build without the mirror produces.
--
-- What this migration does
-- ------------------------
--  * It copies a value across only when the public column is NULL and the
--    ingest column holds a value. Nothing is overwritten, converted, rounded
--    or derived. In particular salinity is never computed from EC.
--  * It installs a BEFORE INSERT/UPDATE trigger so any ingest build, old or
--    new, keeps the two column pairs in step from now on.
--  * It deletes nothing and drops nothing. It is idempotent.
--
-- STATUS: written for review. NOT applied to any database by the audit.

create or replace function public.mirror_water_ec_temperature()
returns trigger language plpgsql as $$
begin
  if new.water_ec_ms_cm is null and new.ec_ms_cm is not null then
    new.water_ec_ms_cm := new.ec_ms_cm;
  end if;
  if new.water_temp_c is null and new.temperature_c is not null then
    new.water_temp_c := new.temperature_c;
  end if;
  return new;
end $$;

drop trigger if exists environmental_mirror_water_columns on public.environmental_readings;
create trigger environmental_mirror_water_columns
  before insert or update on public.environmental_readings
  for each row execute function public.mirror_water_ec_temperature();

-- Backfill only rows where the public column is empty and the source is not.
-- The AFTER UPDATE projection trigger from 033 refreshes the latest-only
-- public row for any station whose newest reading is touched here.
update public.environmental_readings
set water_ec_ms_cm = coalesce(water_ec_ms_cm, ec_ms_cm),
    water_temp_c   = coalesce(water_temp_c, temperature_c)
where (water_ec_ms_cm is null and ec_ms_cm is not null)
   or (water_temp_c  is null and temperature_c is not null);
