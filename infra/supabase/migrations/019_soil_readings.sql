-- Data model decision for Trạm 2's soil measurements — see
-- docs/ARCHITECTURE_DECISIONS.md §8 for the full reasoning (Option A: add
-- proper typed columns via a dedicated table, not a generic EAV/registry
-- model — HORIZON has exactly two station kinds today, not an open-ended
-- sensor catalog, so a typed table per kind is simpler and more
-- maintainable than a generic abstraction would be at this scale).
--
-- Mirrors environmental_readings' proven shape (message_id idempotency
-- key, station_id FK, timestamp, created_at) rather than widening
-- environmental_readings itself, which would force salinity/water_level
-- to become nullable for no reason and mix two unrelated row shapes in
-- one table — exactly the modeling smell migrations 010/011 already
-- worked to eliminate.
--
-- Each measurement is independently nullable: Trạm 2 has six independent
-- sensors (temp/humidity/soil-temp/moisture/EC/pH), each with its own
-- fault status. An all-or-nothing model (reject the whole reading if any
-- one sensor faults, as environmental_readings does for Trạm 1's two
-- sensors) would mean one broken pH probe blocks otherwise-valid soil EC
-- data a farmer actually needs. Never fabricate a value for a field that
-- didn't report — null, not a substituted number.

create table if not exists public.soil_readings (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  station_id text not null references public.stations(id),
  air_temp_c numeric(5,1),
  air_humidity_pct numeric(5,1),
  soil_temp_c numeric(5,1),
  soil_moisture_pct numeric(5,1),
  soil_ec_ms_cm numeric(6,2),
  soil_ph numeric(4,1),
  fault_flags integer not null default 0,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_soil_readings_station_time
  on public.soil_readings (station_id, timestamp desc);

alter table public.soil_readings enable row level security;

-- Same authorization shape as environmental_readings: admin-scoped
-- authenticated access (has_station_access(), from migration 008/009) plus
-- public anon read (this is public transparency data, same as water
-- readings — see docs/ARCHITECTURE_DECISIONS.md §2 for why public reads
-- are anon-key + RLS rather than service-role).
drop policy if exists soil_readings_select_scoped on public.soil_readings;
create policy soil_readings_select_scoped
  on public.soil_readings
  for select
  to authenticated
  using (public.has_station_access(station_id));

drop policy if exists soil_readings_public_select on public.soil_readings;
create policy soil_readings_public_select
  on public.soil_readings
  for select
  to anon
  using (true);

grant select on public.soil_readings to anon;
