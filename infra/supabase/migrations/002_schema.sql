create table if not exists public.crop_thresholds (
  id bigserial primary key,
  crop_name text not null unique,
  salinity_warning_level numeric(5,2) not null,
  salinity_critical_level numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  role text not null check (role in ('farmer', 'admin')),
  primary_crop_id bigint references public.crop_thresholds(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stations (
  id text primary key,
  name text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  status text not null check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz not null default now()
);

create table if not exists public.environmental_data (
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

create index if not exists idx_environmental_data_station_time
  on public.environmental_data (station_id, timestamp desc);

create table if not exists public.station_health_logs (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations(id),
  battery_voltage numeric(6,3) not null,
  signal_strength_dbm integer not null,
  firmware_version text not null,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_station_health_logs_station_time
  on public.station_health_logs (station_id, timestamp desc);

create table if not exists public.damage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  image_url text,
  description text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_damage_logs_timestamp on public.damage_logs (timestamp desc);
