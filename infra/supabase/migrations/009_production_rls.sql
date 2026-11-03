-- ECO-009: Replace bootstrap RLS with production role-based policies

-- ---------------------------------------------------------------------------
-- Drop bootstrap policies (003, 007)
-- ---------------------------------------------------------------------------
drop policy if exists users_self_read on public.users;
drop policy if exists stations_read_all on public.stations;
drop policy if exists crop_thresholds_read_all on public.crop_thresholds;
drop policy if exists environmental_data_read_all on public.environmental_data;
drop policy if exists station_health_logs_admin_read on public.station_health_logs;
drop policy if exists damage_logs_insert on public.damage_logs;
drop policy if exists damage_logs_read_all on public.damage_logs;

drop policy if exists environmental_readings_read_all on public.environmental_readings;
drop policy if exists environmental_events_read_all on public.environmental_events;
drop policy if exists ingestion_audit_logs_admin_read on public.ingestion_audit_logs;
drop policy if exists devices_admin_read on public.devices;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select_own_or_admin on public.users
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy users_insert_self on public.users
  for insert
  to authenticated
  with check (id = auth.uid() and role = 'farmer');

create policy users_update_self_or_admin on public.users
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- station_assignments
-- ---------------------------------------------------------------------------
create policy station_assignments_select_own_or_admin on public.station_assignments
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy station_assignments_admin_write on public.station_assignments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- stations
-- ---------------------------------------------------------------------------
create policy stations_select_scoped on public.stations
  for select
  to authenticated
  using (public.has_station_access(id));

-- ---------------------------------------------------------------------------
-- crop_thresholds (read-only for authenticated farmers/admins)
-- ---------------------------------------------------------------------------
create policy crop_thresholds_select_authenticated on public.crop_thresholds
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- environmental_readings
-- ---------------------------------------------------------------------------
create policy environmental_readings_select_scoped on public.environmental_readings
  for select
  to authenticated
  using (public.has_station_access(station_id));

-- ---------------------------------------------------------------------------
-- environmental_events
-- ---------------------------------------------------------------------------
create policy environmental_events_select_scoped on public.environmental_events
  for select
  to authenticated
  using (public.has_station_access(station_id));

-- ---------------------------------------------------------------------------
-- environmental_data (legacy table)
-- ---------------------------------------------------------------------------
create policy environmental_data_select_scoped on public.environmental_data
  for select
  to authenticated
  using (public.has_station_access(station_id));

-- ---------------------------------------------------------------------------
-- station_health_logs
-- ---------------------------------------------------------------------------
create policy station_health_logs_select_scoped on public.station_health_logs
  for select
  to authenticated
  using (public.has_station_access(station_id));

-- ---------------------------------------------------------------------------
-- damage_logs
-- ---------------------------------------------------------------------------
create policy damage_logs_select_own_or_admin on public.damage_logs
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy damage_logs_insert_own on public.damage_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin-only observability tables
-- ---------------------------------------------------------------------------
create policy ingestion_audit_logs_admin_select on public.ingestion_audit_logs
  for select
  to authenticated
  using (public.is_admin());

create policy devices_admin_select on public.devices
  for select
  to authenticated
  using (public.is_admin());

alter table public.firmware_updates enable row level security;

create policy firmware_updates_admin_select on public.firmware_updates
  for select
  to authenticated
  using (public.is_admin());
