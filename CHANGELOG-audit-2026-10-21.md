# Change log — HORIZON technical audit (21 Oct 2026)

- Reports: direct-to-Storage video upload (manifest -> signed URLs -> finalize), truthful partial success, evidence signed URLs in Admin.
- Admin: export columns fixed, login rate limit and no account enumeration, config conflict mapping (40001 and P0409).
- Database: migration 035 (mirror EC/temperature, I-18), migration 036 (conflict code P0409, fixes PostgREST retry loop / config-write stall, I-25).
- Firmware: removed EC x 0.64 salinity fallback (I-22), host tests. Not compiled for ESP32, not flashed.
- Web UX/QA: Field Notes real images + links (I-19), empty weather cells (I-20), soil box (I-21), axe fixes and zoom (I-28), PWA registration and precache (I-27), /admin and /api never cached (I-26), EN home translation (I-29).
- Staging: `infra/supabase/local-stack`, `scripts/staging/*` E2E suites, local-iso 035 verification.
- Docs: AUDIT_ISSUES, QA_FLOW_MATRIX, ADMIN_E2E_MATRIX, LOCAL_STAGING, MIGRATION_035_RUNBOOK, FIRMWARE_I22_READINESS, READONLY_PRODUCTION_QUERIES.sql, APPROVAL_CHECKLIST, RELEASE_REPORT.
