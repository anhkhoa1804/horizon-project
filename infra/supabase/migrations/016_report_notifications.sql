-- Admin notification state for community reports.

alter table public.damage_logs
  add column if not exists viewed_at timestamptz,
  add column if not exists viewed_by uuid references public.users(id);

create index if not exists idx_damage_logs_unviewed
  on public.damage_logs (viewed_at, timestamp desc);

drop policy if exists damage_logs_admin_update on public.damage_logs;
create policy damage_logs_admin_update
  on public.damage_logs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
