-- Runtime configuration that operators can adjust from the admin console.
-- Gateways poll these rows and forward updated sleep/sample intervals to field nodes.

create table if not exists public.device_runtime_configs (
  station_id text primary key references public.stations(id),
  sample_interval_seconds integer not null default 300 check (sample_interval_seconds between 5 and 86400),
  sleep_interval_seconds integer not null default 300 check (sleep_interval_seconds between 0 and 86400),
  mode text not null default 'normal' check (mode in ('normal', 'rain_saver', 'maintenance')),
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_device_runtime_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_device_runtime_config_updated_at on public.device_runtime_configs;
create trigger touch_device_runtime_config_updated_at
before update on public.device_runtime_configs
for each row
execute function public.touch_device_runtime_config_updated_at();

alter table public.device_runtime_configs enable row level security;

drop policy if exists device_runtime_configs_admin_select on public.device_runtime_configs;
create policy device_runtime_configs_admin_select
  on public.device_runtime_configs
  for select
  using (public.is_admin());

drop policy if exists device_runtime_configs_admin_write on public.device_runtime_configs;
create policy device_runtime_configs_admin_write
  on public.device_runtime_configs
  for all
  using (public.is_admin())
  with check (public.is_admin());
