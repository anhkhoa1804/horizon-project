-- ECO-023: The threshold registry.
--
-- THE PROBLEM THIS SOLVES
-- `alert_configs` (022) stores a number, a comparison and a severity. That is
-- enough to colour a cell and nothing else — it cannot record WHERE a number
-- came from, what quantity it actually describes, or whether it is settled
-- science, a pilot guess, or a measurement-quality rule. With only that table,
-- writing a published FAO figure into the system silently converts it into an
-- operational alert rule, which is precisely the failure this project's
-- honesty rules exist to prevent.
--
-- THE THREE DISTINCTIONS THE SCHEMA ENFORCES
--
--   REFERENCE  ≠ OPERATIONAL   published guidance is not an alert rule
--   OPERATIONAL ≠ SITE_VALIDATED  a pilot ladder is not a measured fact
--   QUALITY    ≠ ENVIRONMENTAL   "the probe cannot be trusted here" is not
--                                "the soil is safe"
--
-- `is_active` is the load-bearing column. A row may carry a perfectly good
-- citation and still produce no status at all. NOTHING becomes an alert
-- without someone setting is_active explicitly, and a CHECK forbids activating
-- anything still marked REFERENCE.
--
-- WHY QUANTITY IS ITS OWN COLUMN
-- ECw, ECe, bulk in-situ soil EC and salinity in ‰ are four different physical
-- quantities that share the word "salinity" in conversation. Most of the
-- category errors available here come from letting a threshold defined on one
-- be applied to another. `quantity` makes the distinction explicit and
-- machine-checkable rather than a matter of the reader's care.

create table if not exists public.threshold_registry (
  id uuid primary key default gen_random_uuid(),

  -- What is being measured -------------------------------------------------
  metric_key text not null,
  -- The PHYSICAL quantity, not the display label. ECw and bulk_soil_ec are
  -- different rows even though a person would call both "EC".
  quantity text not null check (
    quantity in (
      'water_ec',        -- ECw, conductivity of irrigation water
      'water_ph',
      'water_salinity',  -- parts per thousand - NOT interchangeable with water_ec
      'water_level',
      'soil_ec_bulk',    -- in-situ probe reading - NOT ECe
      'soil_ec_saturated_extract', -- ECe, laboratory preparation
      'soil_ph',
      'soil_moisture',
      'soil_temp',
      'air_temp',
      'air_humidity',
      'battery_voltage',
      'signal_dbm'
    )
  ),
  unit text not null,

  -- The threshold itself ---------------------------------------------------
  threshold_value numeric,
  -- `between` uses threshold_value as the lower bound and upper_value as the
  -- upper: a normal band such as water pH 6.5-8.4 is one row, not two.
  comparison text not null check (comparison in ('above', 'below', 'between', 'outside')),
  upper_value numeric,
  severity text not null check (severity in ('normal', 'watch', 'warning', 'critical', 'low_confidence')),

  -- Where it came from -----------------------------------------------------
  basis text not null check (
    basis in (
      'FAO_REFERENCE',
      'CITRUS_REFERENCE',
      'POMELO_MEKONG_REFERENCE',
      'SENSOR_QUALITY',
      'DEVICE_HEALTH',
      'SITE_CALIBRATED',
      'LEGACY_UNVALIDATED'
    )
  ),
  source_title text,
  source_url text,
  -- Page, table or section, so a reader can find the exact figure rather than
  -- the document that contains it.
  source_locator text,
  -- The population the figure was established for. "general irrigation water"
  -- and "grapefruit, stated assumptions" are very different claims.
  scope text,

  -- How much weight it may carry -------------------------------------------
  validation_status text not null check (
    validation_status in ('REFERENCE', 'PILOT', 'OPERATIONAL', 'SITE_VALIDATED')
  ),

  -- THE SAFETY INTERLOCK. Only an explicitly activated row produces status,
  -- and a row still marked REFERENCE can never be activated.
  is_active boolean not null default false,

  effective_from date,
  notes text,
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reference_rows_cannot_be_active
    check (not (is_active and validation_status = 'REFERENCE')),

  -- A band needs both ends; a one-sided comparison must not carry a stray one.
  constraint band_needs_upper_bound
    check (
      (comparison in ('between', 'outside') and upper_value is not null)
      or (comparison in ('above', 'below') and upper_value is null)
    )
);

comment on table public.threshold_registry is
  'Every threshold the system knows, with provenance. is_active is the interlock: a cited reference value produces NO status until someone activates it, and REFERENCE rows can never be activated.';

