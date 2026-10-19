import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statusFor, worstStatus } from "@/lib/monitoring/status";

/**
 * Status colour is a CLAIM, and this project may only make claims it can
 * source. These tests exist to stop a future change from lighting a metric
 * red because red looks good on the tile.
 */
describe("metric status honesty", () => {
  it("refuses to judge metrics this system has no threshold for", () => {
    // crop_thresholds carries salinity and nothing else, and the project has
    // explicitly declined to publish agronomic bands for Cồn Hô it cannot
    // source. Colouring these would be inventing the standard.
    for (const key of ["temperature", "humidity", "moisture", "ec", "ph", "wind", "precipitation"] as const) {
      assert.equal(statusFor(key, 99, {}), null, `${key} must render neutral — no sourced band exists`);
    }
  });

  it("stays neutral on salinity until a threshold is actually configured", () => {
    assert.equal(statusFor("salinity", 5, {}), null);
    assert.equal(statusFor("salinity", 5, { salinity: null }), null);
  });

  it("uses the configured salinity threshold when there is one", () => {
    const salinity = { warningLevel: 1.0, criticalLevel: 2.0 };
    assert.equal(statusFor("salinity", 2.4, { salinity })?.level, "critical");
    assert.equal(statusFor("salinity", 1.2, { salinity })?.level, "warn");
    assert.equal(statusFor("salinity", 0.85, { salinity })?.level, "watch");
    assert.equal(statusFor("salinity", 0.2, { salinity })?.level, "ok");
    assert.equal(statusFor("salinity", 2.4, { salinity })?.basis, "configured");
  });

  it("judges battery and signal from device specs, not the environment", () => {
    assert.equal(statusFor("battery", 3.3, {})?.level, "critical");
    assert.equal(statusFor("battery", 4.0, {})?.level, "ok");
    assert.equal(statusFor("battery", 3.3, {})?.basis, "device");

    assert.equal(statusFor("signal", -102, {})?.level, "critical");
    assert.equal(statusFor("signal", -70, {})?.level, "ok");
    assert.equal(statusFor("signal", -70, {})?.basis, "device");
  });

  it("never invents a status from a missing or unparseable value", () => {
    assert.equal(statusFor("salinity", null, { salinity: { warningLevel: 1, criticalLevel: 2 } }), null);
    assert.equal(statusFor("battery", Number.NaN, {}), null);
    assert.equal(statusFor(undefined, 4, {}), null);
  });

  it("marks demo-derived status as demo, so it is never read as configuration", () => {
    const s = statusFor("battery", 3.3, { isDemo: true });
    assert.equal(s?.basis, "demo");
  });
});

/**
 * A Bento region tints its whole surface once, from the worst reading it
 * holds. Colouring a region green because one of its two values is fine
 * would be the same dishonesty statusFor() refuses, applied at region scale.
 */
describe("worst status wins", () => {
  it("takes the most severe status present", () => {
    assert.equal(worstStatus([statusFor("signal", -70, {}), statusFor("battery", 3.5, {})])?.level, "warn");
    assert.equal(worstStatus([statusFor("battery", 3.3, {}), statusFor("signal", -70, {})])?.level, "critical");
    assert.equal(worstStatus([statusFor("signal", -70, {}), statusFor("battery", 4.0, {})])?.level, "ok");
  });

  it("ignores readings this system has no basis to judge", () => {
    // A neutral weather reading beside a healthy battery must not drag the
    // region to neutral — it simply has no opinion to contribute.
    assert.equal(worstStatus([statusFor("temperature", 41, {}), statusFor("battery", 4.0, {})])?.level, "ok");
  });

  it("stays neutral when nothing in the region has a defensible status", () => {
    assert.equal(worstStatus([null, undefined, statusFor("humidity", 90, {})]), null);
    assert.equal(worstStatus([]), null);
  });
});
