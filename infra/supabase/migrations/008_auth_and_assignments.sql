-- ECO-009: Link public.users to auth.users, station assignments, auth helpers

-- ---------------------------------------------------------------------------
-- station_assignments
-- ---------------------------------------------------------------------------
create table if not exists public.station_assignments (
  user_id uuid not null references public.users(id) on delete cascade,
  station_id text not null references public.stations(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users(id) on delete set null,
  primary key (user_id, station_id)
);

create index if not exists idx_station_assignments_user
  on public.station_assignments (user_id);

create index if not exists idx_station_assignments_station
  on public.station_assignments (station_id);

-- ---------------------------------------------------------------------------
-- public.users ↔ auth.users
-- ---------------------------------------------------------------------------
alter table public.users
  alter column phone drop not null;

alter table public.users
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists users_email_unique
  on public.users (email)
  where email is not null;

-- Remove legacy seed users that are not backed by auth.users
delete from public.users u
where not exists (
  select 1 from auth.users a where a.id = u.id
);

alter table public.users
  alter column id drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Authorization helper functions (security definer, stable)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.has_station_access(p_station_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.station_assignments sa
      where sa.user_id = auth.uid()
        and sa.station_id = p_station_id
    );
$$;

-- Prevent non-admins from escalating their own role
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role change requires admin privileges';
  end if;

  if tg_op = 'INSERT' and new.role <> 'farmer' and not public.is_admin() then
    raise exception 'new users default to farmer role';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_prevent_role_escalation on public.users;

create trigger users_prevent_role_escalation
  before insert or update on public.users
  for each row
  execute function public.prevent_role_escalation();

-- Idempotent profile bootstrap callable from app or trigger
create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.users;
begin
  if p_user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'cannot bootstrap profile for another user';
  end if;

  insert into public.users (id, email, role)
  values (p_user_id, p_email, 'farmer')
  on conflict (id) do update
    set email = coalesce(excluded.email, public.users.email),
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.ensure_user_profile(uuid, text) to authenticated;

alter table public.station_assignments enable row level security;
