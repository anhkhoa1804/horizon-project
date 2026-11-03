import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateRuntimeSettings, sameRuntimeSettings, runtimeStorageState, RUNTIME_HARDWARE_LIMITATION } from "../lib/gateway/runtimeConfig";
import { authorizeGatewayRequest } from "../lib/gateway/ingestAuth";
const desired = { station_id: "STATION_01", sample_interval_seconds: 60, sleep_interval_seconds: 60, mode: "normal" };
test("runtime intent rejects invalid intervals and unmanaged devices", () => {
  assert.ok(validateRuntimeSettings(desired));
  for (const sample of [NaN, Infinity, 0, 4, 86401, 60.5]) assert.equal(validateRuntimeSettings({ ...desired, sample_interval_seconds: sample }), false);
  for (const sleep of [-1, NaN, 86401, 0.5]) assert.equal(validateRuntimeSettings({ ...desired, sleep_interval_seconds: sleep }), false);
  assert.equal(validateRuntimeSettings({ ...desired, station_id: "OTHER" }), false);
  assert.equal(validateRuntimeSettings({ ...desired, mode: "force" }), false);
  assert.ok(validateRuntimeSettings({ ...desired, sleep_interval_seconds: 0 }));
});
test("identical submissions are idempotent and stored state is never applied state", () => {
  assert.ok(sameRuntimeSettings(desired, { ...desired }));
  assert.equal(sameRuntimeSettings(desired, { ...desired, sleep_interval_seconds: 120 }), false);
  assert.equal(runtimeStorageState(), "UNSET");
  assert.equal(runtimeStorageState("2026-10-06T00:00:00Z"), "STORED");
  assert.equal(RUNTIME_HARDWARE_LIMITATION.application_verified, false);
  assert.equal(RUNTIME_HARDWARE_LIMITATION.acknowledgement_supported, true);
});
test("gateway read authentication fails closed", () => {
  assert.equal(authorizeGatewayRequest(null, undefined), "not_configured");
  assert.equal(authorizeGatewayRequest(null, "test-only"), "unauthorized");
  assert.equal(authorizeGatewayRequest("wrong", "test-only"), "unauthorized");
  assert.equal(authorizeGatewayRequest("test-only", "test-only"), "ok");
});
test("raw inserts project to public realtime without granting raw relay access", () => {
  const migration = fs.readFileSync(path.resolve("../../infra/supabase/migrations/033_public_observatory_realtime.sql"), "utf8");
  assert.match(migration, /after insert or update on public\.environmental_readings/);
  assert.match(migration, /after insert or update on public\.soil_readings/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /alter publication supabase_realtime add table public\.observatory_live_readings/);
  const hook = fs.readFileSync(path.resolve("components/monitoring/use-live-observatory.ts"), "utf8");
  assert.match(hook, /postgres_changes/);
  assert.ok(!hook.includes("router.refresh") && !hook.includes("window.location.reload"));
  assert.ok(!hook.includes("SERVICE_ROLE"));
});
