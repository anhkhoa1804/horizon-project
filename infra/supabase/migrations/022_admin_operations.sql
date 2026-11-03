-- ECO-022: Persistence for the admin operator console.
--
-- WHY
-- The admin console could show network health and edit runtime config, but an
-- operator's actual job also produces records: an alert threshold they chose, a
-- sensor they cleaned, a probe they calibrated, and an audit trail of who
-- changed what. None of that had anywhere to live, so the console either
-- omitted the workflow or would have had to fake it.
--
-- These four tables are the minimum needed for those workflows to be real.
-- They deliberately record OPERATOR ACTIONS AND INTENT — not device state.
-- Nothing here should ever be read as confirmation that a field device did
-- anything, because the firmware has no acknowledgement path (see the
-- device-sync note on alert_configs below).
--
-- ACCESS MODEL
-- Every table follows the pattern established by 012/020: RLS on, and no anon
-- or authenticated grants at all. The console reaches them exclusively through
-- the service-role client on the server, behind requireAdmin(). Two locks, not
-- one — a missing grant AND a missing policy.

-- ---------------------------------------------------------------------------
-- Alert configuration
-- ---------------------------------------------------------------------------
--
-- An OPERATIONAL threshold, chosen by the operator for this deployment. It is
-- explicitly NOT a scientific recommendation: docs/SCIENTIFIC_REFERENCES.md
-- remains the authority for what published guidance says, and the two are kept
-- separate on purpose. The UI labels these as configured-by-operator.
create table if not exists public.alert_configs (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations(id) on delete cascade,
  metric text not null,
  -- Direction of the comparison. Salinity alarms above a value; battery below.
  comparison text not null check (comparison in ('above', 'below')),
  warning_threshold numeric,
  critical_threshold numeric,
  unit text,
  enabled boolean not null default true,
  note text,
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per station+metric: two competing thresholds for the same reading
  -- is a configuration bug, not a feature.
  unique (station_id, metric)
);

comment on table public.alert_configs is
  'Stored operator alert intent only. Not evaluated and not device-executable. NOT scientific recommendations - see docs/SCIENTIFIC_REFERENCES.md for published guidance.';

create index if not exists idx_alert_configs_station on public.alert_configs (station_id);

-- ---------------------------------------------------------------------------
-- Maintenance log
-- ---------------------------------------------------------------------------
--
-- A record that a human did something physical to a node. Purely a log: it
-- claims nothing about the device's current state.
create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations(id) on delete cascade,
  -- Constrained to work this project's hardware can actually receive. No
  -- "remote reboot" or "OTA rollback" — those have no implementation.
  kind text not null check (
    kind in (
      'inspection',
      'cleaning',
      'battery_replacement',
      'enclosure_check',
      'sensor_replacement',
      'firmware_update',
      'calibration'
    )
  ),
  performed_at timestamptz not null default now(),
  operator text,
  note text,
  next_due_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.maintenance_logs is
  'Record of physical maintenance performed on a field node. A log of human action only - infers nothing about live device state.';

create index if not exists idx_maintenance_logs_station_time
  on public.maintenance_logs (station_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- Calibration records
-- ---------------------------------------------------------------------------
--
-- DELIBERATELY A RECORD, NOT A COMMAND. There is no path from this table to a
-- device: the firmware exposes no calibration endpoint and sends no
-- acknowledgement. Storing a row here means "an operator calibrated this
-- sensor in the field and wrote down what they did", which is genuinely useful
-- and completely honest. It must never be presented as "the device has been
-- calibrated by the system".
--
-- `status` therefore has no 'applied_to_device' value. Adding one would
-- require a real acknowledgement mechanism in firmware first.
create table if not exists public.calibration_records (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations(id) on delete cascade,
  sensor text not null,
  reference_value numeric,
  measured_value numeric,
  unit text,
  status text not null default 'recorded' check (status in ('recorded', 'superseded')),
  performed_at timestamptz not null default now(),
  operator text,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.calibration_records is
  'Field calibration events written down by an operator. There is NO device acknowledgement path, so a row here never means the device applied anything.';

create index if not exists idx_calibration_records_station_time
  on public.calibration_records (station_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- Audit / event history
-- ---------------------------------------------------------------------------
--
-- Who changed what, in the console. Metadata is jsonb so an action can carry
-- its own shape, with one hard rule enforced in application code: NEVER write
-- a secret into it. No device secrets, no GATEWAY_INGEST_TOKEN, no admin
-- password or session secret.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor text,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Operator action trail for the admin console. Never store secrets in metadata.';

create index if not exists idx_audit_events_time on public.audit_events (occurred_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance for alert_configs
-- ---------------------------------------------------------------------------
create or replace function public.touch_alert_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_alert_config_updated_at on public.alert_configs;
create trigger touch_alert_config_updated_at
before update on public.alert_configs
for each row execute function public.touch_alert_config_updated_at();

-- ---------------------------------------------------------------------------
-- Access control — same posture as 012/020.
-- ---------------------------------------------------------------------------
alter table public.alert_configs enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.calibration_records enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.alert_configs from anon;
revoke all on public.alert_configs from authenticated;
revoke all on public.maintenance_logs from anon;
revoke all on public.maintenance_logs from authenticated;
revoke all on public.calibration_records from anon;
revoke all on public.calibration_records from authenticated;
revoke all on public.audit_events from anon;
revoke all on public.audit_events from authenticated;

grant select, insert, update, delete on public.alert_configs to service_role;
grant select, insert, update, delete on public.maintenance_logs to service_role;
grant select, insert, update, delete on public.calibration_records to service_role;
grant select, insert on public.audit_events to service_role;
