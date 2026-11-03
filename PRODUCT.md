# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Farmers and community members around Cồn Hô who need to understand local observations or record something they have seen, often on a phone outdoors.
- Researchers and technical reviewers who need to inspect measurements, their provenance, time series, references, and the limits of the system.
- Project operators who manage reports, thresholds, station records, calibration records, maintenance, exports, access, and stored runtime configuration.

## Product Purpose

HORIZON is a field monitoring system rooted in Cồn Hô, Vĩnh Long. It connects environmental sensors, a gateway, data storage, a public observatory, community field reports, and administrative operations. Success means people can understand where observations come from, what the system currently knows, and what it cannot yet establish.

## Positioning

HORIZON makes the real sensing and telemetry path at Cồn Hô visible alongside its observations and limitations. Its identity comes from this specific place, its people, equipment, data, and field conditions.

## Operating Context

- The public observatory and field report flow must work without an account; reports are a way to record a community observation.
- Public readings may be inspected in bright outdoor conditions and on mobile devices.
- Operators work in a denser authenticated administration area.
- Existing project content and assets are the source of truth for the place and human story; do not add unverified field claims.

## Capabilities and Constraints

- The pilot topology is `STATION_01` (water), `STATION_02` (soil and microclimate), `STATION_03` (gateway location/role), and `GATEWAY_01` (the technical gateway identity). `STATION_03` is not a third sensor station.
- The product includes public home, observatory, and report routes, plus authenticated administration for network operations, reports, thresholds, application profiles, calibration, site models, maintenance, audit, export, access, and stored runtime configuration.
- Report location, observation, review, validation, and evidence attachments are an existing multi-step workflow and must retain their behavior.
- The observatory distinguishes measured HORIZON telemetry, external weather context, reference information, device health, and data quality.
- Missing data is unavailable, not zero. External weather is not HORIZON telemetry. EC is not salinity; bulk soil EC is not ECe. Reference thresholds are not operating thresholds unless validated and active.
- A calibration record does not confirm device calibration. Stored configuration or an admin record does not confirm device receipt or execution when the firmware has no acknowledgement path.
- Demo data is explicitly declared and remains distinct from real mode. Never invent readings, statuses, thresholds, recommendations, alerts, maps, or operational claims.
- Preserve the existing Next.js architecture, assets, backend, telemetry contracts, database semantics, and authentication model.

## Brand Commitments

Keep the HORIZON name, logo, and recognizable project identity. Avoid inventing a corporate/startup identity; the specific field project is the primary identity.

## Evidence on Hand

- Existing repository implementation and content, including routes under `apps/web/app/` and project-authored media in `apps/web/public/assets/`.
- Current pilot status and constraints are recorded in `docs/CURRENT_PRODUCT_STATUS.md`, `docs/PRODUCT_CONTEXT.md`, and `docs/SENSOR_CAPABILITY_MATRIX.md`.
- Do not fabricate telemetry, testimonials, partners, deployment evidence, or field validation.

## Product Principles

- Preserve measurement provenance and make limitations legible.
- Connect every observation to its real source, location, and time where available.
- Help community members report observations with a usable field workflow.
- Give operators a clear view of what the system knows and what records do not prove.
- Preserve accessible, mobile-ready operation in outdoor conditions.

## Accessibility & Inclusion

Use readable typography, high-contrast states, semantic structure, keyboard access, meaningful labels and errors, and touch targets suitable for outdoor phone use. Vietnamese and English must retain equivalent meaning and hierarchy.
