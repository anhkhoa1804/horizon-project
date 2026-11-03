-- Durable, private evidence for public field reports. Objects are written only
-- by server-side routes using the service role; the browser never receives a
-- Storage credential or a public object URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-evidence',
  'report-evidence',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.damage_logs(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('photo', 'video', 'audio')),
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  duration_seconds numeric(10,3),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_media_report_created
  on public.report_media (report_id, created_at);

comment on table public.report_media is
  'Private evidence attached to damage_logs. Storage objects remain private; signed read URLs are issued only by the admin server route.';

alter table public.report_media enable row level security;
revoke all on public.report_media from anon;
revoke all on public.report_media from authenticated;
grant select, insert, update, delete on public.report_media to service_role;

drop policy if exists report_evidence_service_role on storage.objects;
create policy report_evidence_service_role
on storage.objects
for all
to service_role
using (bucket_id = 'report-evidence')
with check (bucket_id = 'report-evidence');
