-- Raw observations received from field gateways.
-- The web application can calculate dashboard values from raw station payloads
-- without forcing every sensor into the older environmental_readings shape.

create table if not exists public.gateway_observations (
  id uuid primary key default gen_random_uuid(),
  gateway_id text not null,
  station_id text not null,
  sequence bigint,
  transport text,
  raw_payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_gateway_observations_station_time
  on public.gateway_observations (station_id, received_at desc);

alter table public.gateway_observations enable row level security;

drop policy if exists gateway_observations_admin_select on public.gateway_observations;
create policy gateway_observations_admin_select
  on public.gateway_observations
  for select
  using (public.is_admin());

drop policy if exists gateway_observations_admin_insert on public.gateway_observations;
create policy gateway_observations_admin_insert
  on public.gateway_observations
  for insert
  with check (public.is_admin());
