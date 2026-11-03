-- ECO-029: converge the operational station table on the sole Cồn Hô
-- coordinate authority in apps/web/lib/geo.ts and pilot_seed.sql.
-- This migration intentionally changes only the three canonical pilot nodes.
update public.stations
set lat = case id
            when 'STATION_01' then 10.073972
            when 'STATION_02' then 10.072444
            when 'STATION_03' then 10.071000
          end,
    lng = case id
            when 'STATION_01' then 106.250417
            when 'STATION_02' then 106.253056
            when 'STATION_03' then 106.254167
          end
where id in ('STATION_01', 'STATION_02', 'STATION_03');
