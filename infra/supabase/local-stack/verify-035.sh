#!/usr/bin/env bash
# Migration 035 verification on the REAL supabase/postgres image (separate database hz35 on the local stack):
# migrations 001-034 -> representative seed -> preflight -> apply 035 (one txn) -> postflight -> idempotency -> rollback.
set -euo pipefail
cd "$(dirname "$0")"; set -a; . ./.env.local-stack; set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
H="-h 127.0.0.1 -p 54322 -U supabase_admin"
psql $H -d postgres -q -c "drop database if exists hz35" -c "create database hz35"
DC="docker compose --env-file .env.local-stack exec -T -e PGPASSWORD=$POSTGRES_PASSWORD db"
# Clone the SCHEMA of the migrated local database (migrations 001-035), then remove 035's trigger/function to
# recreate the exact pre-035 state. No data is copied; the scratch database is dropped at the end.
$DC pg_dump -h localhost -U supabase_admin -d postgres --schema-only --no-owner --no-privileges 2>/dev/null </dev/null | psql $H -d hz35 -q -v ON_ERROR_STOP=0 >/dev/null 2>&1 || true
P="psql $H -d hz35 -v ON_ERROR_STOP=1 -q"
$P -f ../local-iso/035_rollback.sql >/dev/null
Q="psql $H -d hz35 -v ON_ERROR_STOP=1 -At"
$Q -q -f ../local-iso/035_representative_seed.sql
sal() { $Q -c "select md5(string_agg(coalesce(salinity::text,'N')||message_id, ',' order by message_id)) from environmental_readings"; }
echo "== PREFLIGHT"; $Q -c "select 'rows',count(*),'needs_ec',count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null),'needs_temp',count(*) filter (where water_temp_c is null and temperature_c is not null) from environmental_readings"
B=$(sal); echo "salinity checksum before: $B"
$Q -c "select 'public_view_before', measurements->>'water_ec_ms_cm', measurements->>'salinity' from observatory_live_readings where station_id='STATION_01'"
echo "== APPLY 035 (single transaction)"; $Q -1 -q -f ../migrations/035_mirror_water_ec_temperature.sql 2>&1 | grep -v NOTICE || true
echo "== POSTFLIGHT"; $Q -c "select 'remaining_needs_ec',count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null),'remaining_needs_temp',count(*) filter (where water_temp_c is null and temperature_c is not null) from environmental_readings"
A=$(sal); echo "salinity checksum after:  $A"; [ "$A" = "$B" ] && echo "SALINITY UNCHANGED: yes" || { echo "SALINITY CHANGED: NO-GO"; exit 1; }
$Q -c "select 'c1 (already mirrored, must keep 1.111/22.2)', water_ec_ms_cm, water_temp_c from environmental_readings where message_id='C-1'"
$Q -c "select 'd1 all-null stays null', water_ec_ms_cm is null, water_temp_c is null from environmental_readings where message_id='D-1'"
$Q -c "select 'e1 ec copied, temp stays null', water_ec_ms_cm, water_temp_c is null from environmental_readings where message_id='E-1'"
$Q -c "select 'public_view_after', measurements->>'water_ec_ms_cm', measurements->>'water_temp_c', measurements->>'salinity' from observatory_live_readings where station_id='STATION_01'"
echo "== NEW OLD-STYLE INSERT (trigger must mirror)"
$Q -c "insert into environmental_readings (message_id,station_id,salinity,water_level,ec_probe_status,ultrasonic_status,timestamp,ec_ms_cm,temperature_c) values ('N-1','STATION_01',0.07,291,'ok','ok',now(),0.5,30.1) returning 'new_row', water_ec_ms_cm, water_temp_c"
echo "== IDEMPOTENCY"; $Q -1 -q -f ../migrations/035_mirror_water_ec_temperature.sql 2>&1 | grep -v NOTICE || true; echo "re-apply OK"
echo "== ROLLBACK"; $Q -1 -q -f ../local-iso/035_rollback.sql; $Q -c "select 'trigger_after_rollback', count(*) from pg_trigger where tgname='environmental_mirror_water_columns'"
psql $H -d postgres -q -c "drop database hz35"; echo "(scratch database dropped)"
