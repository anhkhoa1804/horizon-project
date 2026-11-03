# HORIZON Product Handbook

This directory is the source of truth for HORIZON (built on the original "Eco-Sense Cồn Hô" codebase — that name persists in some technical identifiers, e.g. npm workspace scopes, not renamed without a deliberate migration; see [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md)). It is written for engineers, designers, AI coding agents, judges, operators, and maintainers who need to understand both the product philosophy and the implementation rules.

HORIZON is not a generic IoT dashboard. It is a calm environmental intelligence platform for a real coastal farming community in Vietnam.

**For current architecture, station topology, deployment status, and whether GCP is required — start at [`ARCHITECTURE.md`](ARCHITECTURE.md).** For the deeper reasoning behind each decision, see [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) and [`ARCHITECTURE_DECISION_RECORD.md`](ARCHITECTURE_DECISION_RECORD.md). Several of the design docs below predate that architecture work and describe target-state design rather than verified current behavior.

Point-in-time phase reports (UI audits, redesign specs already executed, superseded architecture snapshots) have been moved to [`archive/`](archive/) to keep this handbook current — their conclusions are already folded into the documents below where still relevant.

## How to read this handbook

Read in this order when onboarding or asking an AI agent to build UI:

1. Understand the product and users.
2. Understand the UX direction.
3. Use tokens, components, page blueprints, interactions, copy, and empty states to implement without guessing.
4. Check accessibility, performance, architecture, authorization, API, pilot, and QA gates.

## Handbook map

