import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TelemetryPayloadV1 } from "../src/types.js";
import { hasLiveSupabaseEnv, loadSupabaseEnv } from "./testEnv.js";

const env = loadSupabaseEnv();
const live = hasLiveSupabaseEnv(env) && Boolean(env.GATEWAY_INGEST_TOKEN);

function basePayload(messageId: string, timestamp: number): TelemetryPayloadV1 {
  return {
    contract_version: "v1",
    device_id: "STATION_01",
    message_id: messageId,
    timestamp,
    salinity: 1.05,
    water_level: 51,
    fault_flags: 0,
    sensor_status: { ec_probe: "ok", ultrasonic: "ok" },
    battery_voltage: 3.91,
    signal_strength_dbm: -84,
    firmware_version: "1.0.2",
  };
}

async function postToEdge(payload: TelemetryPayloadV1) {
  const response = await fetch(env.EDGE_INGEST_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contract-version": payload.contract_version,
      "x-gateway-token": env.GATEWAY_INGEST_TOKEN!,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function countReadings(messageId: string): Promise<number> {
  const url = `${env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/environmental_readings?message_id=eq.${encodeURIComponent(messageId)}&select=message_id`;
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const range = response.headers.get("content-range");
  if (!range) {
    const rows = await response.json();
    return Array.isArray(rows) ? rows.length : 0;
  }
  const total = range.split("/")[1];
  return total ? Number(total) : 0;
}

async function latestAuditStatus(messageId: string): Promise<string | null> {
  const url = `${env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/ingestion_audit_logs?message_id=eq.${encodeURIComponent(messageId)}&select=status&order=timestamp.desc&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  const rows = await response.json() as Array<{ status: string }>;
  return Array.isArray(rows) && rows.length > 0 ? rows[0].status : null;
}

describe("live supabase edge integration", { skip: !live }, () => {
  it("accepts gateway-token telemetry via edge-ingest", async () => {
    const now = Math.floor(Date.now() / 1000);
    const messageId = `integration-live-${now}`;
    const payload = basePayload(messageId, now);
    const result = await postToEdge(payload);
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.status, "inserted");

    assert.equal(await countReadings(messageId), 1);
    assert.equal(await latestAuditStatus(messageId), "accepted");
  });

  it("ignores duplicate payload", async () => {
    const now = Math.floor(Date.now() / 1000);
    const messageId = `integration-duplicate-${now}`;
    const payload = basePayload(messageId, now);
    const first = await postToEdge(payload);
    const second = await postToEdge(payload);

    assert.equal(first.status, 200);
    assert.equal(first.body.status, "inserted");
    assert.equal(second.status, 200);
    assert.equal(second.body.status, "duplicate_ignored");
    assert.equal(await countReadings(messageId), 1);
    assert.equal(await latestAuditStatus(messageId), "duplicate");
  });

  it("rejects replay attack with timestamp too old", async () => {
    const now = Math.floor(Date.now() / 1000);
    const staleTimestamp = now - 600;
    const messageId = `integration-replay-old-${now}`;
    const payload = basePayload(messageId, staleTimestamp);
    const result = await postToEdge(payload);
    assert.equal(result.status, 400);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    assert.equal(await countReadings(messageId), 0);
    assert.equal(await latestAuditStatus(messageId), "expired_timestamp");
  });

  it("rejects replay attack with timestamp too far in the future", async () => {
    const now = Math.floor(Date.now() / 1000);
    const futureTimestamp = now + 600;
    const messageId = `integration-replay-future-${now}`;
    const payload = basePayload(messageId, futureTimestamp);
    const result = await postToEdge(payload);
    assert.equal(result.status, 400);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    assert.equal(await countReadings(messageId), 0);
    assert.equal(await latestAuditStatus(messageId), "expired_timestamp");
  });
});
