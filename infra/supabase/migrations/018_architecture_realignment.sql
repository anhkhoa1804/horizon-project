-- HORIZON architecture realignment (see docs/ARCHITECTURE_DECISIONS.md).
--
-- Three independent changes, bundled because they share one motivating
-- decision: stop routing every read through the service-role client and
-- make the gateway-relay ingestion topology representable in the schema.

-- ---------------------------------------------------------------------------
-- 1. devices.kind — distinguish relay-capable gateways (hold a signing
--    secret used to authenticate requests) from stations (attributed via
--    payload.device_id, may or may not hold their own secret — see
--    services/edge-ingestion/src/ingest.ts for the resulting auth model).
-- ---------------------------------------------------------------------------
alter table public.devices
  add column if not exists kind text not null default 'station';

alter table public.devices
  drop constraint if exists devices_kind_check;

alter table public.devices
  add constraint devices_kind_check check (kind in ('station', 'gateway'));

comment on column public.devices.kind is
  'gateway: authenticates ingestion requests with its own device_secret and may relay readings attributed to other devices. station: a monitoring point; may hold its own secret (direct-connect / dev-simulator) or rely entirely on a relaying gateway''s authentication.';

-- ---------------------------------------------------------------------------
-- 2. station_health_logs: battery/signal are not always measurable (a
--    LoRa-only station has no cellular modem; a relaying gateway can't
--    honestly measure a remote station's battery). Nullable, not fabricated.
-- ---------------------------------------------------------------------------
alter table public.station_health_logs
  alter column battery_voltage drop not null;

alter table public.station_health_logs
  alter column signal_strength_dbm drop not null;

-- ---------------------------------------------------------------------------
-- 3. Public anon reads: migration 012 correctly revoked blanket anon SELECT
--    grants as defense-in-depth, but nothing since has restored scoped
--    access — so every "public" page has been reading through the
--    service-role client instead, bypassing RLS entirely for reads that
--    only ever needed public, non-sensitive data. Restore anon SELECT for
--    exactly the tables the public dashboard needs; everything security-
--    or PII-sensitive (devices, ingestion_audit_logs, users,
--    station_assignments, damage_logs, firmware_updates,
--    admin_allowed_emails, gateway_observations) stays blocked.
-- ---------------------------------------------------------------------------
grant select on public.stations to anon;
grant select on public.environmental_readings to anon;
grant select on public.environmental_events to anon;
grant select on public.station_health_logs to anon;
grant select on public.crop_thresholds to anon;

drop policy if exists stations_public_select on public.stations;
create policy stations_public_select
  on public.stations
  for select
  to anon
  using (true);

drop policy if exists environmental_readings_public_select on public.environmental_readings;
create policy environmental_readings_public_select
  on public.environmental_readings
  for select
  to anon
  using (true);

drop policy if exists environmental_events_public_select on public.environmental_events;
create policy environmental_events_public_select
  on public.environmental_events
  for select
  to anon
  using (true);

drop policy if exists station_health_logs_public_select on public.station_health_logs;
create policy station_health_logs_public_select
  on public.station_health_logs
  for select
  to anon
  using (true);

drop policy if exists crop_thresholds_public_select on public.crop_thresholds;
create policy crop_thresholds_public_select
  on public.crop_thresholds
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 4. gateway_observations is superseded by the gateway-relay path through
--    the standard ingestion contract (edge-ingest). Left in place —
--    dropping captured data is a separate, deliberate decision — but no
--    code path writes to it going forward. See docs/ARCHITECTURE_DECISIONS.md.
-- ---------------------------------------------------------------------------
comment on table public.gateway_observations is
  'Legacy/deprecated: written by the removed app/api/public/gateway route. Superseded by the gateway-relay path through the standard signed ingestion contract (environmental_readings). Kept for historical reference only — not written by current code.';
