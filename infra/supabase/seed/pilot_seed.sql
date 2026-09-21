insert into public.stations (id, name, lat, lng, status)
values
  ('STATION_01', 'Con Ho North', 10.2450000, 105.8200000, 'active'),
  ('STATION_02', 'Con Ho South', 10.2385000, 105.8260000, 'active'),
  ('STATION_03', 'Canal Gate West', 10.2421000, 105.8320000, 'active')
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
-- device_secret is the HMAC key that authenticates telemetry (see
-- services/edge-ingestion/src/canonical.ts signPayload). A deployment still
-- holding these values will accept forged readings from anyone who has read
-- the repo. Every production device MUST be rotated to a unique,
-- non-guessable secret — `npm run verify` fails if any remain.
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
