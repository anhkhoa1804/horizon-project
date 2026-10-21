#!/usr/bin/env bash
# Isolated verification of migration 035: seed -> preflight -> apply -> postflight -> idempotency -> rollback.
set -euo pipefail
cd "$(dirname "$0")"
./run_migrations.sh hz35 34 >/dev/null 2>&1
Q="psql -h /tmp/pgiso -p 54329 -U postgres -d hz35 -v ON_ERROR_STOP=1 -At"
$Q -q -f 035_representative_seed.sql
echo "== PREFLIGHT"
$Q -c "select 'rows', count(*), 'needs_ec', count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null), 'needs_temp', count(*) filter (where water_temp_c is null and temperature_c is not null) from environmental_readings"
$Q -c "select 'checksum_salinity', md5(string_agg(coalesce(salinity::text,'N')||message_id, ',' order by message_id)) from environmental_readings" > /tmp/pgiso/sal_before.txt; cat /tmp/pgiso/sal_before.txt
$Q -c "select 'c1_before', water_ec_ms_cm, water_temp_c from environmental_readings where message_id='C-1'"
$Q -c "select 'public_view_before', measurements->>'water_ec_ms_cm', measurements->>'salinity' from observatory_live_readings where station_id='STATION_01'"
echo "== APPLY 035 (single transaction)"
$Q -1 -q -f ../migrations/035_mirror_water_ec_temperature.sql
echo "== POSTFLIGHT"
$Q -c "select 'remaining_needs_ec', count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null), 'remaining_needs_temp', count(*) filter (where water_temp_c is null and temperature_c is not null) from environmental_readings"
$Q -c "select 'checksum_salinity', md5(string_agg(coalesce(salinity::text,'N')||message_id, ',' order by message_id)) from environmental_readings" > /tmp/pgiso/sal_after.txt; cat /tmp/pgiso/sal_after.txt
cmp /tmp/pgiso/sal_before.txt /tmp/pgiso/sal_after.txt && echo "SALINITY UNCHANGED: yes"
$Q -c "select 'c1_after_must_be_1.111_22.2', water_ec_ms_cm, water_temp_c from environmental_readings where message_id='C-1'"
$Q -c "select 'd1_must_be_null', water_ec_ms_cm is null, water_temp_c is null from environmental_readings where message_id='D-1'"
$Q -c "select 'e1_ec_copied_temp_null', water_ec_ms_cm, water_temp_c is null from environmental_readings where message_id='E-1'"
$Q -c "select 'public_view_after', measurements->>'water_ec_ms_cm', measurements->>'water_temp_c', measurements->>'salinity' from observatory_live_readings where station_id='STATION_01'"
echo "== NEW OLD-STYLE INSERT (trigger must mirror)"
$Q -c "insert into environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp, ec_ms_cm, temperature_c) values ('N-1','STATION_01',0.07,291,'ok','ok',now(),0.5,30.1) returning 'new_row', water_ec_ms_cm, water_temp_c"
$Q -c "select 'public_view_latest', measurements->>'water_ec_ms_cm', measurements->>'water_temp_c' from observatory_live_readings where station_id='STATION_01'"
echo "== IDEMPOTENCY (re-apply)"
$Q -1 -q -f ../migrations/035_mirror_water_ec_temperature.sql && echo "re-apply OK"
$Q -c "select 'rows_unchanged_count', count(*) from environmental_readings"
echo "== ROLLBACK (trigger+function only; data copies are retained, they equal the source values)"
$Q -1 -q -f 035_rollback.sql && echo "rollback OK"
$Q -c "select 'trigger_exists_after_rollback', count(*) from pg_trigger where tgname='environmental_mirror_water_columns'"
