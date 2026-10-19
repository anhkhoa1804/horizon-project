-- ECO-027: production topology and QA-data cleanup.
--
-- STATION_04/05 (Brackish Edge, Mangrove Spur) were simulator fixtures
-- accidentally included in the original pilot seed. They are not deployed
-- HORIZON nodes. Remove their dependent fixture telemetry before removing the
-- device and station rows so an existing production database converges on the
-- canonical three-node topology.

delete from public.environmental_data_hourly where station_id in ('STATION_04', 'STATION_05');
delete from public.environmental_readings where station_id in ('STATION_04', 'STATION_05');
delete from public.environmental_events where station_id in ('STATION_04', 'STATION_05');
delete from public.station_health_logs where station_id in ('STATION_04', 'STATION_05');
delete from public.soil_readings where station_id in ('STATION_04', 'STATION_05');
delete from public.gateway_observations where station_id in ('STATION_04', 'STATION_05');
delete from public.ingestion_audit_logs where device_id in ('STATION_04', 'STATION_05');
delete from public.devices where device_id in ('STATION_04', 'STATION_05');
delete from public.stations where id in ('STATION_04', 'STATION_05');

-- These exact strings were created by browser-persistence QA, not field
-- operations. The predicates are deliberately narrow: this migration does
-- not infer that ordinary operator notes containing a word such as "test"
-- are disposable.
delete from public.maintenance_logs
where kind in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or note = 'QA browser persistence check';

delete from public.calibration_records
where sensor in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or note = 'QA browser persistence check';

delete from public.alert_configs
where metric in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or note = 'QA browser persistence check';

delete from public.audit_events
where action in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or entity in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or entity_id in ('QA_BROWSER_PERSISTENCE', 'QA_BROWSER_PERSISTENCE_NOT_FIELD')
   or metadata::text like '%QA browser persistence check%';
