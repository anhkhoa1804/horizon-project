# Pilot Bootstrap

## Purpose

This checklist prepares Eco-Sense Cồn Hô for a real field pilot. The goal is not only to make devices send data, but to ensure farmers, visitors, administrators, researchers, and judges can trust what they see.

## Pilot success criteria

A pilot is ready when:

- at least one station sends signed telemetry successfully,
- the station appears on a public QR page,
- salinity and water-level status are understandable on mobile,
- sensor health and last updated time are visible,
- admin users can identify station issues,
- community reports can be submitted,
- invalid telemetry is rejected safely,
- documentation matches the deployed behavior.

## Environment setup

Prepare separate environments for development, staging, and production when possible.

Required configuration:

- Supabase project URL.
- Supabase anon key for browser-safe access.
- Supabase service role key for server-only operations.
- Edge Function deployment.
- Database migrations applied.
- RLS policies enabled and verified.
- Public site deployment.
- Admin login provider configured.

Never expose service role keys or device secrets in browser code, public documentation screenshots, or QR payloads.

## Station provisioning

For each station, record:

- station ID,
- physical location,
- device ID,
- device secret,
- firmware version,
- sensor types,
- calibration date,
- expected reporting interval,
- safe salinity threshold,
- safe water-level threshold,
- QR page URL,
- responsible operator.

Device secrets must be stored securely and rotated if exposed.

## Sensor calibration

Before field deployment:

- confirm EC probe calibration,
- confirm ultrasonic or water-level sensor placement,
- test battery voltage reading,
- test signal strength reading,
- compare readings with manual measurement where possible,
- record calibration metadata,
- mark sensor status as trustworthy only after validation.

## QR deployment

Each station should have a durable QR label pointing to its public station page.

QR requirements:

- URL opens without login.
- Page loads on a common Android phone.
- Station identity is obvious.
- Current status appears immediately.
- Last updated time is visible.
- Report action is easy to find.
- QR label survives outdoor conditions.

Do not encode secrets or device credentials in QR codes.

## Field test script

1. Power on the station.
2. Confirm sensor readings are plausible.
3. Send a signed telemetry payload.
4. Confirm ingestion success.
5. Open the public station QR page.
6. Confirm salinity, water level, freshness, and sensor health.
7. Submit a community report from mobile.
8. Open admin console.
9. Confirm station health, latest reading, and report visibility.
10. Simulate stale data or sensor fault and confirm the UI explains it clearly.

## Data quality checks

During pilot, monitor:

- missing readings,
- duplicate messages,
- timestamp drift,
- signature failures,
- sensor faults,
- battery decline,
- weak LTE signal,
- threshold exceedances,
- community reports,
- operator response time.

## Incident response

When a station is unhealthy:

1. Determine whether the issue is environmental, sensor-related, connectivity-related, or power-related.
2. Mark the public UI state honestly.
3. Avoid presenting stale data as current.
4. Record operator actions.
5. Update station status after maintenance.

## Pilot handoff package

Before presenting or expanding the pilot, prepare:

- station inventory,
- QR code list,
- calibration records,
- threshold definitions,
- admin account list,
- telemetry contract reference,
- known limitations,
- demo route,
- field maintenance contacts,
- rollback plan.
