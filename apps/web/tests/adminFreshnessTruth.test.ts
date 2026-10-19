import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const SRC = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("Admin freshness and alert intent remain truthful", () => {
  it("does not promote legacy gateway_observations or health timestamps into current gateway/measurement freshness", () => {
    const ingestionHealth = SRC("lib", "admin", "ingestionHealth.ts");
    const network = SRC("components", "admin", "network-overview.tsx");
    assert.doesNotMatch(ingestionHealth, /gateway_observations/);
    assert.match(ingestionHealth, /ingestion_audit_logs/);
    assert.match(network, /node\.id === "STATION_03"\s*\?\s*null/);
    assert.match(network, /snapshot\?\.reading\?\.timestamp\s*\?\?\s*null/);
    assert.doesNotMatch(network, /health\?\.timestamp/);
    assert.match(network, /Chưa có bằng chứng hiện tại/);
  });

  it("describes alert_configs as stored intent and corrects the historical migration comment", () => {
    const panel = SRC("components", "admin", "operations-panels.tsx");
    const migration = fs.readFileSync(path.join(process.cwd(), "..", "..", "infra", "supabase", "migrations", "022_admin_operations.sql"), "utf8");
    assert.match(panel, /Chỉ lưu ý định.*chưa được đánh giá và không thể thực thi trên thiết bị/);
    assert.match(migration, /Stored operator alert intent only\. Not evaluated and not device-executable/i);
    assert.doesNotMatch(migration, /these are evaluated server-side/i);
  });
});
