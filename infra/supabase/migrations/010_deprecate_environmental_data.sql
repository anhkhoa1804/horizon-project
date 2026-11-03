-- ECO-020 Phase B: Migrate legacy rows then rename deprecated table

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'environmental_data'
  ) then
    insert into public.environmental_readings (
      message_id, station_id, salinity, water_level, fault_flags,
      ec_probe_status, ultrasonic_status, timestamp
    )
    select
      ed.message_id, ed.station_id, ed.salinity, ed.water_level, ed.fault_flags,
      ed.ec_probe_status, ed.ultrasonic_status, ed.timestamp
    from public.environmental_data ed
    on conflict (message_id) do nothing;

    alter table public.environmental_data rename to environmental_data_legacy;
    comment on table public.environmental_data_legacy is
      'Deprecated. Migrated to environmental_readings. Dropped by 011_drop_environmental_data_legacy.sql';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'environmental_data_legacy'
  ) then
    execute 'drop policy if exists environmental_data_select_scoped on public.environmental_data_legacy';
  end if;
end $$;
