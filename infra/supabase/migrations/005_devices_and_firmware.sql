-- Devices table and firmware update registry

create table if not exists public.devices (
  device_id text primary key,
  station_id text references public.stations(id),
  device_secret text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.firmware_updates (
  id bigserial primary key,
  device_id text references public.devices(device_id),
  target_version text not null,
  binary_url text not null,
  sha256 text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  active boolean not null default false
);