comment on column public.threshold_registry.quantity is
  'The physical quantity. ECw / ECe / bulk soil EC / salinity are four different quantities that share a word in conversation - keeping them apart here is what prevents a category error.';

create index if not exists idx_threshold_registry_metric
  on public.threshold_registry (metric_key, is_active);

create or replace function public.touch_threshold_registry_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_threshold_registry_updated_at on public.threshold_registry;
create trigger touch_threshold_registry_updated_at
before update on public.threshold_registry
for each row execute function public.touch_threshold_registry_updated_at();

alter table public.threshold_registry enable row level security;
revoke all on public.threshold_registry from anon;
revoke all on public.threshold_registry from authenticated;
grant select, insert, update, delete on public.threshold_registry to service_role;

-- ---------------------------------------------------------------------------
-- Soil water model — per station, because FC and PWP are soil properties
-- ---------------------------------------------------------------------------
--
-- Soil moisture deliberately has NO fixed percentage in the registry above.
-- USDA/NRCS expresses an irrigation trigger as a fraction of AVAILABLE water
-- depleted, which makes it a function of the site's own field capacity and
-- permanent wilting point:
--
--     trigger = FC - MAD x (FC - PWP)
--
-- A hard-coded "moisture < 35%" looks precise and means nothing without those
-- two numbers. This table is where a site measurement replaces a guess; the
-- trigger is generated, so it cannot drift from its inputs.
create table if not exists public.soil_water_models (
  station_id text primary key references public.stations(id) on delete cascade,
  field_capacity_pct numeric not null check (field_capacity_pct between 0 and 100),
  permanent_wilting_point_pct numeric not null check (permanent_wilting_point_pct between 0 and 100),
  -- 50% is USDA's starting assumption where local data is absent. It is a
  -- management convention, not a physiological constant.
  management_allowed_depletion_pct numeric not null default 50
    check (management_allowed_depletion_pct between 0 and 100),
  irrigation_trigger_pct numeric generated always as (
    field_capacity_pct
      - (management_allowed_depletion_pct / 100.0)
      * (field_capacity_pct - permanent_wilting_point_pct)
  ) stored,
  basis text not null default 'SITE_CALIBRATED',
  source_note text,
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pwp_below_fc check (permanent_wilting_point_pct < field_capacity_pct)
);

comment on table public.soil_water_models is
  'Per-station FC/PWP/MAD. irrigation_trigger_pct is generated from them so it can never drift from its inputs. Empty until Cong Ho soil is actually measured - no default row is seeded, because a guessed FC is worse than none.';

alter table public.soil_water_models enable row level security;
revoke all on public.soil_water_models from anon;
revoke all on public.soil_water_models from authenticated;
grant select, insert, update, delete on public.soil_water_models to service_role;

-- ---------------------------------------------------------------------------
-- Seed: literature values only. Every one inactive.
-- ---------------------------------------------------------------------------
--
-- These are citations, not settings. They exist so the interpretation shown to
-- the public has a recorded basis, and so an operator can see what published
-- guidance says before choosing an operational threshold. Not one of them
-- colours a cell.

insert into public.threshold_registry
  (metric_key, quantity, unit, threshold_value, upper_value, comparison, severity,
   basis, source_title, source_url, source_locator, scope, validation_status, is_active, notes)
