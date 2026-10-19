-- ECO-028: remove an unused MD5 backfill column.
--
-- Repository audit 2026-09-21 found no runtime, function, RLS policy, view,
-- trigger, or application reference to devices.device_secret_hash. The real
-- HMAC verifier requires devices.device_secret and reads that raw key. Do not
-- use CASCADE: an unexpected production dependency must stop this migration
-- for review rather than be removed implicitly.
alter table public.devices drop column if exists device_secret_hash;
