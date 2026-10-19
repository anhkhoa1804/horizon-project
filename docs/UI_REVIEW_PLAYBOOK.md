# UI Review Playbook

## Purpose

This playbook defines the workflow for improving Eco-Sense UI without drifting away from the handbook. Use it for human reviews, AI coding agent sessions, and pre-PR checks.

The workflow is:

```text
Read docs
↓
Audit implementation
↓
Prioritize by user impact
↓
Implement one phase
↓
Run checks
↓
Self-review brutally
↓
Fix next phase
↓
Visual review
↓
Stop when quality bar is met
```

## Ground rules

- Do not expand documentation during implementation unless a gap blocks work.
- Do not redesign outside the documented system.
- Do not introduce dependencies for visual polish unless unavoidable.
- Do not change business logic while doing visual work unless required by the documented UI state.
- Do not break authentication, authorization, telemetry, or API contracts.
- Do not claim completion without running available checks.

## Phase 0 — Read the handbook

Run:

```bash
git status
find docs -name "*.md" | sort
find docs -type f | sort
```

Then read every Markdown file under `docs/`.

Build internal understanding of:

- product philosophy,
- visual language,
- design references,
- UX principles,
- design tokens,
- component specifications,
- page blueprints,
- interaction guidelines,
- copywriting rules,
- empty states,
- accessibility and performance,
- architecture constraints,
- authorization boundaries,
- API contracts,
- pilot readiness,
- QA checklist,
- visual do-nots.

Do not summarize first. Understand before auditing.

## Phase 1 — Audit implementation

Inspect:

- `apps/web/`,
- `services/`,
- shared components,
- route structure,
- loading and empty states,
- auth and admin boundaries,
- chart implementation,
- responsive behavior,
- accessibility behavior.

Compare implementation against every document in `docs/`.

For every issue, record:

- severity,
- affected page or component,
- current behavior,
- expected behavior,
- reference document,
- concrete implementation suggestion,
- estimated complexity.

Severity scale:

| Severity | Meaning |
|----------|---------|
| `S0` | Breaks trust, safety, auth, or core environmental interpretation. |
| `S1` | Major UX/accessibility issue for farmer, public station, report, or admin triage. |
| `S2` | Noticeable inconsistency that weakens product quality. |
| `S3` | Polish issue with low user impact. |

Prioritize by user impact, not implementation ease.

## Phase 2 — Build implementation roadmap

Group issues into phases.

Recommended ordering:

1. Public station clarity and data trust.
2. Mobile report usability.
3. Public dashboard hierarchy and status sorting.
4. Admin triage and table usability.
5. Loading, empty, offline, and fault states.
6. Token and component consistency.
7. Motion and polish.

Each phase should be small enough to implement and verify safely.

## Phase 3 — Implement one phase only

Before coding:

- state the phase scope,
- list files likely to change,
- confirm no unrelated refactor is planned.

During coding:

- use documented tokens,
- use documented components,
- preserve business logic,
- preserve authentication flows,
- preserve API contracts,
- keep changes focused.

Do not fix unrelated issues from later phases.

## Phase 4 — Run checks

Run the project’s available checks. If this is a Node app, prefer:

```bash
npm run check
npm run build
```

If commands differ, inspect `package.json` and use the equivalent typecheck, lint, test, and build commands.

Fix errors caused by the current phase. Do not fix unrelated historical failures unless they block validation and are clearly documented.

## Phase 5 — Self-review brutally

After implementation, review as if another developer submitted it.

Ignore your intent. Inspect the result against:

- [`UI_AUDIT_CHECKLIST.md`](UI_AUDIT_CHECKLIST.md),
- [`VISUAL_DO_NOTS.md`](VISUAL_DO_NOTS.md),
- [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md),
- [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md),
- [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md),
- [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md),
- [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md).

Find:

- layout inconsistencies,
- spacing inconsistencies,
- typography inconsistencies,
- component inconsistencies,
- responsive bugs,
- interaction bugs,
- animation problems,
- loading state issues,
- accessibility issues,
- copy issues,
- stale/fault data trust issues.

Do not fix during review. Produce a prioritized list.

## Phase 6 — Implement review fixes

Implement only the highest-impact issues discovered in self-review.

Rules:

- no unrelated refactors,
- no new design direction,
- no undocumented visual invention,
- run checks again,
- stop after the agreed scope.

## Phase 7 — Visual review with screenshots

When the app can run locally or through a preview URL, review visually.

Review pages:

- `/`,
- `/dashboard`,
- `/s/[stationId]`,
- `/report`,
- `/admin/login`,
- `/admin`,
- key admin detail pages if implemented,
- offline and empty states if reachable.

Evaluate:

- visual quality,
- spacing,
- alignment,
- hierarchy,
- typography,
- color usage,
- contrast,
- accessibility,
- responsive layout,
- animation,
- dashboard usability,
- farmer usability,
- tourist usability,
- admin usability.

Compare against the project’s own docs first, then against reference quality from Linear, Supabase Dashboard, Stripe, Vercel, Windy, Our World in Data, Apple Weather, and GitHub.

Do not compare against generic websites.

## Phase 8 — Stop condition

Stop when:

- S0 and S1 issues are resolved or explicitly documented as out of scope,
- public station page communicates state within seconds,
- stale/fault data is clearly represented,
- mobile report flow is usable,
- admin triage is clear,
- documented tokens and components are followed,
- checks pass,
- remaining issues are ranked for later phases.

## Required final report

Every implementation phase should end with:

- summary of changes,
- files changed,
- docs followed,
- validation commands run,
- remaining known issues,
- recommended next phase.