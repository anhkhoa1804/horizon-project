-- ECO-017: Database-managed admin email allowlist

create table if not exists public.admin_allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists admin_allowed_emails_active_email_unique
  on public.admin_allowed_emails (lower(email))
  where active;

create index if not exists idx_admin_allowed_emails_active
  on public.admin_allowed_emails (active, created_at desc);

create or replace function public.touch_admin_allowed_emails_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(trim(new.email));
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_allowed_emails_touch_updated_at on public.admin_allowed_emails;

create trigger admin_allowed_emails_touch_updated_at
  before insert or update on public.admin_allowed_emails
  for each row
  execute function public.touch_admin_allowed_emails_updated_at();

alter table public.admin_allowed_emails enable row level security;

drop policy if exists admin_allowed_emails_select_admin on public.admin_allowed_emails;
drop policy if exists admin_allowed_emails_insert_admin on public.admin_allowed_emails;
drop policy if exists admin_allowed_emails_update_admin on public.admin_allowed_emails;

create policy admin_allowed_emails_select_admin
  on public.admin_allowed_emails
  for select
  to authenticated
  using (public.is_admin());

create policy admin_allowed_emails_insert_admin
  on public.admin_allowed_emails
  for insert
  to authenticated
  with check (public.is_admin());

create policy admin_allowed_emails_update_admin
  on public.admin_allowed_emails
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
