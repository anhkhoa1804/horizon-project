-- Telemetry observability, device registry hardening, and alert/event split

alter table public.devices
  add column if not exists device_secret_hash text,
  add column if not exists firmware_version text,
  add column if not exists status text not null default 'active',
  add column if not exists last_seen_at timestamptz;

alter table public.devices
  drop constraint if exists devices_status_check;

alter table public.devices
  add constraint devices_status_check check (status in ('active', 'inactive', 'maintenance'));

update public.devices
set device_secret_hash = coalesce(device_secret_hash, md5(device_secret))
where device_secret_hash is null;

create table if not exists public.environmental_readings (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  station_id text not null references public.stations(id),
  salinity numeric(8,3) not null,
  water_level numeric(8,2) not null,
  fault_flags integer not null default 0,
  ec_probe_status text not null check (ec_probe_status in ('ok', 'warn', 'fault')),
  ultrasonic_status text not null check (ultrasonic_status in ('ok', 'warn', 'fault')),
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_environmental_readings_station_time
  on public.environmental_readings (station_id, timestamp desc);

create table if not exists public.environmental_events (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations(id),
  event_type text not null check (event_type in ('HIGH_SALINITY', 'SENSOR_FAULT', 'LOW_BATTERY', 'OFFLINE')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message_id text,
  details jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_environmental_events_station_time
  on public.environmental_events (station_id, timestamp desc);

create table if not exists public.ingestion_audit_logs (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  device_id text not null references public.devices(device_id),
  status text not null check (status in (
    'accepted',
    'duplicate',
    'invalid_signature',
    'expired_timestamp',
    'sensor_fault',
    'device_not_registered',
    'value_out_of_range',
    'missing_field',
    'contract_mismatch',
    'internal_error'
  )),
  reason text not null,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_audit_logs_device_time
  on public.ingestion_audit_logs (device_id, timestamp desc);

create index if not exists idx_ingestion_audit_logs_message_id
  on public.ingestion_audit_logs (message_id);
