-- ECO-020 Phase C: Remove deprecated legacy telemetry table

drop table if exists public.environmental_data_legacy cascade;
