-- Retention and rollup strategy bootstrap.

create table if not exists public.environmental_data_hourly (
  station_id text not null references public.stations(id),
  hour_bucket timestamptz not null,
  salinity_avg numeric(8,3) not null,
  salinity_max numeric(8,3) not null,
  water_level_avg numeric(8,2) not null,
  water_level_max numeric(8,2) not null,
  sample_count integer not null,
  primary key (station_id, hour_bucket)
);

-- Run this as scheduled job in production (pg_cron or external scheduler).
-- Keep raw data for 2 years.
-- delete from public.environmental_data where timestamp < now() - interval '2 years';

-- Example upsert for hourly aggregate.
-- insert into public.environmental_data_hourly (...)
-- select ... group by station_id, date_trunc('hour', timestamp)
-- on conflict (station_id, hour_bucket) do update ...;
