-- Enable required extension for UUID generation.
create extension if not exists pgcrypto;

alter table public.users enable row level security;
alter table public.stations enable row level security;
alter table public.environmental_data enable row level security;
alter table public.station_health_logs enable row level security;
alter table public.damage_logs enable row level security;
alter table public.crop_thresholds enable row level security;

-- NOTE:
-- Bootstrap development policies.
-- These will be replaced later by 009_production_rls.sql.

drop policy if exists users_self_read on public.users;
create policy users_self_read
on public.users
for select
using (true);

drop policy if exists stations_read_all on public.stations;
create policy stations_read_all
on public.stations
for select
using (true);

drop policy if exists crop_thresholds_read_all on public.crop_thresholds;
create policy crop_thresholds_read_all
on public.crop_thresholds
for select
using (true);

drop policy if exists environmental_data_read_all on public.environmental_data;
create policy environmental_data_read_all
on public.environmental_data
for select
using (true);

drop policy if exists station_health_logs_admin_read on public.station_health_logs;
create policy station_health_logs_admin_read
on public.station_health_logs
for select
using (true);

drop policy if exists damage_logs_insert on public.damage_logs;
create policy damage_logs_insert
on public.damage_logs
for insert
with check (true);

drop policy if exists damage_logs_read_all on public.damage_logs;
create policy damage_logs_read_all
on public.damage_logs
for select
using (true);