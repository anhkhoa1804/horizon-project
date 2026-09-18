-- Promote the authenticated gateway history into the typed time-series tables.
--
-- Gateway firmware sends an envelope whose `raw_station_payload` contains the
-- actual station observation. Earlier web ingestion retained that envelope in
-- `gateway_observations` but did not unwrap it, leaving real Water/Soil history
-- unavailable to the Observatory. This migration is deliberately idempotent:
-- message_id remains the provenance/idempotency key and no value is inferred
-- from a different physical quantity.

alter table public.environmental_readings
  drop constraint if exists environmental_readings_ec_probe_status_check,
  drop constraint if exists environmental_readings_ultrasonic_status_check;

alter table public.environmental_readings
  add constraint environmental_readings_ec_probe_status_check
    check (ec_probe_status in ('ok', 'warn', 'fault', 'unknown')),
  add constraint environmental_readings_ultrasonic_status_check
    check (ultrasonic_status in ('ok', 'warn', 'fault', 'unknown'));

with source as (
  select distinct on (raw_payload #>> '{raw_station_payload,message_id}')
    raw_payload -> 'raw_station_payload' as reading,
    received_at
  from public.gateway_observations
  where raw_payload #>> '{raw_station_payload,station_id}' = 'STATION_01'
    and nullif(raw_payload #>> '{raw_station_payload,message_id}', '') is not null
    and (raw_payload #>> '{raw_station_payload,salinity_ppt}') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (raw_payload #>> '{raw_station_payload,water_level_cm}') ~ '^-?[0-9]+(\.[0-9]+)?$'
  order by raw_payload #>> '{raw_station_payload,message_id}', received_at desc
)
insert into public.environmental_readings (
  message_id, station_id, salinity, water_level,
  water_ec_ms_cm, water_temp_c, fault_flags,
  ec_probe_status, ultrasonic_status, timestamp
)
select
  reading ->> 'message_id',
  reading ->> 'station_id',
  (reading ->> 'salinity_ppt')::numeric,
  (reading ->> 'water_level_cm')::numeric,
  case when (reading ->> 'ec_ms_cm') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (reading ->> 'ec_ms_cm')::numeric end,
  case when (reading ->> 'temperature_c') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then (reading ->> 'temperature_c')::numeric end,
  0,
  case when reading ->> 'ec_status' in ('ok', 'warn', 'fault')
    then reading ->> 'ec_status' else 'unknown' end,
  case when reading ->> 'ultrasonic_status' in ('ok', 'warn', 'fault')
    then reading ->> 'ultrasonic_status' else 'unknown' end,
  received_at
from source
on conflict (message_id) do update set
  water_ec_ms_cm = coalesce(excluded.water_ec_ms_cm, environmental_readings.water_ec_ms_cm),
  water_temp_c = coalesce(excluded.water_temp_c, environmental_readings.water_temp_c);

with source as (
  select distinct on (raw_payload #>> '{raw_station_payload,message_id}')
    raw_payload -> 'raw_station_payload' as reading,
    received_at
  from public.gateway_observations
  where raw_payload #>> '{raw_station_payload,station_id}' = 'STATION_02'
    and nullif(raw_payload #>> '{raw_station_payload,message_id}', '') is not null
  order by raw_payload #>> '{raw_station_payload,message_id}', received_at desc
)
insert into public.soil_readings (
  message_id, station_id, air_temp_c, air_humidity_pct,
  soil_temp_c, soil_moisture_pct, soil_ec_ms_cm, soil_ph,
  fault_flags, timestamp
)
select
  reading ->> 'message_id',
  reading ->> 'station_id',
  case when (reading ->> 'air_temp_c') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'air_temp_c')::numeric end,
  case when (reading ->> 'air_humidity_pct') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'air_humidity_pct')::numeric end,
  case when (reading ->> 'soil_temp_c') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'soil_temp_c')::numeric end,
  case when (reading ->> 'soil_moisture_pct') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'soil_moisture_pct')::numeric end,
  case when (reading ->> 'soil_ec_ms_cm') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'soil_ec_ms_cm')::numeric end,
  case when (reading ->> 'soil_ph') ~ '^-?[0-9]+(\.[0-9]+)?$' then (reading ->> 'soil_ph')::numeric end,
  0,
  received_at
from source
where coalesce(
  reading ->> 'air_temp_c', reading ->> 'air_humidity_pct',
  reading ->> 'soil_temp_c', reading ->> 'soil_moisture_pct',
  reading ->> 'soil_ec_ms_cm', reading ->> 'soil_ph'
) is not null
on conflict (message_id) do nothing;

update public.gateway_observations
set station_id = raw_payload #>> '{raw_station_payload,station_id}'
where station_id = 'UNKNOWN_STATION'
  and raw_payload #>> '{raw_station_payload,station_id}' in ('STATION_01', 'STATION_02');
