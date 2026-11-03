-- READ-ONLY production queries for the open data-integrity items.
-- Run in the Supabase SQL editor (or psql) for the production project.
-- Every statement is a SELECT. Nothing here writes, locks for long, or changes configuration.
-- Safe habit: wrap the session in a read-only transaction first:
--   begin read only;  ... run the queries ...  rollback;
-- Do not paste results that contain device secrets or tokens into chat (none of these queries select them).

-- ───────────── I-23: why do many STATION_01 salinity values read exactly 0? ─────────────

-- Q1. Raw last 30 readings: is salinity 0 while EC is clearly non-zero? (0 with EC > 0 is the suspect pattern)
select timestamp, ec_ms_cm, water_ec_ms_cm, temperature_c, water_temp_c, salinity, salinity_ppm, tds_ppm, ec_probe_status, fault_flags
from public.environmental_readings
where station_id = 'STATION_01'
order by timestamp desc
limit 30;

-- Q2. How often is salinity exactly 0, NULL, or > 0 (last 7 days) — and what is EC in each bucket?
select
  case when salinity is null then 'null' when salinity = 0 then 'zero' else 'positive' end as salinity_bucket,
  count(*)                                   as n,
  round(avg(coalesce(ec_ms_cm, water_ec_ms_cm))::numeric, 3) as avg_ec_ms_cm,
  min(timestamp)                             as first_seen,
  max(timestamp)                             as last_seen
from public.environmental_readings
where station_id = 'STATION_01' and timestamp > now() - interval '7 days'
group by 1
order by 1;

-- Q3. Zero-salinity RUNS: consecutive zero readings point to a failed register read (firmware fallback / probe),
--     isolated zeros point to a genuinely fresh sample. Shows each run's length and its first/last timestamp.
with ordered as (
  select timestamp, (salinity = 0) as is_zero,
         row_number() over (order by timestamp) as rn
  from public.environmental_readings
  where station_id = 'STATION_01' and timestamp > now() - interval '7 days' and salinity is not null
), runs as (
  select timestamp, is_zero,
         rn - row_number() over (partition by is_zero order by timestamp) as grp
  from ordered
)
select is_zero, count(*) as run_length, min(timestamp) as run_start, max(timestamp) as run_end
from runs
group by is_zero, grp
having is_zero
order by run_length desc
limit 20;

-- Q4. Does salinity=0 coincide with a probe/ultrasonic fault status or fault flags?
select ec_probe_status, (fault_flags <> 0) as has_fault_flags, count(*) as zero_salinity_rows
from public.environmental_readings
where station_id = 'STATION_01' and salinity = 0 and timestamp > now() - interval '7 days'
group by 1, 2
order by zero_salinity_rows desc;

-- Q5. Before/after the I-22 firmware change is flashed this query is the evidence of effect:
--     expected after flashing: zero-salinity rows with EC > 1 mS/cm disappear (missing is sent as NULL, never 0).
select date_trunc('day', timestamp) as day,
       count(*) filter (where salinity = 0)                              as zero_salinity,
       count(*) filter (where salinity = 0 and coalesce(ec_ms_cm, water_ec_ms_cm) > 1) as zero_with_ec_above_1,
       count(*) filter (where salinity is null)                          as null_salinity,
       count(*)                                                          as total
from public.environmental_readings
where station_id = 'STATION_01' and timestamp > now() - interval '14 days'
group by 1
order by 1 desc;

-- ───────────── Migration 035 preflight (what it WOULD change; counts only) ─────────────

-- P1. Rows whose public water columns are empty but the private source columns hold a value.
select
  count(*) filter (where water_ec_ms_cm is null and ec_ms_cm is not null)       as would_mirror_ec,
  count(*) filter (where water_temp_c   is null and temperature_c is not null)  as would_mirror_temp,
  count(*)                                                                      as total_rows
from public.environmental_readings;

-- P2. Salinity checksum — must be identical before and after migration 035 (it never touches salinity).
select count(*) as n, coalesce(sum(salinity), 0) as sum_salinity, count(salinity) as n_nonnull_salinity
from public.environmental_readings;

-- P3. Confirm migration 035 is NOT already applied (expect 0 rows / 'false').
select exists (select 1 from pg_proc where proname = 'mirror_water_ec_temperature') as trigger_function_exists;

-- ───────────── Storage / report evidence readiness (metadata only) ─────────────

-- S1. Bucket exists, is private, with the intended limits.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'report-evidence';

-- S2. Storage policy for the bucket exists and is service-role only.
select policyname, roles, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'report_evidence%';

-- S3. Free-plan headroom: total evidence bytes already stored (Free plan Storage cap is 1 GB).
select count(*) as objects, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_size
from storage.objects where bucket_id = 'report-evidence';

-- S4. Migration 026 / 021 present (report_media table and rate-limit function).
select to_regclass('public.report_media') as report_media_table, to_regproc('public.consume_report_rate_limit') as rate_limit_fn;

-- ───────────── Admin allow-list sanity (no emails are exposed beyond counts) ─────────────
select count(*) filter (where active) as active_admins, count(*) filter (where not active) as revoked from public.admin_allowed_emails;
