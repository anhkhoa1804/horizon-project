import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const station1Source = readFileSync(
  new URL("../src/trạm 1.ino", import.meta.url),
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

test("zero volts is invalid battery telemetry and remains missing", () => {
  assert.equal(isValidBatteryVoltage(0), false);
  assert.equal(isValidBatteryVoltage(Number.NaN), false);
  assert.equal(isValidBatteryVoltage(2.49), false);
  assert.equal(isValidBatteryVoltage(2.5), true);
  assert.equal(isValidBatteryVoltage(18.0), true);
  assert.equal(isValidBatteryVoltage(18.01), false);

  assert.equal(simpleFloat(Number.NaN, 2), "x");
  assert.equal(simpleFloat(Number.NaN, 1), "x");
});

test("Station 1 keeps battery wire fields missing without changing packet order", () => {
  const body = [
    "S1", "42", "1", "10.0", "340.0", "0.123", "25.0", "50", "0.456",
    simpleFloat(Number.NaN, 2), simpleFloat(Number.NaN, 1),
  ].join("|");
  const packet = `${body}|ABCD`;
  const fields = packet.split("|");

  assert.equal(fields.length, 12);
  assert.deepEqual(fields.slice(0, 9), [
    "S1", "42", "1", "10.0", "340.0", "0.123", "25.0", "50", "0.456",
  ]);
  assert.equal(fields[9], "x");
  assert.equal(fields[10], "x");
  assert.equal(fields[11], "ABCD");
});

test("firmware rejects implausible INA226 bus voltage before percentage calculation", () => {
  assert.match(station1Source, /BATTERY_VALID_MIN_VOLTAGE_V = 2\.5f/);
  assert.match(station1Source, /BATTERY_VALID_MAX_VOLTAGE_V = 18\.0f/);
  assert.match(station1Source, /bool isValidBatteryVoltage\(float voltageV\)/);
  assert.match(station1Source, /if \(!isValidBatteryVoltage\(voltageV\)\)/);
  assert.match(station1Source, /return \{false, NAN, NAN, "voltage_out_of_range"\};/);
  assert.match(station1Source, /const float percent = estimateLifePo4Percent\(voltageV\);/);
  assert.match(station1Source, /if \(!isfinite\(value\)\) return "x";/);
  assert.match(station1Source, /aggregateBatteryVoltageV[\s\S]*= reading\.batteryVoltageV;/);
  assert.match(station1Source, /aggregateBatteryPercent[\s\S]*= reading\.batteryPercent;/);
  assert.match(station1Source, /if \(isfinite\(values\[i\]\)\)/);
});
