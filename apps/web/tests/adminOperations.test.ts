import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { asManagedStationId, optionalNumber, optionalText } from "@/lib/admin/operations";

/**
 * Guards the operator console's persistence layer (migration 022).
 *
 * The console records OPERATOR ACTION AND INTENT. It must never imply that a
 * field device received or applied anything, because the firmware exposes no
 * command endpoint and returns no acknowledgement. Several of these tests
 * exist purely to keep that line from being crossed by a future edit that
 * "helpfully" adds an applied state.
 */

const SRC = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

/**
 * Strip comments before asserting on source.
 *
 * Several of these checks look for phrases that must not appear in CODE — and
 * the files deliberately DISCUSS those same phrases in their comments, to
 * explain why they are absent. Without this the documentation would fail the
 * test it exists to explain.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sql = (src: string) => src.replace(/^\s*--.*$/gm, "");
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "..", "..", "infra", "supabase", "migrations", "022_admin_operations.sql"),
  "utf8",
);
const CLEANUP_MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "..", "..", "infra", "supabase", "migrations", "027_remove_fixture_and_qa_data.sql"),
  "utf8",
);

describe("admin form parsing", () => {
  it("accepts only the three managed stations", () => {
    assert.equal(asManagedStationId("STATION_01"), "STATION_01");
    assert.equal(asManagedStationId("STATION_03"), "STATION_03");
    // STATION_04/05 are seed fixtures, never operational nodes.
    assert.equal(asManagedStationId("STATION_04"), null);
    assert.equal(asManagedStationId("' or 1=1--"), null);
    assert.equal(asManagedStationId(null), null);
    assert.equal(asManagedStationId(42), null);
  });

  it("treats a blank numeric field as unset rather than zero", () => {
    // A threshold left empty must not become 0 — that would alarm on every
    // reading rather than on none.
    assert.equal(optionalNumber(""), null);
    assert.equal(optionalNumber("   "), null);
    assert.equal(optionalNumber(null), null);
    assert.equal(optionalNumber("not a number"), null);
    assert.equal(optionalNumber("1.24"), 1.24);
    assert.equal(optionalNumber("0"), 0);
  });

  it("trims optional text and blanks to null", () => {
    assert.equal(optionalText("  note  "), "note");
    assert.equal(optionalText("   "), null);
    assert.equal(optionalText(null), null);
  });
});

describe("admin production topology", () => {
  it("filters repository snapshots to the canonical three-node registry", () => {
    const page = SRC("app", "admin", "page.tsx");
    assert.match(page, /filterToPilotStations\(await repos\.stations\.getAll\(scope\)\)/);
    assert.match(page, /filterSnapshotsToPilotStations\(await repos\.readings\.getSnapshots\(scope\)\)/);
  });

  it("removes only named browser-QA artifacts in the production cleanup migration", () => {
    for (const value of ["STATION_04", "STATION_05", "QA_BROWSER_PERSISTENCE", "QA browser persistence check"]) {
      assert.ok(CLEANUP_MIGRATION.includes(value), `cleanup migration does not address ${value}`);
    }
    assert.ok(!/delete\s+from\s+public\.maintenance_logs\s*;/.test(CLEANUP_MIGRATION));
  });
});

describe("admin persistence is real, not client-side", () => {
  it("creates the four operator tables as migrations", () => {
    for (const table of ["alert_configs", "maintenance_logs", "calibration_records", "audit_events"]) {
      assert.match(MIGRATION, new RegExp(`create table if not exists public\\.${table}`), `${table} missing`);
    }
  });

  it("locks every operator table to the service role", () => {
    // Same posture as 012/020: no anon or authenticated grants AND row level
    // security on, so a mistaken policy alone cannot expose operator data.
    for (const table of ["alert_configs", "maintenance_logs", "calibration_records", "audit_events"]) {
      assert.match(MIGRATION, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(MIGRATION, new RegExp(`revoke all on public\\.${table} from anon`));
      assert.match(MIGRATION, new RegExp(`revoke all on public\\.${table} from authenticated`));
    }
  });

  it("keeps operator state out of the browser", () => {
    const ops = SRC("lib", "admin", "operations.ts");
    const panels = SRC("components", "admin", "operations-panels.tsx");
    for (const [name, src] of [["operations", ops], ["panels", panels]] as const) {
      assert.ok(!/localStorage|sessionStorage/.test(src), `${name} stores operator state in the browser`);
    }
  });
});

describe("no fabricated device acknowledgement", () => {
  it("offers no 'applied to device' state anywhere in the operator surface", () => {
    // There is no acknowledgement column in the schema and no firmware path
    // that could populate one. Any UI claiming a device applied something
    // would be inventing it.
    const surfaces = [
      code(SRC("components", "admin", "operations-panels.tsx")),
      code(SRC("lib", "admin", "operations.ts")),
      sql(MIGRATION),
    ].join("\n");
    assert.ok(!/applied_to_device|APPLIED TO DEVICE|đã áp dụng xuống thiết bị/i.test(surfaces));
  });

  it("constrains calibration status to record-keeping values only", () => {
    const block = MIGRATION.slice(MIGRATION.indexOf("create table if not exists public.calibration_records"));
    const check = block.slice(0, block.indexOf(");"));
    assert.match(check, /status in \('recorded', 'superseded'\)/);
  });
});

describe("audit trail never stores secrets", () => {
  it("redacts secret-shaped metadata keys before writing", () => {
    const ops = SRC("lib", "admin", "operations.ts");
    for (const banned of ["token", "secret", "password", "key"]) {
      assert.ok(ops.includes(`"${banned}"`), `metadata scrubber does not cover "${banned}"`);
    }
    assert.match(ops, /\[redacted\]/, "the scrubber does not redact");
  });

  it("never logs the gateway ingest token", () => {
    const ops = SRC("lib", "admin", "operations.ts");
    const route = SRC("app", "admin", "export", "route.ts");
    assert.ok(!/GATEWAY_INGEST_TOKEN/.test(ops + route));
  });
});

describe("data export exports real rows", () => {
  const route = () => SRC("app", "admin", "export", "route.ts");

  it("selects from the real observation tables", () => {
    assert.match(route(), /soil_readings/);
    assert.match(route(), /environmental_readings/);
  });

  it("requires an admin session and answers 401 rather than redirecting", () => {
    // A redirect would make a browser download the login page as a .csv.
    assert.match(route(), /getSessionContext/);
    assert.match(route(), /status:\s*401/);
  });

  it("never synthesises rows to fill an empty range", () => {
    const src = code(route());
    assert.ok(!/placeholder|fillGaps|interpolat|Math\.random/i.test(src));
  });
});
