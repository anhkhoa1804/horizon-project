# HORIZON — Current product status

Last audited: 2026-09-21

This is the current operational reading of the repository. It is not a
historical redesign record and must be updated when a field or production
claim changes.

## Implemented

- Public Observatory, field report flow, shared-admin console, threshold
  registry, report-media model, edge ingestion, and the three-node pilot
  registry.
- Canonical pilot nodes: `STATION_01` (water), `STATION_02` (soil), and
  `STATION_03` (gateway). `STATION_04` and `STATION_05` are removed from
  seed and simulator topology.
- Explicit dashboard demo mode (`?mode=demo`) for design review; production
  monitoring does not silently select it.
- Report media validation and private, signed-URL delivery for Admin.

## Deployed / configuration dependent

- Public reads use the anonymous Supabase client and RLS. Service-role access
  is server-only for Admin, report persistence, and signed media URLs.
- Report persistence requires Supabase. A normal request returns an explicit
  service-unavailable response if durable storage is unavailable; only an
  explicit demo request can create an in-memory demonstration record.
- Runtime configuration can be stored in the database. It must be described
  as **stored / awaiting device poll** until a gateway acknowledges it.

## Field verified only when recorded

- Firmware endpoints are the Supabase `edge-ingest` Function and
  `https://horizon.frogsleap.com.vn/api/public/gateway/configs`.
- Gateway `+HTTPACTION 702` is a modem transport result, not an HTTP status.
  The diagnostic path is implemented, but its DNS/PDP/TLS stage must be
  confirmed from a real serial capture.
- Threshold references are not site-validated operating limits unless their
  registry record is active with appropriate provenance and calibration.

## Demo-only / local-only

- `apps/web/lib/demo/*`, `demoReportStore.ts`, mock edge DBs, and the edge
  simulator exist for visual QA and contract tests. They are not a source of
  production telemetry or reports.
- Seed secrets and simulator credentials are public development placeholders.
  They must never be provisioned to a physical field device.

## Unresolved release gates

1. Apply all production migrations, including `027_remove_fixture_and_qa_data`
   and the non-cascading `028_remove_dead_device_secret_hash`.
2. Rotate every production device secret and verify the deployment checker.
3. Run authenticated Admin persistence QA against the intended environment.
4. Capture a real gateway network trace through DNS, TLS, edge ingest and
   Supabase persistence.
5. Run Live Smoke after its production secrets are configured.

## Historical documentation

Earlier redesign, roadmap, and architecture-decision files are retained as
historical context. This file, `PRODUCT_CONTEXT.md`, the migration ledger,
and the field checklist are the starting points for current-state claims.
