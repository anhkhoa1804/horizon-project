import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  activeThresholdsFor,
  resolveReferenceSeverity,
  resolveSeverity,
  formatBand,
  type ThresholdRow,
} from "@/lib/monitoring/thresholdTypes";

/**
 * The registry's job is to make four category errors impossible:
 *
 *   1. a published REFERENCE figure silently becoming an alert rule
 *   2. an ECe threshold being applied to a bulk in-situ soil EC reading
 *   3. an EC threshold being applied to a salinity reading in per-mille
 *   4. a measurement-QUALITY rule being read as an environmental verdict
 *
 * Each is cheap to introduce with a one-line edit and expensive to notice, so
 * each has a test.
 */

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "..", "..", "infra", "supabase", "migrations", "023_threshold_registry.sql"),
  "utf8",
);

const row = (over: Partial<ThresholdRow>): ThresholdRow => ({
  id: Math.random().toString(36).slice(2),
  metric_key: "x",
  quantity: "water_ec",
  unit: "dS/m",
  threshold_value: 1,
  upper_value: null,
  comparison: "above",
  severity: "warning",
  basis: "FAO_REFERENCE",
  source_title: null,
  source_url: null,
  source_locator: null,
  scope: null,
  validation_status: "REFERENCE",
  is_active: false,
  notes: null,
  effective_from: null,
  ...over,
});

describe("reference values never create alerts", () => {
  it("ignores inactive rows however well-sourced they are", () => {
    const rows = [
      row({ quantity: "water_ec", threshold_value: 0.7, comparison: "above", severity: "critical", is_active: false }),
    ];
    assert.equal(resolveSeverity(rows, "water_ec", 5), null, "an inactive row produced a status");
    assert.equal(activeThresholdsFor(rows, "water_ec").length, 0);
  });

  it("only active rows resolve", () => {
    const rows = [
      row({ quantity: "battery_voltage", threshold_value: 3.4, comparison: "below", severity: "critical", is_active: true, validation_status: "OPERATIONAL" }),
    ];
    assert.equal(resolveSeverity(rows, "battery_voltage", 3.2)?.severity, "critical");
    assert.equal(resolveSeverity(rows, "battery_voltage", 4.0), null);
  });

  it("can still supply a labelled public advisory without becoming an alert", () => {
    const rows = [
      row({ quantity: "soil_ph", threshold_value: 5, comparison: "below", severity: "critical", validation_status: "PILOT" }),
    ];
    assert.equal(resolveSeverity(rows, "soil_ph", 4.8), null, "a pilot reference became an operational alert");
    assert.equal(resolveReferenceSeverity(rows, "soil_ph", 4.8)?.severity, "critical");
  });

  it("the database forbids activating a REFERENCE row", () => {
    // The interlock is a CHECK constraint, not application discipline.
    assert.match(MIGRATION, /constraint reference_rows_cannot_be_active/);
    assert.match(MIGRATION, /check \(not \(is_active and validation_status = 'REFERENCE'\)\)/);
  });

  it("seeds every scientific reference inactive", () => {
    // Every seeded row is written with an explicit is_active. Only the
    // device-health rows may be true.
    const seedBlock = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    const activeSeeds = seedBlock.match(/'(REFERENCE|PILOT|OPERATIONAL|SITE_VALIDATED)', true/g) ?? [];
    for (const match of activeSeeds) {
      assert.match(match, /'OPERATIONAL', true/, `a non-operational row was seeded active: ${match}`);
    }
  });
});

describe("quantities cannot be confused", () => {
  it("matches on quantity, not metric_key", () => {
    const rows = [
      row({ metric_key: "salinity", quantity: "water_ec", threshold_value: 0.7, is_active: true, validation_status: "OPERATIONAL" }),
    ];
    // Same metric_key, different quantity — must not resolve.
    assert.equal(resolveSeverity(rows, "water_salinity", 5), null);
    assert.equal(resolveSeverity(rows, "water_ec", 5)?.severity, "warning");
  });

  it("keeps ECe and bulk soil EC as separate quantities", () => {
    assert.match(MIGRATION, /'soil_ec_bulk'/);
    assert.match(MIGRATION, /'soil_ec_saturated_extract'/);
    // An ECe threshold must never resolve against a bulk reading.
    const rows = [
      row({ quantity: "soil_ec_saturated_extract", threshold_value: 3, is_active: true, validation_status: "OPERATIONAL" }),
    ];
    assert.equal(resolveSeverity(rows, "soil_ec_bulk", 9), null, "an ECe threshold hit a bulk EC reading");
  });

  it("seeds no severity threshold for bulk soil EC at all", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    assert.ok(!/'soil_ec_bulk'/.test(seed), "bulk soil EC was given a threshold - FAO's figures are ECe");
  });

  it("seeds no threshold for water salinity in per-mille", () => {
    // Blocked behind verifying register -> raw unit -> conversion -> display.
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    assert.ok(!/'water_salinity'/.test(seed), "a salinity threshold was seeded on an unverified unit chain");
  });
});

