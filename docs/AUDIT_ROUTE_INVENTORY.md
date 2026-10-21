# HORIZON — architecture and route inventory

**Audit date:** 19 October 2026  
**Baseline:** commit `b591c02510d2b81146666c5a49660ad4846f6838` **plus an uncommitted working tree** (20 modified and ~10 untracked files already present when the audit began — admin mutations, freshness truth, credential contract, hardware gate). Everything below describes that working tree, not the bare commit.

How this was produced: reading source. The application was **not run** in the audit environment (see [AUDIT_ISSUES.md](AUDIT_ISSUES.md#audit-limits)), so "behaviour" statements are from code and from the test suites listed in the flow matrix, not from clicking through a running site.

## 1. Runtime topology

```
ESP32 station ──LoRa──▶ ESP32 gateway ──4G──▶  Supabase Edge Function `edge-ingest`  ─▶ Postgres
 (S1 water, S2 soil)    (GATEWAY_01)      └──▶  Next.js  /api/public/gateway/configs   (remote config)
                                                             │
Browser ──────────────▶ Next.js 15 (Vercel) ─────────────────┤  anon client (RLS) for public reads
   │                    apps/web                             └─ service-role client, server only
   └── direct PUT ───▶ Supabase Storage `report-evidence` (signed upload URL, new in this audit)
```

- Hosting: Vercel (`apps/web/vercel.json`, `docs/PRODUCTION_READINESS.md`). This matters for report media: Vercel rejects function request bodies above **4.5 MB**.
- Admin auth: custom. `ADMIN_PASSWORD` shared secret + `ADMIN_SESSION_SECRET` HMAC-signed cookie (12 h) + email allowlist (`ADMIN_ALLOWED_EMAILS` and table `admin_allowed_emails`). **Not** Supabase Auth.
- Station identity: `STATION_01` water, `STATION_02` soil/air, `STATION_03` = public/inventory name of `GATEWAY_01`. No `STATION_04/05` exists in seed, simulator or UI.

## 2. Page routes

| Route | Type | Auth | Notes |
|---|---|---|---|
| `/` | server, ISR 60 s | public | Eleven numbered chapters; Field Notes carousel at `#ghi-chep`; contact at `#lien-he` |
| `/dashboard` | server, ISR 60 s | public | The Observatory (`#observatory`). `?mode=demo` is the only way to see demo data |
| `/observe` | 308 redirect | public | Printed-QR destination → `/dashboard#observatory`. Must never change |
| `/s/:stationId` | 307 redirect | public | Same destination, keeps hash |
| `/about` | 307 redirect | public | Folded into `/` |
| `/report` | server + client form | public, no login | Community report. `?station=` presets a station, `?mode=demo` allowed outside production only |
| `/posts/[slug]` | static (6 params) | public | Markdown from `content/posts/*.md`, rendered by `lib/content/markdown.ts` |
| `/offline` | static | public | PWA fallback |
| `/admin/login` | server + server action | public | Password + allowlisted email |
| `/admin` | server, dynamic | admin | One long page, ten anchored sections |
| `/admin/export` | route handler (GET) | admin | CSV, ≤ 5 000 rows, audited |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image` | metadata routes | public | Sitemap lists `/`, `/dashboard`, `/report`, every post |

## 3. API routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | public, `no-store` | Build id and dependency readiness |
| `/api/public/reports` | POST | public, throttled (5 / h / client, durable if migration 021 applied) | Create a report. **JSON** (evidence declared, not carried) — multipart still accepted for small files |
| `/api/public/reports/[id]/media` | POST | **upload ticket** (HMAC, 2 h, bound to report + paths) | `finalize` (record what is really in Storage) / `resign` (retry URLs). New in this audit |
| `/api/public/weather`, `/weather/history` | GET | public | External Open-Meteo context; labelled as not HORIZON measurement |
| `/api/public/gateway/configs` | GET | `GATEWAY_INGEST_TOKEN` | Gateway pulls desired station config; fails closed with 503 when unset |
| `/api/public/gateway/configs/events` | POST | gateway token | Config lifecycle receipts (ACK / APPLIED / REJECTED …) |

`middleware.ts` runs on every non-asset path but only gates `/admin*` (except `/admin/login`) and only checks that a cookie *looks* signed — it cannot verify the HMAC in the Edge runtime. The authoritative check is `getSessionContext()` → `requireAdmin()` at the top of the page and of **every** server action, and in `/admin/export`.

## 4. Admin server actions and what each writes

All go through `requireAdmin()` then a function in `lib/admin/mutations.ts` that writes the row **and** an `audit_events` row (`runAuditedAdminWrite`). A save whose audit write fails is reported as `admin-audit-failed`, not as success.

| Action | Table | Audit action |
|---|---|---|
| addAdminEmail / removeAdminEmail | `admin_allowed_emails` | `admin.allowlist.saved` / `.revoked` |
| markReportViewed | `damage_logs` (`viewed_at`, `status=reviewing`) | `report.viewed` |
| **resolveReport** | `damage_logs` (`status=resolved`) | `report.resolved` — *had no button before this audit* |
| saveAlertConfig | `alert_configs` | `alert.config.saved` — stored intent, not an active alert engine |
| addMaintenanceLog / addCalibrationRecord | `maintenance_logs` / `calibration_records` | `maintenance.recorded` / `calibration.recorded` |
| saveSoilWaterModel / saveWaterLevelContext | `soil_water_models` / `water_level_contexts` | `site.*.saved` |
| updateRuntimeConfig | `device_runtime_configs` via `store_remote_config` RPC | config lifecycle; state is `STORED` until a station attests `APPLIED`. `CONFIG_POLL_ENABLED=false`, so nothing reaches hardware |

## 5. Data model touched by the audited journeys

| Table / bucket | Written by | Read by |
|---|---|---|
| `damage_logs` | `/api/public/reports` (service role) | Admin report queue |
| `report_media` | `/api/public/reports/[id]/media` finalize (only for objects seen in Storage) | Admin report queue (signed URL, 30 min) |
| bucket `report-evidence` (private, 20 MB, MIME allow-list) | browser, via server-signed upload URL | Admin only |
| `environmental_readings` / `soil_readings` | `edge-ingest` | Observatory, CSV export |
| `audit_events` | every admin write, every export | Admin audit panel |

## 6. Where documentation and source disagreed

| Document says | Source says | Action |
|---|---|---|
| `README.md`: "27 tracked migrations" | 36 files in `infra/supabase/migrations` (duplicate prefixes 024 and 025 are historical); `ADMIN_DATA_FLOW_AUDIT.md` counts 37 recorded in production | Not edited (README is a front door; migration ledger is the source). Listed in issues |
| `lib/content/posts.ts` header: bodies "not rendered anywhere yet", "no Markdown renderer" | `/posts/[slug]` renders every body via `renderMarkdown` | Comment corrected |
| `docs/CURRENT_PRODUCT_STATUS.md` "Report media validation and private, signed-URL delivery" | True for delivery; but upload path could not carry videos on Vercel | Status doc updated |
| Admin `resolveReport` action present, status `resolved` allowed by `damage_logs` CHECK | No UI invoked it | Button added |
| Admin export column lists | Named `soil_ec`, and air temp/humidity on the water table — neither exists in the schema | Lists corrected, regression test added |
| Homepage station card for STATION_01 listed only "Độ mặn" | Sensor matrix: EC, water temperature, level and salinity are separate fields; EC ≠ salinity | Card now lists the four fields |

Checked and found **consistent** with source: `AUTH_ARCHITECTURE.md` and `AUTHORIZATION_MODEL.md` correctly state that the custom password + signed-cookie session is the live admin mechanism and that Supabase Auth scaffolding is dormant.
