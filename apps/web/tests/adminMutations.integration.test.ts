import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { loadAdminAllowedEmailEntries } from "@/lib/auth/adminAllowlist";
import { loadAlertConfigs, loadCalibrationRecords, loadMaintenanceLogs } from "@/lib/admin/operations";
import { loadSoilWaterModels, loadWaterLevelContexts } from "@/lib/monitoring/thresholds";
import { loadAdminCommunityReportRows } from "@/lib/admin/reports";
import {
  mutateAddAdminEmail, mutateRemoveAdminEmail, mutateMarkReportViewed, mutateSaveAlertConfig,
  mutateAddMaintenanceLog, mutateAddCalibrationRecord, mutateSaveSoilWaterModel,
  mutateSaveWaterLevelContext, mutateResolveReport,
  type AdminMutationActor, type AdminMutationResult,
} from "@/lib/admin/mutations";

const db = new PGlite();
const oldFetch = globalThis.fetch;
const oldUrl = process.env.SUPABASE_URL;
const oldPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const actor: AdminMutationActor = { id: "00000000-0000-4000-8000-000000000111", email: "operator@horizon.test" };
let failWriteTable: string | null = null;
let failAudit = false;

before(async () => {
  process.env.SUPABASE_URL = "http://admin-isolated.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://admin-isolated.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_isolated_test_only";
  await db.exec(`
    create table admin_allowed_emails(id uuid primary key default gen_random_uuid(), email text unique not null, note text, created_by uuid, active boolean not null default true, revoked_at timestamptz, created_at timestamptz not null default now());
    create table damage_logs(id text primary key, description text, status text not null, viewed_at timestamptz, viewed_by uuid, lat double precision, lng double precision, timestamp timestamptz default now());
    create table alert_configs(id uuid primary key default gen_random_uuid(), station_id text not null, metric text not null, comparison text not null, warning_threshold double precision, critical_threshold double precision, unit text, enabled boolean not null default true, note text, updated_by uuid, updated_at timestamptz not null default now(), unique(station_id,metric));
    create table maintenance_logs(id uuid primary key default gen_random_uuid(), station_id text not null, kind text not null, performed_at timestamptz not null default now(), operator text, note text, next_due_at timestamptz, created_at timestamptz not null default now());
    create table calibration_records(id uuid primary key default gen_random_uuid(), station_id text not null, sensor text not null, reference_value double precision, measured_value double precision, unit text, status text not null default 'recorded', performed_at timestamptz not null default now(), operator text, note text, created_at timestamptz not null default now());
    create table soil_water_models(station_id text primary key, field_capacity_pct double precision not null, permanent_wilting_point_pct double precision not null, management_allowed_depletion_pct double precision not null, irrigation_trigger_pct double precision, source_note text, updated_by uuid, updated_at timestamptz not null default now());
    create table water_level_contexts(station_id text primary key, sensor_datum_cm double precision, shore_bank_elevation_cm double precision, critical_infrastructure_elevation_cm double precision, survey_note text, validation_status text, updated_by uuid, updated_at timestamptz not null default now());
    create table audit_events(id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(), actor text, action text not null, entity text, entity_id text, metadata jsonb, created_at timestamptz not null default now());
    insert into damage_logs(id,description,status) values ('REPORT_01','field note','new');
    insert into admin_allowed_emails(email,active) values ('remove-me@horizon.test',true);
  `);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const table = url.pathname.split("/rest/v1/")[1];
    const method = request.method.toUpperCase();
    const fail = (message: string, status = 503) => new Response(JSON.stringify({ message, code: "ISOLATED_FAILURE" }), { status, headers: { "content-type": "application/json" } });
    if (!table) return fail("not found", 404);
    if (table === "audit_events" && failAudit && method === "POST") return fail("isolated audit unavailable");
    if (table === failWriteTable && ["POST", "PATCH"].includes(method)) return fail("isolated write unavailable");
    const safe = (value: string) => { if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("unsafe SQL identifier"); return `"${value}"`; };
    const filters = [...url.searchParams.entries()].filter(([key]) => !["select", "order", "limit", "on_conflict"].includes(key));
    const where = filters.map(([column, value], index) => {
      if (value.startsWith("eq.")) return `${safe(column)}=$${index + 1}`;
      if (value === "is.null") return `${safe(column)} is null`;
      throw new Error("unsupported isolated query filter");
    });
    const values = filters.flatMap(([, value]) => value.startsWith("eq.") ? [value.slice(3) === "true" ? true : value.slice(3) === "false" ? false : value.slice(3)] : []);
    try {
      if (method === "GET") {
        const select = (url.searchParams.get("select") ?? "*").split(",").map((column) => column === "*" ? "*" : safe(column)).join(",");
        const order = (url.searchParams.get("order") ?? "").split(",").filter(Boolean).map((segment) => {
          const [column, direction] = segment.split("."); return `${safe(column)} ${direction === "desc" ? "desc" : "asc"}`;
        });
        const limit = Number(url.searchParams.get("limit") ?? 1000);
        const result = await db.query(`select ${select} from ${safe(table)}${where.length ? ` where ${where.join(" and ")}` : ""}${order.length ? ` order by ${order.join(",")}` : ""} limit ${Math.max(0, Math.min(limit, 1000))}`, values);
        return Response.json(result.rows);
      }
      if (method === "POST") {
        const payload = await request.json() as Record<string, unknown>;
        const columns = Object.keys(payload);
        const sqlValues = Object.values(payload);
        const conflictColumns = url.searchParams.get("on_conflict")?.split(",") ?? [];
        const prefer = request.headers.get("prefer") ?? "";
        const conflict = conflictColumns.length && prefer.includes("resolution=merge-duplicates")
          ? ` on conflict (${conflictColumns.map(safe).join(",")}) do update set ${columns.filter((column) => !conflictColumns.includes(column)).map((column) => `${safe(column)}=excluded.${safe(column)}`).join(",")}`
          : "";
        const returning = request.headers.get("prefer")?.includes("return=representation") ? ` returning ${(url.searchParams.get("select") ?? "*").split(",").map(safe).join(",")}` : "";
        const result = await db.query(`insert into ${safe(table)} (${columns.map(safe).join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})${conflict}${returning}`, sqlValues);
        return new Response(JSON.stringify(result.rows), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (method === "PATCH") {
        const payload = await request.json() as Record<string, unknown>;
        const columns = Object.keys(payload);
        const set = columns.map((column, index) => `${safe(column)}=$${values.length + index + 1}`);
        const returning = request.headers.get("prefer")?.includes("return=representation") ? ` returning ${(url.searchParams.get("select") ?? "*").split(",").map(safe).join(",")}` : "";
        const result = await db.query(`update ${safe(table)} set ${set.join(",")}${where.length ? ` where ${where.join(" and ")}` : ""}${returning}`, [...values, ...Object.values(payload)]);
        return new Response(JSON.stringify(result.rows), { status: 200, headers: { "content-type": "application/json" } });
      }
      return fail("unsupported method", 405);
    } catch (error) {
      const code = (error as { code?: string }).code;
      return new Response(JSON.stringify({ message: "isolated database error", code }), { status: 400, headers: { "content-type": "application/json" } });
    }
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = oldFetch;
  if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
  if (oldPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldPublicUrl;
  if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  await db.close();
});

function form(values: Record<string, string>): FormData { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
interface Case { name: string; table: string; auditAction: string; action: (data: FormData) => Promise<AdminMutationResult>; data: () => FormData; readback: () => Promise<boolean>; seed?: () => Promise<void>; invalid?: () => Promise<void>; missing?: () => Promise<void>; }
const cases: Case[] = [
  { name: "addAdminEmail", table: "admin_allowed_emails", auditAction: "admin.allowlist.saved", action: (f) => mutateAddAdminEmail(f, actor), data: () => form({ email: "new-admin@horizon.test", note: "field operator" }), readback: async () => (await loadAdminAllowedEmailEntries()).some((row) => row.email === "new-admin@horizon.test") },
  { name: "removeAdminEmail", table: "admin_allowed_emails", auditAction: "admin.allowlist.revoked", action: (f) => mutateRemoveAdminEmail(f, actor), data: () => form({ email: "remove-me@horizon.test" }), readback: async () => !(await loadAdminAllowedEmailEntries()).some((row) => row.email === "remove-me@horizon.test"), seed: async () => { await db.exec("update admin_allowed_emails set active=true,revoked_at=null where email='remove-me@horizon.test'"); }, missing: async () => { await db.exec("update admin_allowed_emails set active=false where email='remove-me@horizon.test'"); } },
  { name: "markReportViewed", table: "damage_logs", auditAction: "report.viewed", action: (f) => mutateMarkReportViewed(f, actor), data: () => form({ report_id: "REPORT_01" }), readback: async () => { const row = (await loadAdminCommunityReportRows()).find((report) => report.id === "REPORT_01"); return row?.status === "reviewing" && Boolean(row.viewed_at); }, missing: async () => { await db.exec("delete from damage_logs where id='REPORT_01'"); } },
  { name: "saveAlertConfig", table: "alert_configs", auditAction: "alert.config.saved", action: (f) => mutateSaveAlertConfig(f, actor), data: () => form({ station_id: "STATION_01", metric: "water_ec", comparison: "above", warning_threshold: "2.5", critical_threshold: "4", unit: "mS/cm", enabled: "on", note: "pilot" }), readback: async () => (await loadAlertConfigs()).some((row) => row.station_id === "STATION_01" && row.metric === "water_ec" && row.warning_threshold === 2.5), invalid: async () => { const bad = await mutateSaveAlertConfig(form({ station_id: "STATION_01", metric: "water_ec", comparison: "above", warning_threshold: "NaN", critical_threshold: "4" }), actor); assert.equal(bad, "invalid_input"); } },
  { name: "addMaintenanceLog", table: "maintenance_logs", auditAction: "maintenance.recorded", action: (f) => mutateAddMaintenanceLog(f, actor), data: () => form({ station_id: "STATION_01", kind: "inspection", operator: "field operator", note: "checked enclosure" }), readback: async () => (await loadMaintenanceLogs()).some((row) => row.station_id === "STATION_01" && row.kind === "inspection") },
  { name: "addCalibrationRecord", table: "calibration_records", auditAction: "calibration.recorded", action: (f) => mutateAddCalibrationRecord(f, actor), data: () => form({ station_id: "STATION_02", sensor: "soil_ec", reference_value: "0.8", measured_value: "0.82", unit: "mS/cm" }), readback: async () => (await loadCalibrationRecords()).some((row) => row.station_id === "STATION_02" && row.sensor === "soil_ec"), invalid: async () => { const bad = await mutateAddCalibrationRecord(form({ station_id: "STATION_02", sensor: "soil_ec", reference_value: "Infinity", measured_value: "0.82" }), actor); assert.equal(bad, "invalid_input"); } },
  { name: "saveSoilWaterModel", table: "soil_water_models", auditAction: "site.soil_water_model.saved", action: (f) => mutateSaveSoilWaterModel(f, actor), data: () => form({ field_capacity_pct: "42", permanent_wilting_point_pct: "18", management_allowed_depletion_pct: "35", source_note: "field sample" }), readback: async () => (await loadSoilWaterModels()).some((row) => row.station_id === "STATION_02" && row.field_capacity_pct === 42), invalid: async () => { const bad = await mutateSaveSoilWaterModel(form({ field_capacity_pct: "18", permanent_wilting_point_pct: "42", management_allowed_depletion_pct: "35" }), actor); assert.equal(bad, "invalid_input"); } },
  { name: "saveWaterLevelContext", table: "water_level_contexts", auditAction: "site.water_level_context.saved", action: (f) => mutateSaveWaterLevelContext(f, actor), data: () => form({ sensor_datum_cm: "350", shore_bank_elevation_cm: "280", critical_infrastructure_elevation_cm: "410", survey_note: "pilot datum" }), readback: async () => (await loadWaterLevelContexts()).some((row) => row.station_id === "STATION_01" && row.sensor_datum_cm === 350), invalid: async () => { const bad = await mutateSaveWaterLevelContext(form({ sensor_datum_cm: "NaN", shore_bank_elevation_cm: "280", critical_infrastructure_elevation_cm: "410" }), actor); assert.equal(bad, "invalid_input"); } },
  { name: "resolveReport", table: "damage_logs", auditAction: "report.resolved", action: (f) => mutateResolveReport(f, actor), data: () => form({ report_id: "REPORT_01" }), readback: async () => (await loadAdminCommunityReportRows()).find((report) => report.id === "REPORT_01")?.status === "resolved", missing: async () => { await db.exec("delete from damage_logs where id='REPORT_01'"); } },
];

async function prepare(item: Case) {
  await db.exec("delete from audit_events");
  await db.exec(`delete from ${item.table}`);
  if (item.table === "damage_logs") await db.exec("insert into damage_logs(id,description,status) values ('REPORT_01','field note','new')");
  if (item.name === "removeAdminEmail") await db.exec("insert into admin_allowed_emails(email,active) values ('remove-me@horizon.test',true)");
}
for (const item of cases) {
  test(`${item.name}: isolated persistence, audit, failure, validation, and Admin readback`, async () => {
    await prepare(item);
    assert.equal(await item.action(item.data()), "saved");
    assert.ok((await db.query(`select * from ${item.table}`)).rows.length > 0, "expected database row");
    assert.equal((await db.query("select action from audit_events where action=$1", [item.auditAction])).rows.length, 1, "expected audit row");
    assert.equal(await item.readback(), true, "actual Admin readback must reflect saved state");

    await prepare(item);
    failWriteTable = item.table;
    assert.equal(await item.action(item.data()), "write_failed");
    failWriteTable = null;
    assert.equal((await db.query("select * from audit_events where action=$1", [item.auditAction])).rows.length, 0, "write failure cannot create success audit");

    await prepare(item);
    failAudit = true;
    assert.equal(await item.action(item.data()), "audit_failed");
    failAudit = false;
    assert.equal(await item.readback(), true, "non-transactional mutation remains saved when audit fails");
    assert.equal((await db.query("select * from audit_events where action=$1", [item.auditAction])).rows.length, 0);

    if (item.missing) {
      await prepare(item);
      await item.missing();
      assert.equal(await item.action(item.data()), "not_found");
      assert.equal((await db.query("select * from audit_events where action=$1", [item.auditAction])).rows.length, 0);
    }
    if (item.invalid) {
      await prepare(item);
      const beforeCount = (await db.query(`select * from ${item.table}`)).rows.length;
      await item.invalid();
      assert.equal((await db.query(`select * from ${item.table}`)).rows.length, beforeCount, "invalid numeric input must not write");
      assert.equal((await db.query("select * from audit_events")).rows.length, 0);
    }
  });
}