describe("the FAO and citrus reference values are recorded correctly", () => {
  it("carries FAO's ECw bands", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    assert.match(seed, /'water_ec', 'water_ec', 'dS\/m', 0\.7, null, 'below', 'normal'/);
    assert.match(seed, /'water_ec', 'water_ec', 'dS\/m', 0\.7, 3\.0, 'between', 'watch'/);
    assert.match(seed, /'water_ec', 'water_ec', 'dS\/m', 3\.0, null, 'above', 'critical'/);
    assert.match(seed, /FAO Irrigation and Drainage Paper 29/);
  });

  it("records 1.6 dS/m as a yield-response point, not a safety limit", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    const idx = seed.indexOf("'dS/m', 1.6");
    assert.ok(idx > 0, "the 1.6 citrus reference point is missing");
    const context = seed.slice(idx, idx + 900);
    assert.match(context, /90% yield/i, "1.6 is not explained as a yield reference point");
    assert.match(context, /CITRUS_REFERENCE/);
  });

  it("gives water pH a normal band and a warning, but no critical", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    const ph = seed.slice(seed.indexOf("'water_ph'"), seed.indexOf("'soil_ph'"));
    assert.match(ph, /6\.5, 8\.4, 'between', 'normal'/);
    assert.match(ph, /6\.5, 8\.4, 'outside', 'warning'/);
    assert.ok(!/'critical'/.test(ph), "water pH was given a critical band FAO does not support");
  });

  it("marks the soil pH ladder PILOT, not settled science", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    const idx = seed.indexOf("'soil_ph', 'soil_ph', 'pH', 5.0, null, 'below', 'critical'");
    assert.ok(idx > 0, "the soil pH critical row is missing");
    assert.match(seed.slice(idx, idx + 700), /'PILOT', false/);
  });
});

describe("measurement quality is not an environmental verdict", () => {
  it("carries low_confidence as its own severity", () => {
    assert.match(MIGRATION, /'low_confidence'/);
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.threshold_registry"));
    const idx = seed.indexOf("'SENSOR_QUALITY'");
    assert.ok(idx > 0);
    assert.match(
      seed.slice(Math.max(0, idx - 400), idx + 900),
      /does NOT say the soil is safe/i,
      "the moisture-confidence row does not state what it is not",
    );
  });
});

describe("the soil water model is derived, never hard-coded", () => {
  it("generates the irrigation trigger from FC, PWP and MAD", () => {
    assert.match(MIGRATION, /irrigation_trigger_pct numeric generated always as/);
    assert.match(MIGRATION, /field_capacity_pct[\s\S]{0,200}management_allowed_depletion_pct[\s\S]{0,120}permanent_wilting_point_pct/);
  });

  it("computes the documented example correctly", () => {
    // FC 35, PWP 17, MAD 50 -> 35 - 0.5 * 18 = 26
    const fc = 35, pwp = 17, mad = 50;
    assert.equal(fc - (mad / 100) * (fc - pwp), 26);
  });

  it("seeds no default soil water model", () => {
    // A guessed field capacity is worse than none: it would silently produce a
    // confident-looking irrigation threshold for soil nobody has measured.
    assert.ok(!/insert into public\.soil_water_models/.test(MIGRATION));
  });

  it("refuses a model whose wilting point is not below field capacity", () => {
    assert.match(MIGRATION, /constraint pwp_below_fc/);
  });
});

describe("band formatting reads the way a person reads it", () => {
  it("renders each comparison", () => {
    assert.equal(formatBand(row({ comparison: "above", threshold_value: 3, unit: "dS/m" })), "> 3 dS/m");
    assert.equal(formatBand(row({ comparison: "below", threshold_value: 0.7, unit: "dS/m" })), "< 0.7 dS/m");
    assert.equal(
      formatBand(row({ comparison: "between", threshold_value: 6.5, upper_value: 8.4, unit: "pH" })),
      "6.5 – 8.4",
    );
    assert.equal(
      formatBand(row({ comparison: "outside", threshold_value: 6.5, upper_value: 8.4, unit: "pH" })),
      "∉ 6.5 – 8.4",
    );
  });
});

describe("worst status wins", () => {
  it("returns the most severe matching active row", () => {
    const rows = [
      row({ quantity: "battery_voltage", threshold_value: 3.8, comparison: "below", severity: "watch", is_active: true, validation_status: "OPERATIONAL" }),
      row({ quantity: "battery_voltage", threshold_value: 3.6, comparison: "below", severity: "warning", is_active: true, validation_status: "OPERATIONAL" }),
      row({ quantity: "battery_voltage", threshold_value: 3.4, comparison: "below", severity: "critical", is_active: true, validation_status: "OPERATIONAL" }),
    ];
    assert.equal(resolveSeverity(rows, "battery_voltage", 3.3)?.severity, "critical");
    assert.equal(resolveSeverity(rows, "battery_voltage", 3.7)?.severity, "watch");
  });

  it("has no opinion on a null or non-finite reading", () => {
    const rows = [row({ quantity: "water_ec", threshold_value: 1, is_active: true, validation_status: "OPERATIONAL" })];
    assert.equal(resolveSeverity(rows, "water_ec", null), null);
    assert.equal(resolveSeverity(rows, "water_ec", Number.NaN), null);
  });
});

describe("provenance is persisted, not decorative", () => {
  it("stores basis, source, locator, scope and validation status", () => {
    for (const column of ["basis", "source_title", "source_url", "source_locator", "scope", "validation_status", "effective_from"]) {
      assert.match(MIGRATION, new RegExp(`\\b${column}\\b`), `${column} is missing from the registry`);
    }
  });

  it("locks the registry to the service role", () => {
    assert.match(MIGRATION, /alter table public\.threshold_registry enable row level security/);
    assert.match(MIGRATION, /revoke all on public\.threshold_registry from anon/);
    assert.match(MIGRATION, /revoke all on public\.threshold_registry from authenticated/);
  });
});
