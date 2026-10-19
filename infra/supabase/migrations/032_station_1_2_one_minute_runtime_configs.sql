-- Station 1 and Station 2 now report one aggregate every minute.
-- Keep runtime config rows aligned so the gateway does not reapply a 5-minute
-- sleep interval from existing database state.

insert into public.device_runtime_configs (
  station_id,
  sample_interval_seconds,
  sleep_interval_seconds,
  mode
)
select
  stations.id,
  60,
  60,
  'normal'
from public.stations
where stations.id in ('STATION_01', 'STATION_02')
on conflict (station_id) do update
set
  sample_interval_seconds = excluded.sample_interval_seconds,
  sleep_interval_seconds = excluded.sleep_interval_seconds,
  updated_at = now();
