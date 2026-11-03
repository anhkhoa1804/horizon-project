alter table public.environmental_readings enable row level security;
alter table public.environmental_events enable row level security;
alter table public.ingestion_audit_logs enable row level security;
alter table public.devices enable row level security;

-- Bootstrap development policies (replaced by 009_production_rls.sql).

drop policy if exists environmental_readings_read_all on public.environmental_readings;
create policy environmental_readings_read_all
  on public.environmental_readings
  for select
  using (true);

drop policy if exists environmental_events_read_all on public.environmental_events;
create policy environmental_events_read_all
  on public.environmental_events
  for select
  using (true);

drop policy if exists ingestion_audit_logs_admin_read on public.ingestion_audit_logs;
create policy ingestion_audit_logs_admin_read
  on public.ingestion_audit_logs
  for select
  using (true);

drop policy if exists devices_admin_read on public.devices;
create policy devices_admin_read
  on public.devices
  for select
  using (true);
