-- HORIZON platform evolution: preserve Station 01's raw EC/temperature,
-- register the three explicit application profiles, and record surveyed
-- water-level geometry separately from environmental thresholds.

alter table public.environmental_readings
  add column if not exists water_ec_ms_cm numeric(8,3),
  add column if not exists water_temp_c numeric(5,1);

comment on column public.environmental_readings.water_ec_ms_cm is
  'Station 01 water conductivity in mS/cm, stored directly from the payload; never derived from salinity.';
comment on column public.environmental_readings.water_temp_c is
  'Station 01 water temperature in degrees Celsius.';

create table if not exists public.application_profiles (
  key text primary key check (key in ('ORCHARD', 'RICE_SHRIMP', 'AWD_MRV')),
  title text not null,
  description text not null,
  available_metrics text[] not null default '{}',
  needed_metrics text[] not null default '{}',
  available_thresholds text[] not null default '{}',
  unvalidated_thresholds text[] not null default '{}',
  maturity text not null check (maturity in ('PILOT', 'BUILDING_EVIDENCE', 'FUTURE')),
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

insert into public.application_profiles
  (key, title, description, available_metrics, needed_metrics, available_thresholds, unvalidated_thresholds, maturity)
values
  ('ORCHARD', 'Vườn cây giá trị cao',
   'Đất + nước + thời tiết để tiến tới hỗ trợ quyết định tưới.',
   array['soil_moisture','soil_ec_bulk','soil_ph','soil_temp','water_ec','water_level'],
   array['field_capacity','permanent_wilting_point','ET0','Kc','crop_stage','irrigation_model'],
   array[]::text[], array['soil_moisture_trigger'], 'BUILDING_EVIDENCE'),
  ('RICE_SHRIMP', 'Lúa – Tôm',
   'Nước + đất + mùa để theo dõi chuyển dịch mặn/ngọt.',
   array['water_salinity','water_level','water_ec','soil_ec_bulk','soil_moisture'],
   array['season_model','farm_zones','source_comparison'],
   array[]::text[], array['seasonal_salinity_bands'], 'FUTURE'),
  ('AWD_MRV', 'Lúa AWD + MRV',
   'Mực nước theo thời gian để làm thực hành quản lý nước quan sát được và truy xuất được.',
   array['water_level','timestamped_history','auditable_ingestion'],
   array['field_tube_geometry','AWD_methodology','verification_protocol'],
   array[]::text[], array['AWD_wet_dry_bands'], 'FUTURE')
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  available_metrics = excluded.available_metrics,
  needed_metrics = excluded.needed_metrics,
  available_thresholds = excluded.available_thresholds,
  unvalidated_thresholds = excluded.unvalidated_thresholds,
  maturity = excluded.maturity,
  updated_at = now();

create table if not exists public.water_level_contexts (
  station_id text primary key references public.stations(id) on delete cascade,
  sensor_datum_cm numeric,
  shore_bank_elevation_cm numeric,
  critical_infrastructure_elevation_cm numeric,
  survey_note text,
  validation_status text not null default 'PILOT'
    check (validation_status in ('PILOT', 'OPERATIONAL', 'SITE_VALIDATED')),
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

comment on table public.water_level_contexts is
  'Surveyed installation geometry. A flood threshold may be derived from this context; no fixed 80 cm rule is seeded.';

alter table public.application_profiles enable row level security;
alter table public.water_level_contexts enable row level security;
revoke all on public.application_profiles from anon, authenticated;
revoke all on public.water_level_contexts from anon, authenticated;
grant select, insert, update, delete on public.application_profiles to service_role;
grant select, insert, update, delete on public.water_level_contexts to service_role;