| Document | Purpose |
|----------|---------|
| [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) | Vision, personas, positioning, emotional tone, and decision filter. |
| [`VISUAL_REFERENCES.md`](VISUAL_REFERENCES.md) | What HORIZON learns from Linear, Supabase, Windy, Our World in Data, Mobbin, and others. |
| [`VISUAL_LANGUAGE.md`](VISUAL_LANGUAGE.md) | Product-level visual direction for public and admin surfaces. |
| [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md) | Mobile-first UX principles, public/admin distinction, charts, motion, and state philosophy. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Design system governance and how tokens/components fit together. |
| [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) | Concrete spacing, typography, color, radius, elevation, motion, z-index, and breakpoint tokens. |
| [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md) | Implementation specs for MetricCard, charts, buttons, forms, dialogs, toasts, skeletons, and navigation — largely aspirational/historical against the current component set; see `COMPONENT_ARCHITECTURE.md` for what's actually built. |
| [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md) | Required page hierarchy and responsive layout for home, dashboard, station detail, report, login, admin, and offline pages. |
| [`INTERACTION_GUIDELINE.md`](INTERACTION_GUIDELINE.md) | Motion, hover, focus, loading, dialogs, drawers, skeletons, chart interactions, and reduced motion. |
| [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) | Vietnamese and English terminology, status wording, error wording, CTAs, and alert formulas. |
| [`EMPTY_STATES.md`](EMPTY_STATES.md) | Reusable empty, offline, no-data, permission, loading, slow-network, and fault states. |
| [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md) | WCAG AA, field usability, keyboard behavior, chart accessibility, data freshness, and performance. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **Start here.** The single short entry point: station topology (3-station pilot), whether GCP is required (no), data flow, domains, deployment status (current vs future), security boundaries. |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | The authoritative record of *why* the system is wired the way it is — canonical ingestion path, auth model, device auth, data model. |
| [`ARCHITECTURE_DECISION_RECORD.md`](ARCHITECTURE_DECISION_RECORD.md) | Fifteen settled decisions (source of truth per concept, what's built vs. deferred vs. removed) with citations. |
| [`FIRMWARE_BACKEND_CONTRACT.md`](FIRMWARE_BACKEND_CONTRACT.md) | Field-by-field wire contract between firmware, gateway, and the ingestion backend. |
| [`AUTH_ARCHITECTURE.md`](AUTH_ARCHITECTURE.md) | The two parallel auth systems (custom admin session vs. dormant Supabase Auth) and which one is actually live. |
| [`SENSOR_CAPABILITY_MATRIX.md`](SENSOR_CAPABILITY_MATRIX.md) | Per-metric trace from physical sensor through firmware, DB column, repository method, to frontend display. |
| [`TELEMETRY_STATE_MODEL.md`](TELEMETRY_STATE_MODEL.md) | The two-axis freshness/quality state model used across the UI. |
| [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md) | Prioritized (P0–P5) punch list of what remains before production. |
| [`EDGE_INGEST_READINESS.md`](EDGE_INGEST_READINESS.md) | Per-requirement READY/BLOCKED/NEEDS-LIVE-VERIFICATION assessment of deploying the ingestion Edge Function. |
| [`API_CONTRACTS.md`](API_CONTRACTS.md) | Telemetry ingestion contract for devices and backend services. |
| [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) | Public/admin/device access boundaries, roles, RLS expectations, and audit behavior. |
| [`COMPONENT_ARCHITECTURE.md`](COMPONENT_ARCHITECTURE.md) | Frontend primitive hierarchy and design-system deltas from the redesign pass. |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Delivery roadmap from product foundation to production showcase. |
| [`PILOT_BOOTSTRAP.md`](PILOT_BOOTSTRAP.md) | Field deployment checklist for station setup, QR pages, calibration, and pilot operations. |
| [`REDESIGN_SPECIFICATION.md`](REDESIGN_SPECIFICATION.md) | Design-system target spec (largely executed; see `COMPONENT_ARCHITECTURE.md` for what actually landed). |
| [`TECHNICAL_QA_CHECKLIST.md`](TECHNICAL_QA_CHECKLIST.md) | Release gates for UX, accessibility, data integrity, security, and field readiness. |
| [`UI_AUDIT_CHECKLIST.md`](UI_AUDIT_CHECKLIST.md) | Pre-commit UI checklist for hierarchy, spacing, components, states, accessibility, and responsive behavior. |
| [`VISUAL_DO_NOTS.md`](VISUAL_DO_NOTS.md) | Explicit anti-patterns that block noisy, generic, or inaccessible UI decisions. |
| [`UI_REVIEW_PLAYBOOK.md`](UI_REVIEW_PLAYBOOK.md) | Repeatable read-audit-implement-review workflow for humans and AI coding agents. |

## Non-negotiable product rules

- **Clarity above beauty:** if a user cannot immediately understand the environmental state, the design has failed.
- **Calm technology:** avoid noisy colors, flashing alerts, unnecessary animation, and decorative UI.
- **Trustworthy data:** environmental readings affect real-world decisions, so precision and consistency matter.
- **Mobile first:** design from 320px upward because farmers and visitors often use phones outdoors.
- **Accessible by default:** large targets, visible focus, semantic HTML, readable contrast, and simple language are required.
- **Performance is UX:** skeletons, caching, progressive rendering, and stable layouts are product features.

## Implementation workflow

Before adding or changing a feature:

1. Identify the primary persona in [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md).
2. Match the surface type in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md): public, QR station, report, or admin.
3. Choose the page structure from [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md).
4. Use component specs from [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md).
5. Use token values from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).
6. Use interactions from [`INTERACTION_GUIDELINE.md`](INTERACTION_GUIDELINE.md).
7. Use copy from [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) and empty states from [`EMPTY_STATES.md`](EMPTY_STATES.md).
8. Validate accessibility and performance with [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md).
9. Confirm architecture, authorization, API, pilot, and QA expectations before release.
10. Before commit or handoff, run [`UI_AUDIT_CHECKLIST.md`](UI_AUDIT_CHECKLIST.md), check [`VISUAL_DO_NOTS.md`](VISUAL_DO_NOTS.md), and follow [`UI_REVIEW_PLAYBOOK.md`](UI_REVIEW_PLAYBOOK.md).

If documentation and code disagree, pause and update one of them intentionally. Do not let the product philosophy drift silently.