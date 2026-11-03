import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const station2Source = readFileSync(
  new URL("../src/trạm 2.ino", import.meta.url),
  "utf8",
);

const minVoltageV = 2.5;
const maxVoltageV = 18.0;

function isValidBatteryVoltage(voltageV) {
  return Number.isFinite(voltageV) &&
    voltageV >= minVoltageV &&
    voltageV <= maxVoltageV;
}

function simpleFloat(value, decimals) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "x";
}

test("zero volts is invalid Station 2 battery telemetry and stays missing", () => {
  assert.equal(isValidBatteryVoltage(0), false);
  assert.equal(isValidBatteryVoltage(Number.NaN), false);
  assert.equal(isValidBatteryVoltage(2.49), false);
  assert.equal(isValidBatteryVoltage(2.5), true);
  assert.equal(isValidBatteryVoltage(18.0), true);
  assert.equal(isValidBatteryVoltage(18.01), false);

  assert.equal(simpleFloat(Number.NaN, 2), "x");
  assert.equal(simpleFloat(Number.NaN, 1), "x");
});

test("Station 2 preserves S2 wire field order with missing battery telemetry", () => {
  const body = [
    "S2", "42", "1", "x", "x", "x", "x", "x", "x", "x", "x",
    simpleFloat(Number.NaN, 2), simpleFloat(Number.NaN, 1),
  ].join("|");
  const packet = `${body}|ABCD`;
  const fields = packet.split("|");

  assert.equal(fields.length, 14);
  assert.deepEqual(fields.slice(0, 11), [
    "S2", "42", "1", "x", "x", "x", "x", "x", "x", "x", "x",
  ]);
  assert.equal(fields[11], "x");
  assert.equal(fields[12], "x");
  assert.equal(fields[13], "ABCD");
});

test("firmware rejects invalid INA226 voltage before percentage calculation", () => {
  assert.match(station2Source, /BATTERY_VALID_MIN_VOLTAGE_V = 2\.5f/);
  assert.match(station2Source, /BATTERY_VALID_MAX_VOLTAGE_V = 18\.0f/);
  assert.match(station2Source, /bool isValidBatteryVoltage\(float voltageV\)/);
  assert.match(station2Source, /if \(!isValidBatteryVoltage\(voltageV\)\)/);
  assert.match(station2Source, /return \{false, NAN, NAN, "voltage_out_of_range"\};/);
  assert.match(station2Source, /const float percent = estimateLifePo4Percent\(voltageV\);/);
  assert.ok(
    station2Source.indexOf("if (!isValidBatteryVoltage(voltageV))") <
      station2Source.indexOf("const float percent = estimateLifePo4Percent(voltageV);"),
  );
  assert.match(station2Source, /if \(!isfinite\(value\)\) return "x";/);
  assert.match(station2Source, /aggregateBatteryVoltageV[\s\S]*= reading\.batteryVoltageV;/);
  assert.match(station2Source, /aggregateBatteryPercent[\s\S]*= reading\.batteryPercent;/);
  assert.match(station2Source, /if \(isfinite\(values\[i\]\)\)/);
});
