-- Retention policy for keeping Supabase costs predictable.
-- Raw data can stay for a long time while the pilot is small, but this gives
-- operators one function to schedule later when volume grows.

create table if not exists public.environmental_readings_hourly (
  station_id text not null references public.stations(id),
  hour_bucket timestamptz not null,
  salinity_avg numeric(8,3) not null,
  salinity_max numeric(8,3) not null,
  water_level_avg numeric(8,2) not null,
  water_level_max numeric(8,2) not null,
  sample_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (station_id, hour_bucket)
);

create or replace function public.rollup_environmental_readings_hourly(
  p_from timestamptz default now() - interval '2 days',
  p_to timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.environmental_readings_hourly (
    station_id,
    hour_bucket,
    salinity_avg,
    salinity_max,
    water_level_avg,
    water_level_max,
    sample_count,
    updated_at
  )
  select
    station_id,
    date_trunc('hour', timestamp) as hour_bucket,
    avg(salinity)::numeric(8,3),
    max(salinity)::numeric(8,3),
    avg(water_level)::numeric(8,2),
    max(water_level)::numeric(8,2),
    count(*)::integer,
    now()
  from public.environmental_readings
  where timestamp >= p_from
    and timestamp < p_to
  group by station_id, date_trunc('hour', timestamp)
  on conflict (station_id, hour_bucket) do update
    set salinity_avg = excluded.salinity_avg,
        salinity_max = excluded.salinity_max,
        water_level_avg = excluded.water_level_avg,
        water_level_max = excluded.water_level_max,
        sample_count = excluded.sample_count,
        updated_at = now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.cleanup_horizon_data(
  p_raw_days integer default 365,
  p_gateway_days integer default 365,
  p_health_days integer default 365,
  p_event_days integer default 365,
  p_audit_days integer default 90,
  p_hourly_days integer default 1095
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_readings integer := 0;
  deleted_gateway integer := 0;
  deleted_health integer := 0;
  deleted_events integer := 0;
  deleted_audit integer := 0;
  deleted_hourly integer := 0;
begin
  perform public.rollup_environmental_readings_hourly(now() - interval '2 days', now());

  delete from public.ingestion_audit_logs
  where timestamp < now() - make_interval(days => p_audit_days);
  get diagnostics deleted_audit = row_count;

  delete from public.environmental_events
  where timestamp < now() - make_interval(days => p_event_days);
  get diagnostics deleted_events = row_count;

  delete from public.station_health_logs
  where timestamp < now() - make_interval(days => p_health_days);
  get diagnostics deleted_health = row_count;

  delete from public.gateway_observations
  where received_at < now() - make_interval(days => p_gateway_days);
  get diagnostics deleted_gateway = row_count;

  delete from public.environmental_readings
  where timestamp < now() - make_interval(days => p_raw_days);
  get diagnostics deleted_readings = row_count;

  delete from public.environmental_readings_hourly
  where hour_bucket < now() - make_interval(days => p_hourly_days);
  get diagnostics deleted_hourly = row_count;

  return jsonb_build_object(
    'deleted_readings', deleted_readings,
    'deleted_gateway_observations', deleted_gateway,
    'deleted_health_logs', deleted_health,
    'deleted_events', deleted_events,
    'deleted_audit_logs', deleted_audit,
    'deleted_hourly_rollups', deleted_hourly
  );
end;
$$;

comment on function public.cleanup_horizon_data(integer, integer, integer, integer, integer, integer)
is 'Schedule later with pg_cron or an external job. Suggested pilot default: keep raw readings/gateway/health/events for 365 days, audit logs for 90 days, hourly rollups for 1095 days.';
