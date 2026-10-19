insert into public.stations (id, name, lat, lng, status)
values
  ('STATION_01', 'Con Ho Water', 10.073972, 106.250417, 'active'),
  ('STATION_02', 'Con Ho Soil', 10.072444, 106.253056, 'active'),
  ('STATION_03', 'Con Ho Gateway', 10.071000, 106.254167, 'active')
on conflict (id) do update
set name = excluded.name,
    lat = excluded.lat,
    lng = excluded.lng,
    status = excluded.status;

-- DEVELOPMENT PLACEHOLDER SECRETS. These values are committed to the
-- repository and are therefore PUBLIC. They match the fixtures used by
-- services/edge-ingestion/tests and scripts/simulator.ts so a local checkout
-- can run the ingestion path without configuration.
--
-- device_secret remains a legacy schema field for historical rows and local
-- fixtures. The active pilot ingest path authenticates only GATEWAY_01 with
-- the separately provisioned GATEWAY_INGEST_TOKEN; these placeholders must
-- never be treated as a production gateway credential.
--
-- NOTE THE MISSING `device_secret` IN THE UPDATE CLAUSE BELOW. This seed is
-- re-run by apply-migrations.mjs on EVERY `npm run db:migrate`, and it
-- previously carried `device_secret = excluded.device_secret`, which silently
-- reset every rotated production secret back to the public placeholder on the
-- next deploy. New rows still get a placeholder (that is what makes a fresh
-- clone work); existing rows keep whatever the operator set.
insert into public.devices (device_id, station_id, device_secret, status, kind)
values
  ('GATEWAY_01', null, 'gateway-secret-01', 'active', 'gateway'),
  ('STATION_01', 'STATION_01', 'station-secret-01', 'active', 'station'),
  ('STATION_02', 'STATION_02', 'station-secret-02', 'active', 'station'),
  ('STATION_03', 'STATION_03', 'station-secret-03', 'active', 'station')
on conflict (device_id) do update
set station_id = excluded.station_id,
    status = excluded.status,
    kind = excluded.kind;
