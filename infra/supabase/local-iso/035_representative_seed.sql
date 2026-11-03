-- Representative rows reproducing the live pattern (isolated DB only).
insert into public.stations (id,name,lat,lng,status) values ('STATION_01','Trạm Nước',10.0739,106.2504,'active'),('STATION_02','Trạm Đất',10.0724,106.2531,'active') on conflict (id) do nothing;
-- A: older ingest build: EC/temp only in ec_ms_cm/temperature_c, salinity numeric (the observed live pattern)
insert into public.environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp, ec_ms_cm, temperature_c, salinity_ppm)
select 'A-'||g, 'STATION_01', 0.061, 293, 'ok', 'ok', now() - (g||' minutes')::interval, 0.123, 29.0, 61 from generate_series(10,400,10) g;
-- B: zero-salinity run, EC present
insert into public.environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp, ec_ms_cm, temperature_c, salinity_ppm)
select 'B-'||g, 'STATION_01', 0, 290, 'ok', 'ok', now() - ((g+500)||' minutes')::interval, 0.01, 28.5, 0 from generate_series(1,50) g;
-- C: already-mirrored row with DIFFERENT public values (must not be overwritten)
insert into public.environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp, ec_ms_cm, temperature_c, water_ec_ms_cm, water_temp_c)
values ('C-1','STATION_01',0.2,280,'ok','ok', now() - interval '2 days', 9.9, 20.0, 1.111, 22.2);
-- D: partial row: probe missing (all NULL) must stay NULL, salinity NULL stays NULL
insert into public.environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp)
values ('D-1','STATION_01', null, 285,'fault','ok', now() - interval '3 days');
-- E: EC present, temperature missing
insert into public.environmental_readings (message_id, station_id, salinity, water_level, ec_probe_status, ultrasonic_status, timestamp, ec_ms_cm)
values ('E-1','STATION_01', 0.05, 287,'warn','ok', now() - interval '4 days', 0.2);
