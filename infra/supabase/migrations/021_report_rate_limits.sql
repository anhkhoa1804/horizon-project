-- ECO-021: Durable rate limiting for the public report endpoint.
--
-- WHY
-- app/api/public/reports/route.ts is the only unauthenticated write path in
-- the system. Its throttle was a module-level `Map` in the Next.js process,
-- which on Vercel means: one counter per warm lambda instance, reset on every
-- cold start, and trivially bypassed by forcing concurrency (each new instance
-- starts at zero). That is friction, not a rate limit.
--
-- This moves the counter into Postgres, which every instance already shares.
-- No new vendor, no new dependency, no new environment variable — the route
-- already holds a service-role client.
--
-- ATOMICITY
-- `select ... for update` inside the function serialises concurrent callers on
-- the same bucket row, so two simultaneous requests cannot both read "4 hits"
-- and both write "5". Callers that lose the race simply wait for the row lock.
--
-- The window is fixed, not sliding: cheaper, and the failure mode (a caller
-- may get up to 2*max across a window boundary) is irrelevant for an abuse
-- control measured in reports per hour.

create table if not exists public.report_rate_limits (
  bucket text primary key,
  hits integer not null default 0,
  window_started_at timestamptz not null default now()
);

comment on table public.report_rate_limits is
  'Fixed-window counters for the public report endpoint. Written only by the service role via consume_report_rate_limit(). Not user data — safe to truncate.';

-- Housekeeping: the table is keyed by bucket, so it grows with distinct
-- clients, not with traffic. This index makes the occasional sweep cheap.
create index if not exists idx_report_rate_limits_window
  on public.report_rate_limits (window_started_at);

create or replace function public.consume_report_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
  v_started timestamptz;
begin
  insert into public.report_rate_limits (bucket, hits, window_started_at)
  values (p_bucket, 0, now())
  on conflict (bucket) do nothing;

  select hits, window_started_at
    into v_hits, v_started
    from public.report_rate_limits
   where bucket = p_bucket
     for update;

  -- Window elapsed: start a fresh one.
  if v_started < now() - make_interval(secs => p_window_seconds) then
    v_hits := 0;
    v_started := now();
  end if;

  if v_hits >= p_max then
    update public.report_rate_limits
       set hits = v_hits, window_started_at = v_started
     where bucket = p_bucket;
    return false;  -- rate limited
  end if;

  update public.report_rate_limits
     set hits = v_hits + 1, window_started_at = v_started
   where bucket = p_bucket;
  return true;     -- allowed
end;
$$;

-- The function is SECURITY DEFINER, so its grants are the whole access story.
-- Only the service role (used exclusively server-side) may call it; anon and
-- authenticated must not be able to burn or inspect another client's quota.
revoke all on function public.consume_report_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_report_rate_limit(text, integer, integer) from anon;
revoke all on function public.consume_report_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.consume_report_rate_limit(text, integer, integer) to service_role;

alter table public.report_rate_limits enable row level security;
revoke all on public.report_rate_limits from anon;
revoke all on public.report_rate_limits from authenticated;
