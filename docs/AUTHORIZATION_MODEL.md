# Authorization Model

**Current implementation state — read this before the rest of the doc.**
Everything below this section is written in "should"/"recommended" language
because it mixes what's live today with the target model. Full reasoning:
[`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) §2.

| Role in the table below | Status |
|---|---|
| `public` | **Implemented.** Anon-key Supabase client + RLS (migration 018) — not service-role. |
| `admin` | **Implemented**, but via a custom password-based session (`lib/auth/localAdminSession.ts`), not Supabase Auth. A single shared operator account, not per-user. Backed by service-role for privileged operations. |
| `operator`, `researcher` | **Not implemented.** No code path constructs these roles. Aspirational. |
| `service` | **Implemented** as "service-role, server-only" — used by admin operations and ingestion, never reachable from the browser. |
| Farmer / station-scoped human access | **Designed, not built.** `station_assignments` and `has_station_access()` are correct and ready in the database; there is no sign-up/login UI and no session layer that would populate `auth.uid()` for a real farmer. See `ARCHITECTURE_DECISIONS.md` §2 for the intended shape when this is built. |
| Device ingestion auth | **Implemented** — `GATEWAY_01` token relay only, see `API_CONTRACTS.md`. |

## Purpose

HORIZON separates public environmental transparency from privileged operations. Public users should be able to understand station status without login, while administrators need protected access to station management, thresholds, reports, and audit history.

## Access principles

- Public pages may read approved environmental summaries and station status.
- Public pages must never expose secrets, private user data, privileged audit detail, or admin controls.
- Device ingestion is authenticated through the configured gateway token and validation controls, not user sessions.
- Admin pages require authenticated users with explicit roles.
- Database Row Level Security should enforce data boundaries even if application code has a bug.
- Sensitive actions should be logged.

## Roles

Recommended roles:

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `public` | Anonymous community and QR visitors. | Read public station summaries, charts, and submit community reports. |
| `operator` | Field or community operator. | Review reports, monitor assigned stations, acknowledge alerts. |
| `admin` | System administrator. | Manage stations, devices, thresholds, users, and reports. |
| `researcher` | Research or NGO partner. | Read approved datasets and station history without operational controls. |
| `service` | Backend service role. | Perform ingestion, maintenance, and privileged server-side actions only. |

The exact role names may differ in implementation, but these capability boundaries should remain.

## Public access

Public users may access:

- homepage,
- project overview,
- dashboard summary,
- station QR page,
- public charts,
- community report submission,
- public educational explanations.

Public users must not access:

- device secrets,
- raw telemetry payloads or gateway credentials,
- internal operator notes,
- private user identities,
- threshold edit controls,
- station provisioning tools,
- audit logs containing sensitive data.

## Admin access

Authenticated admins may access:

- station and device inventory,
- ingestion health,
- alert lists,
- threshold configuration,
- report triage,
- maintenance state,
- audit logs,
- deployment checks.

Admin actions should use clear confirmation for destructive or high-impact changes, especially threshold edits and device deactivation.

## Device ingestion access

The pilot gateway authenticates with:

- active device registration,
- `x-gateway-token` and `x-contract-version: v1`,
- timestamp drift checks,
- replay protection,
- idempotent message IDs.

Device authentication must not depend on browser user sessions.

## Row Level Security expectations

Supabase RLS should be designed so that:

- anonymous clients can only read public-safe views or rows,
- anonymous clients can submit reports through constrained insert policies,
- authenticated operators only access permitted operational data,
- admins have broader access through explicit role checks,
- service role bypass is used only server-side,
- secrets remain inaccessible to client roles.

Prefer public database views or RPC functions that shape data for the UI instead of exposing raw tables broadly.

## Community reports

Community reporting should be easy, but protected from abuse.

Recommended behavior:

- allow anonymous submissions with rate limiting or abuse controls,
- validate text and attachments,
- store submission time and station context when available,
- mark reports as pending until reviewed,
- avoid exposing reporter private information publicly,
- preserve drafts offline when possible.

## Audit behavior

Audit logs should capture:

- device ingestion decisions,
- rejected telemetry reasons,
- threshold changes,
- device activation or deactivation,
- admin role changes,
- report status changes,
- alert acknowledgments.

Audit logs should be precise and calm. They exist to support trust and operations, not to create noisy UI.

## Authorization checklist

Before shipping a feature, confirm:

- the persona and role are defined,
- public and admin behavior are separated,
- RLS protects the data path,
- secrets are never exposed to the browser,
- unauthorized states are handled clearly,
- sensitive changes are audited,
- error messages do not leak implementation details.
