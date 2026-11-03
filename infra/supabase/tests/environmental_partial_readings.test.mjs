import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../migrations/031_nullable_environmental_partial_readings.sql", import.meta.url),
  "utf8",
);
const originalSchema = readFileSync(
  new URL("../migrations/006_telemetry_observability.sql", import.meta.url),
  "utf8",
);

test("migration 031 makes only partial water sensor values nullable", () => {
  assert.match(migration, /alter table public\.environmental_readings/i);
  assert.match(migration, /alter column salinity drop not null/i);
  assert.match(migration, /alter column water_level drop not null/i);

  assert.doesNotMatch(migration, /alter column (?:salinity|water_level) set default/i);
  assert.doesNotMatch(migration, /default\s+0(?:\.0+)?/i);
  assert.doesNotMatch(migration, /update\s+public\.environmental_readings/i);
  assert.doesNotMatch(migration, /drop column\s+(?:salinity|water_level)/i);
  assert.doesNotMatch(migration, /alter column\s+(?:message_id|station_id|fault_flags|ec_probe_status|ultrasonic_status|timestamp)\s+drop not null/i);
});

test("identity and control columns remain required in the base schema", () => {
  for (const column of [
    "message_id text not null",
    "station_id text not null",
    "fault_flags integer not null",
    "ec_probe_status text not null",
    "ultrasonic_status text not null",
    "timestamp timestamptz not null",
  ]) {
    assert.match(originalSchema, new RegExp(column, "i"));
  }
});
