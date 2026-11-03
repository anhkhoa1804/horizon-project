-- Defense in depth: anon role must not read private telemetry even if a stray policy exists.

revoke select on public.stations from anon;
revoke select on public.environmental_readings from anon;
revoke select on public.environmental_events from anon;
revoke select on public.station_health_logs from anon;
revoke select on public.users from anon;
revoke select on public.station_assignments from anon;
revoke select on public.devices from anon;
revoke select on public.ingestion_audit_logs from anon;
revoke select on public.damage_logs from anon;
revoke select on public.crop_thresholds from anon;
revoke select on public.firmware_updates from anon;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'environmental_data_legacy'
  ) then
    execute 'revoke select on public.environmental_data_legacy from anon';
  end if;
end $$;
