-- Station 01 can legitimately report a partial water packet: for example,
-- ultrasonic water level is valid while the EC/salinity probe is unavailable.
-- Preserve that as NULL instead of fabricating zeroes or rejecting the packet.

alter table public.environmental_readings
  alter column salinity drop not null,
  alter column water_level drop not null;

comment on column public.environmental_readings.salinity is
  'Water salinity in ppt when the EC/salinity probe reports a valid value. NULL means the probe did not report; never coerce to zero.';

comment on column public.environmental_readings.water_level is
  'Water level in cm when the ultrasonic sensor reports a valid value. NULL means the sensor did not report; never coerce to zero.';
