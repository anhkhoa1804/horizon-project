-- ECO-020: Defense in depth for the two admin-surface tables added after 012.
--
-- 012_revoke_anon_sensitive_grants.sql stripped anon's SELECT grant from every
-- sensitive table that existed at the time. Two tables were created later and
-- never got the same treatment:
--
--   admin_allowed_emails    (017) — operator email addresses, i.e. PII
--   device_runtime_configs  (014) — field-node duty-cycle configuration
--
-- Both are protected today, but only by RLS: Supabase's default privileges
-- hand new tables in `public` an anon SELECT grant, and neither table has an
-- anon policy, so the row filter returns nothing. Verified against the live
-- database during the production-readiness audit — anon SELECT on both
-- returns 200 with zero rows, while the tables in 012's list return 401.
--
-- The distinction matters. 401 means the request never reached the policy
-- engine; 200-with-no-rows means it did, and one mistaken `to anon` policy or
-- one `using (true)` added later would start returning real rows. Every other
-- sensitive table in this schema is protected by BOTH the missing grant and
-- the missing policy. These two should be as well.
--
-- Safe to run against a live database: it removes a privilege that is
-- currently unusable, and touches no data. Revoking a grant that was never
-- effectively exercised cannot break a working code path — the app reads both
-- tables through the service-role client (lib/auth/adminAllowlist.ts,
-- app/api/public/gateway/configs/route.ts), which bypasses RLS and is
-- unaffected by anon grants.

revoke select on public.admin_allowed_emails from anon;
revoke select on public.device_runtime_configs from anon;

-- gateway_observations is deprecated (see 018) and written by nothing, but it
-- still holds historical field data and carries the same default grant.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gateway_observations'
  ) then
    execute 'revoke select on public.gateway_observations from anon';
  end if;
end $$;
