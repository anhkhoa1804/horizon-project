-- Store instants with timestamptz, but make database-facing reads easier for
-- this deployment's local operating timezone.
--
-- Important: timestamptz does not store a timezone label. PostgreSQL stores the
-- absolute moment and renders it using the active session timezone. Keep the
-- canonical timestamp columns as timestamptz so ordering, retention, and API
-- filters remain correct. Use the *_vn views below when inspecting rows by
-- Vietnam wall-clock time in SQL/Supabase.

alter database postgres set timezone = 'Asia/Ho_Chi_Minh';

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role', 'postgres']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('alter role %I set timezone = %L', role_name, 'Asia/Ho_Chi_Minh');
    end if;
  end loop;
end $$;

create or replace view public.environmental_readings_vn
with (security_invoker = true)
as
select
  r.*,
  timezone('Asia/Ho_Chi_Minh', r.timestamp) as timestamp_vn,
  timezone('Asia/Ho_Chi_Minh', r.created_at) as created_at_vn
from public.environmental_readings r;

comment on view public.environmental_readings_vn is
  'Environmental readings with timestamp_vn/created_at_vn rendered as Asia/Ho_Chi_Minh wall-clock time.';

create or replace view public.soil_readings_vn
with (security_invoker = true)
as
select
  r.*,
  timezone('Asia/Ho_Chi_Minh', r.timestamp) as timestamp_vn,
  timezone('Asia/Ho_Chi_Minh', r.created_at) as created_at_vn
from public.soil_readings r;

comment on view public.soil_readings_vn is
  'Soil readings with timestamp_vn/created_at_vn rendered as Asia/Ho_Chi_Minh wall-clock time.';

create or replace view public.station_health_logs_vn
with (security_invoker = true)
as
select
  h.*,
  timezone('Asia/Ho_Chi_Minh', h.timestamp) as timestamp_vn,
  timezone('Asia/Ho_Chi_Minh', h.created_at) as created_at_vn
from public.station_health_logs h;

comment on view public.station_health_logs_vn is
  'Station health logs with timestamp_vn/created_at_vn rendered as Asia/Ho_Chi_Minh wall-clock time.';

create or replace view public.environmental_events_vn
with (security_invoker = true)
as
select
  e.*,
  timezone('Asia/Ho_Chi_Minh', e.timestamp) as timestamp_vn,
  timezone('Asia/Ho_Chi_Minh', e.created_at) as created_at_vn
from public.environmental_events e;

comment on view public.environmental_events_vn is
  'Environmental events with timestamp_vn/created_at_vn rendered as Asia/Ho_Chi_Minh wall-clock time.';

create or replace view public.ingestion_audit_logs_vn
with (security_invoker = true)
as
select
  l.*,
  timezone('Asia/Ho_Chi_Minh', l.timestamp) as timestamp_vn,
  timezone('Asia/Ho_Chi_Minh', l.created_at) as created_at_vn
from public.ingestion_audit_logs l;

comment on view public.ingestion_audit_logs_vn is
  'Ingestion audit logs with timestamp_vn/created_at_vn rendered as Asia/Ho_Chi_Minh wall-clock time.';
