// Edge-ingest integration against the ISOLATED local stack: the real Edge Function -> real PostgREST -> real Postgres
// (including migration 033 projection and 035 mirror triggers). Loopback only. Synthetic device payloads.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(path.join(here, "../../infra/supabase/local-stack/.env.local-stack"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
if (!["127.0.0.1", "localhost"].includes(new URL(API).hostname)) throw new Error("refusing non-loopback target");
const db = new pg.Client({ connectionString: `postgres://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:54322/postgres` });
await db.connect();
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}`); } catch (e) { const m = String(e.message ?? e); results.push({ name, ok: false, error: m }); console.log(`FAIL  ${name}\n      ${m.split("\n")[0]}`); } }

const run = Date.now().toString(36);
let n = 0;
const base = (over = {}) => ({ contract_version: "v1", reading_kind: "water", device_id: "STATION_01", message_id: `e2e-${run}-${++n}`, timestamp: Math.floor(Date.now() / 1000), water_level: 278.7, distance_cm: 71.3, fault_flags: 0, sensor_status: { ec_probe: "ok", ultrasonic: "ok" }, firmware_version: "e2e", ...over });
async function post(payload, { token = env.GATEWAY_INGEST_TOKEN, contract = "v1" } = {}) {
  const res = await fetch(`${API}/functions/v1/edge-ingest`, { method: "POST", headers: { "content-type": "application/json", "x-gateway-token": token, "x-contract-version": contract }, body: JSON.stringify(payload) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const row = async (id) => (await db.query("select salinity, ec_ms_cm, water_ec_ms_cm, temperature_c, water_temp_c, water_level, ec_probe_status from public.environmental_readings where message_id=$1", [id])).rows[0];

await check("valid full water reading is stored; 035 trigger mirrors EC/temperature to the public columns", async () => {
  const p = base({ salinity: 0.42, ec_ms_cm: 1.1, temperature_c: 28.5 });
  const r = await post(p); assert.equal(r.status, 200, JSON.stringify(r.body));
  const x = await row(p.message_id);
  assert.equal(Number(x.salinity), 0.42); assert.equal(Number(x.ec_ms_cm), 1.1);
  assert.equal(Number(x.water_ec_ms_cm), 1.1, "water_ec_ms_cm must be mirrored (I-18)");
  assert.equal(Number(x.water_temp_c), 28.5);
});
await check("MISSING salinity (failed probe read) is stored as NULL — never 0, never derived from EC (I-22 ingest side)", async () => {
  const p = base({ ec_ms_cm: 2.5, temperature_c: 29.0, fault_flags: 1, sensor_status: { ec_probe: "fault", ultrasonic: "ok" } });
  const r = await post(p); assert.equal(r.status, 200, JSON.stringify(r.body));
  const x = await row(p.message_id);
  assert.equal(x.salinity, null, "missing salinity must be NULL");
  assert.notEqual(Number(x.salinity), Number(2.5) * 0.64);
});
await check("a genuine zero salinity is preserved as 0 (zero is not missing)", async () => {
  const p = base({ salinity: 0, ec_ms_cm: 0.05, temperature_c: 27.0 });
  const r = await post(p); assert.equal(r.status, 200);
  assert.equal(Number((await row(p.message_id)).salinity), 0);
});
await check("all-EC-missing partial reading (ultrasonic only) accepted with NULL EC/temperature", async () => {
  const p = base({ fault_flags: 1, sensor_status: { ec_probe: "fault", ultrasonic: "ok" } });
  const r = await post(p); assert.equal(r.status, 200);
  const x = await row(p.message_id);
  assert.equal(x.ec_ms_cm, null); assert.equal(x.water_ec_ms_cm, null); assert.equal(Number(x.water_level), 278.7);
});
await check("duplicate message_id is idempotent (one row)", async () => {
  const p = base({ salinity: 0.1 });
  assert.equal((await post(p)).status, 200); await post(p);
  assert.equal((await db.query("select count(*)::int c from public.environmental_readings where message_id=$1", [p.message_id])).rows[0].c, 1);
});
await check("wrong gateway token is refused (401/403) and nothing is stored", async () => {
  const p = base({ salinity: 0.3 });
  const r = await post(p, { token: "wrong-token" });
  assert.ok([401, 403].includes(r.status), `status ${r.status}`);
  assert.equal(await row(p.message_id), undefined);
});
await check("unknown / unregistered device is refused", async () => {
  const p = base({ device_id: "STATION_99", salinity: 0.3 });
  const r = await post(p); assert.ok(r.status >= 400); assert.equal(await row(p.message_id), undefined);
});
await check("timestamp outside the drift window is refused", async () => {
  const p = base({ timestamp: Math.floor(Date.now() / 1000) - 3600, salinity: 0.3 });
  const r = await post(p); assert.ok(r.status >= 400, `status ${r.status}`); assert.equal(await row(p.message_id), undefined);
});
await check("out-of-range salinity (60) is refused, not clamped", async () => {
  const p = base({ salinity: 60 }); const r = await post(p); assert.ok(r.status >= 400); assert.equal(await row(p.message_id), undefined);
});
await check("contract version mismatch (header v2) is refused", async () => {
  const p = base({ salinity: 0.3 }); const r = await post(p, { contract: "v2" }); assert.ok(r.status >= 400); assert.equal(await row(p.message_id), undefined);
});
await check("soil reading for STATION_02 stored in soil_readings; air/soil NULLs stay NULL", async () => {
  const p = base({ reading_kind: "soil", device_id: "STATION_02", salinity: undefined, water_level: undefined, distance_cm: undefined, sensor_status: undefined, soil: { air_temp_c: null, air_humidity_pct: null, soil_temp_c: 27.2, soil_moisture_pct: 31.5, soil_ec_ms_cm: null, soil_ph: null } });
  const r = await post(p); assert.equal(r.status, 200, JSON.stringify(r.body));
  const x = (await db.query("select soil_moisture_pct, soil_ec_ms_cm, soil_ph from public.soil_readings where message_id=$1", [p.message_id])).rows[0];
  assert.equal(Number(x.soil_moisture_pct), 31.5); assert.equal(x.soil_ec_ms_cm, null); assert.equal(x.soil_ph, null);
});
await check("public Observatory projection shows the newest reading only and exposes only public columns to anon", async () => {
  const p = base({ salinity: 0.77, ec_ms_cm: 3.3, temperature_c: 30.5, timestamp: Math.floor(Date.now() / 1000) });
  assert.equal((await post(p)).status, 200);
  const res = await fetch(`${API}/rest/v1/observatory_live_readings?select=*&station_id=eq.STATION_01`, { headers: { apikey: env.ANON_KEY, authorization: `Bearer ${env.ANON_KEY}` } });
  const j = await res.json(); assert.equal(res.status, 200, JSON.stringify(j));
  assert.equal(j.length, 1);
  const m = j[0].measurements ?? j[0];
  assert.equal(Number(m.water_ec_ms_cm), 3.3); assert.equal(Number(m.salinity), 0.77);
  const raw = await fetch(`${API}/rest/v1/environmental_readings?select=ec_ms_cm&limit=1`, { headers: { apikey: env.ANON_KEY, authorization: `Bearer ${env.ANON_KEY}` } });
  assert.ok(raw.status >= 400, "anon must not read the private ec_ms_cm column");
});

await db.end();
const failed = results.filter((r) => !r.ok);
writeFileSync(path.join(here, "edge-ingest.e2e.result.json"), JSON.stringify({ at: new Date().toISOString(), target: API, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
