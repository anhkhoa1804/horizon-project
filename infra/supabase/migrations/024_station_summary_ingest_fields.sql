-- Store every field the LoRa gateway reports in station_summary payloads while
-- keeping the typed water/soil read models as the dashboard source.

alter table public.environmental_readings
  add column if not exists sequence bigint,
  add column if not exists summary_minutes integer,
  add column if not exists sensor_height_cm numeric(8,2),
  add column if not exists distance_cm numeric(8,2),
  add column if not exists ec_ms_cm numeric(8,3),
  add column if not exists ec_us_cm numeric(10,2),
  add column if not exists temperature_c numeric(5,1),
  add column if not exists tds_ppm numeric(10,2),
  add column if not exists salinity_ppm numeric(10,2),
  add column if not exists raw_station_payload jsonb;

comment on column public.environmental_readings.raw_station_payload is
  'Original station_summary JSON received from the gateway. Keeps all raw fields for audit/debug while typed columns drive normal reads.';

alter table public.soil_readings
  add column if not exists sequence bigint,
  add column if not exists summary_minutes integer,
  add column if not exists crop text,
  add column if not exists soil_ec_us_cm numeric(10,2),
  add column if not exists soil_salinity numeric(10,2),
  add column if not exists soil_tds numeric(10,2),
  add column if not exists raw_station_payload jsonb;

comment on column public.soil_readings.raw_station_payload is
  'Original station_summary JSON received from the gateway. Keeps all raw fields for audit/debug while typed columns drive normal reads.';

alter table public.station_health_logs
  add column if not exists battery_percent numeric(5,2);