values
  -- FAO irrigation water EC (ECw) --------------------------------------------
  ('water_ec', 'water_ec', 'dS/m', 0.7, null, 'below', 'normal',
   'FAO_REFERENCE',
   'Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev. 1 - Water Quality for Agriculture',
   'https://www.fao.org/4/t0234e/T0234E01.htm',
   'Table 1, Degree of restriction on use',
   'General irrigation water, all crops',
   'REFERENCE', false,
   'No restriction on use. Applies to ECw, the conductivity of irrigation water - NOT to salinity in per-mille and NOT to soil EC.'),

  ('water_ec', 'water_ec', 'dS/m', 0.7, 3.0, 'between', 'watch',
   'FAO_REFERENCE',
   'Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev. 1 - Water Quality for Agriculture',
   'https://www.fao.org/4/t0234e/T0234E01.htm',
   'Table 1, Degree of restriction on use',
   'General irrigation water, all crops',
   'REFERENCE', false,
   'Slight to moderate restriction. FAO is explicit that EC must be read with soil, crop and use context rather than as an absolute biological boundary.'),

  ('water_ec', 'water_ec', 'dS/m', 3.0, null, 'above', 'critical',
   'FAO_REFERENCE',
   'Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev. 1 - Water Quality for Agriculture',
   'https://www.fao.org/4/t0234e/T0234E01.htm',
   'Table 1, Degree of restriction on use',
   'General irrigation water, all crops',
   'REFERENCE', false,
   'Severe restriction on use.'),

  -- Citrus / grapefruit ECw yield-response reference points -------------------
  ('water_ec', 'water_ec', 'dS/m', 1.2, null, 'above', 'watch',
   'CITRUS_REFERENCE',
   'UC Davis, Water Quality Guidelines for Trees and Vines (after Maas & Grattan)',
   'https://www.fao.org/4/y4263e/y4263e0e.htm',
   'Grapefruit, irrigation water EC vs relative yield',
   'Grapefruit under stated leaching and management assumptions',
   'REFERENCE', false,
   'Approximately 100% yield potential. A crop-response reference point, not a limit. Pomelo (Citrus maxima) is FAO-classed salt sensitive; grapefruit is the nearest published proxy, not the same cultivar.'),

  ('water_ec', 'water_ec', 'dS/m', 1.6, null, 'above', 'warning',
   'CITRUS_REFERENCE',
   'UC Davis, Water Quality Guidelines for Trees and Vines (after Maas & Grattan)',
   'https://www.fao.org/4/y4263e/y4263e0e.htm',
   'Grapefruit, irrigation water EC vs relative yield',
   'Grapefruit under stated leaching and management assumptions',
   'REFERENCE', false,
   'Approximately 90% yield potential - this is what 1.6 means. It is NOT a critical environmental threshold and must never be labelled one.'),

  ('water_ec', 'water_ec', 'dS/m', 2.2, null, 'above', 'warning',
   'CITRUS_REFERENCE',
   'UC Davis, Water Quality Guidelines for Trees and Vines (after Maas & Grattan)',
   'https://www.fao.org/4/y4263e/y4263e0e.htm',
   'Grapefruit, irrigation water EC vs relative yield',
   'Grapefruit under stated leaching and management assumptions',
   'REFERENCE', false, 'Approximately 75% yield potential.'),

  ('water_ec', 'water_ec', 'dS/m', 3.3, null, 'above', 'critical',
   'CITRUS_REFERENCE',
   'UC Davis, Water Quality Guidelines for Trees and Vines (after Maas & Grattan)',
   'https://www.fao.org/4/y4263e/y4263e0e.htm',
   'Grapefruit, irrigation water EC vs relative yield',
   'Grapefruit under stated leaching and management assumptions',
   'REFERENCE', false, 'Approximately 50% yield potential.'),

  -- Water pH -----------------------------------------------------------------
  ('water_ph', 'water_ph', 'pH', 6.5, 8.4, 'between', 'normal',
   'FAO_REFERENCE',
   'Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev. 1 - Water Quality for Agriculture',
   'https://www.fao.org/4/t0234e/T0234E01.htm',
   'Abnormal pH',
   'Irrigation water',
   'REFERENCE', false, 'Normal range for irrigation water.'),

  ('water_ph', 'water_ph', 'pH', 6.5, 8.4, 'outside', 'warning',
   'FAO_REFERENCE',
   'Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev. 1 - Water Quality for Agriculture',
   'https://www.fao.org/4/t0234e/T0234E01.htm',
   'Abnormal pH',
   'Irrigation water',
   'REFERENCE', false,
   'Outside the normal range - a signal to evaluate. Deliberately no CRITICAL band: FAO gives no severity ladder that would justify calling a specific pH a critical environmental risk.'),

  -- Soil pH ------------------------------------------------------------------
  ('soil_ph', 'soil_ph', 'pH', 6.0, 6.5, 'between', 'normal',
   'CITRUS_REFERENCE',
   'UF/IFAS citrus production guidance',
   null, 'Soil pH management for citrus', 'Citrus, general',
   'REFERENCE', false, 'Target range.'),

  ('soil_ph', 'soil_ph', 'pH', 5.0, 6.0, 'between', 'watch',
   'POMELO_MEKONG_REFERENCE',
   'Tho nhuong phau dien dat phu sa nhiem man canh tac buoi Da Xanh, xa Luong Hoa, Vinh Long (2026)',
   'https://vjol.vista.gov.vn/tcnongnghiepmoitruong-vie/vi/article/view/125451',
   'Surface profile pH(H2O) 4.47-5.68',
   'Da Xanh pomelo on saline alluvial soil, Vinh Long',
   'PILOT', false,
   'Below the citrus target. The local study recorded exactly this band and concluded pH needed improvement.'),

  ('soil_ph', 'soil_ph', 'pH', 5.0, null, 'below', 'critical',
   'POMELO_MEKONG_REFERENCE',
   'Tho nhuong phau dien dat phu sa nhiem man canh tac buoi Da Xanh, xa Luong Hoa, Vinh Long (2026)',
   'https://vjol.vista.gov.vn/tcnongnghiepmoitruong-vie/vi/article/view/125451',
   'Surface profile pH(H2O) 4.47-5.68',
   'Da Xanh pomelo on saline alluvial soil, Vinh Long',
   'PILOT', false,
   'Below pH 5 the solubility of Al/Fe/Mn/Zn rises and can become toxic for citrus. Agronomic reference - NOT a Cong Ho-specific validated threshold.'),

  ('soil_ph', 'soil_ph', 'pH', 7.0, null, 'above', 'warning',
   'CITRUS_REFERENCE',
   'UF/IFAS citrus production guidance',
   null, 'Soil pH management for citrus', 'Citrus, general',
   'REFERENCE', false, 'Alkaline - watch for micronutrient deficiency.'),

  -- Soil EC measurement confidence (QUALITY, not severity) --------------------
  ('soil_moisture', 'soil_moisture', '%', 20, null, 'below', 'low_confidence',
   'SENSOR_QUALITY',
   'ES-SM-THEC-01 soil probe documentation',
   null, 'Measurement conditions for ion/EC readings',
   'The soil EC reading, when moisture is below this level',
   'REFERENCE', false,
   'MEASUREMENT QUALITY, NOT SALINITY. Below roughly 20% moisture the probe cannot give a dependable EC reading. This says "do not over-interpret EC here" - it does NOT say the soil is safe, and it does NOT say the soil is saline.'),

  -- Device health ------------------------------------------------------------
  ('battery_voltage', 'battery_voltage', 'V', 3.8, null, 'below', 'watch',
   'DEVICE_HEALTH', 'Li-ion discharge characteristics', null, 'Node battery',
   'Field node power', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),
  ('battery_voltage', 'battery_voltage', 'V', 3.6, null, 'below', 'warning',
   'DEVICE_HEALTH', 'Li-ion discharge characteristics', null, 'Node battery',
   'Field node power', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),
  ('battery_voltage', 'battery_voltage', 'V', 3.4, null, 'below', 'critical',
   'DEVICE_HEALTH', 'Li-ion discharge characteristics', null, 'Node battery',
   'Field node power', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),

  ('signal_dbm', 'signal_dbm', 'dBm', -85, null, 'below', 'watch',
   'DEVICE_HEALTH', 'LoRa / cellular link budget', null, 'Node uplink',
   'Field node connectivity', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),
  ('signal_dbm', 'signal_dbm', 'dBm', -95, null, 'below', 'warning',
   'DEVICE_HEALTH', 'LoRa / cellular link budget', null, 'Node uplink',
   'Field node connectivity', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),
  ('signal_dbm', 'signal_dbm', 'dBm', -100, null, 'below', 'critical',
   'DEVICE_HEALTH', 'LoRa / cellular link budget', null, 'Node uplink',
   'Field node connectivity', 'OPERATIONAL', true, 'Engineering limit, not environmental science.'),

  -- Water level: measurement validity only ------------------------------------
  ('water_level', 'water_level', 'cm', 3, 450, 'between', 'normal',
   'SENSOR_QUALITY', 'A02YYUW ultrasonic sensor specification', null,
   'Valid measurement range, approximately 3-450 cm',
   'Sensor validity only',
   'REFERENCE', false,
   'Outside this range is a SENSOR FAULT, not a flood. A flood threshold requires a surveyed local datum tying water level to bank, root-zone and path elevations at Cong Ho - which does not exist yet.')
on conflict do nothing;

-- Deliberately NOT seeded, and each absence is a decision:
--
--   water_salinity (per-mille)  the station reports this value, but salinity
--                               and ECw remain different quantities. No
--                               arbitrary conversion or operational band is
--                               seeded without site validation.
--   soil_ec_bulk                FAO's figures are ECe from a saturated paste
--                               extract; the probe reports bulk in-situ EC.
--                               Applying one to the other is a category error.
--   soil_moisture severity      belongs in soil_water_models, derived from the
--                               site's own FC and PWP.
--   soil_temp, air_temp,        no source matches a single-variable alarm on
--   air_humidity                these quantities.
