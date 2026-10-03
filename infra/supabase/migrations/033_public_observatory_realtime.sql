-- Latest-only, allowlisted public telemetry. Raw relay payloads stay private.
create table if not exists public.observatory_live_readings (
  station_id text primary key references public.stations(id),
  kind text not null check (kind in ('water', 'soil')),
  observation_id uuid not null,
  timestamp timestamptz not null,
  measurements jsonb not null,
  check ((station_id = 'STATION_01' and kind = 'water') or
         (station_id = 'STATION_02' and kind = 'soil'))
);
alter table public.observatory_live_readings enable row level security;
revoke all on public.observatory_live_readings from anon, authenticated;
grant select on public.observatory_live_readings to anon, authenticated;
drop policy if exists observatory_public_read on public.observatory_live_readings;
create policy observatory_public_read on public.observatory_live_readings
  for select to anon, authenticated using (station_id in ('STATION_01', 'STATION_02'));

create or replace function public.project_observatory_reading()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare measurement jsonb; reading_kind text;
begin
  if tg_table_name = 'environmental_readings' and new.station_id = 'STATION_01' then
    reading_kind := 'water';
    measurement := jsonb_build_object('salinity', new.salinity, 'water_level', new.water_level,
      'water_ec_ms_cm', new.water_ec_ms_cm, 'water_temp_c', new.water_temp_c,
      'fault_flags', new.fault_flags, 'ec_probe_status', new.ec_probe_status,
      'ultrasonic_status', new.ultrasonic_status);
  elsif tg_table_name = 'soil_readings' and new.station_id = 'STATION_02' then
    reading_kind := 'soil';
    measurement := jsonb_build_object('soil_moisture_pct', new.soil_moisture_pct,
      'soil_ec_ms_cm', new.soil_ec_ms_cm, 'soil_ph', new.soil_ph, 'soil_temp_c', new.soil_temp_c,
      'air_temp_c', new.air_temp_c, 'air_humidity_pct', new.air_humidity_pct,
      'fault_flags', new.fault_flags);
  else return new;
  end if;
  insert into public.observatory_live_readings values
    (new.station_id, reading_kind, new.id, new.timestamp, measurement)
  on conflict (station_id) do update set kind = excluded.kind,
    observation_id = excluded.observation_id, timestamp = excluded.timestamp,
    measurements = excluded.measurements
  where excluded.timestamp >= observatory_live_readings.timestamp;
  return new;
end $$;
revoke all on function public.project_observatory_reading() from public, anon, authenticated;
drop trigger if exists observatory_water_projection on public.environmental_readings;
create trigger observatory_water_projection after insert or update on public.environmental_readings
  for each row execute function public.project_observatory_reading();
drop trigger if exists observatory_soil_projection on public.soil_readings;
create trigger observatory_soil_projection after insert or update on public.soil_readings
  for each row execute function public.project_observatory_reading();

insert into public.observatory_live_readings
select station_id, 'water', id, timestamp, jsonb_build_object(
  'salinity', salinity, 'water_level', water_level, 'water_ec_ms_cm', water_ec_ms_cm,
  'water_temp_c', water_temp_c, 'fault_flags', fault_flags,
  'ec_probe_status', ec_probe_status, 'ultrasonic_status', ultrasonic_status)
from public.environmental_readings where station_id = 'STATION_01'
order by timestamp desc limit 1 on conflict (station_id) do nothing;
insert into public.observatory_live_readings
select station_id, 'soil', id, timestamp, jsonb_build_object(
  'soil_moisture_pct', soil_moisture_pct, 'soil_ec_ms_cm', soil_ec_ms_cm,
  'soil_ph', soil_ph, 'soil_temp_c', soil_temp_c, 'air_temp_c', air_temp_c,
  'air_humidity_pct', air_humidity_pct, 'fault_flags', fault_flags)
from public.soil_readings where station_id = 'STATION_02'
order by timestamp desc limit 1 on conflict (station_id) do nothing;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and
     not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                 and schemaname = 'public' and tablename = 'observatory_live_readings') then
    alter publication supabase_realtime add table public.observatory_live_readings;
  end if;
end $$;
