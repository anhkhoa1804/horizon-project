import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldQuality, SOIL_DISPLAYED_MASK, soilQualityFromFlags } from "@/lib/monitoring/soilFaults";

describe("soil fault bits", () => {
  it("bits of fields the site does not show (air 1/2, salinity 32, TDS 64) never make the station faulty", () => {
    assert.equal(soilQualityFromFlags(3), "valid");
    assert.equal(soilQualityFromFlags(32), "valid");
    assert.equal(soilQualityFromFlags(64), "valid");
    assert.equal(soilQualityFromFlags(96), "valid");
  });
  it("a displayed field's bit does", () => {
    assert.equal(soilQualityFromFlags(8), "error");
    assert.equal(soilQualityFromFlags(128 | 32), "error");
    assert.equal(SOIL_DISPLAYED_MASK, 4 | 8 | 16 | 128);
  });
  it("no number means no claim", () => {
    assert.equal(soilQualityFromFlags(null), null);
    assert.equal(soilQualityFromFlags(undefined), null);
    assert.equal(soilQualityFromFlags("abc"), null);
  });
  it("each metric reads only its own bit", () => {
    assert.equal(fieldQuality("soil_ph", 8), "valid");
    assert.equal(fieldQuality("soil_ph", 128), "error");
    assert.equal(fieldQuality("unknown_quantity", 255), undefined);
    assert.equal(fieldQuality("soil_ph", null), undefined);
  });
});
