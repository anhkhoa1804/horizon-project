/**
 * The soil node's `fault_flags`: the gateway sets one bit per field it could not read from the
 * packet (firmware/esp32-node/src/gateway/simple_telemetry.h): air temperature 1, air humidity 2,
 * soil temperature 4, moisture 8, bulk EC 16, salinity 32, TDS 64, pH 128.
 *
 * A bit is a MISSING FIELD, not proof that a sensor is broken - the field may simply not be sent
 * any more. So the site never shows "sensor fault" for a field it does not display (salinity, TDS),
 * and a displayed field whose bit is set has no value anyway, which the UI already says as
 * "no data". Station-level quality therefore only looks at the displayed fields.
 */
export const SOIL_FAULT_BIT: Readonly<Record<string, number>> = {
  air_temp: 1, air_humidity: 2, soil_temp: 4, soil_moisture: 8, soil_ec_bulk: 16, soil_ph: 128,
};

/**
 * Bits of the fields the site actually displays from the soil node: soil temperature, moisture,
 * bulk EC and pH. Its air temperature/humidity (1, 2) are not shown - the weather boxes are the
 * regional forecast - and neither are salinity/TDS (32, 64). Live packets currently carry
 * fault_flags = 3 (air fields missing), which must not make the soil readings look faulty.
 */
export const SOIL_DISPLAYED_MASK = 4 | 8 | 16 | 128;

/** Station-level soil quality from the bitmask: null without a number, "error" only for displayed fields. */
export function soilQualityFromFlags(flags: unknown): "valid" | "error" | null {
  const n = typeof flags === "number" && Number.isFinite(flags) ? flags : typeof flags === "string" && flags.trim() !== "" && Number.isFinite(Number(flags)) ? Number(flags) : null;
  if (n === null) return null;
  return (n & SOIL_DISPLAYED_MASK) !== 0 ? "error" : "valid";
}

/**
 * The water node's `fault_flags`: EC field missing 1, water-level field missing 2. Probe statuses
 * ("ok" | "fault" | "unknown") are reported separately. Salinity and water temperature come from
 * the EC/temperature probe; water level from the ultrasonic sensor. Each metric is judged only by
 * its own source, so a level outage never marks salinity faulty and vice versa.
 */
const WATER_SOURCE: Readonly<Record<string, { bit: number; probe: "ec" | "ultrasonic" }>> = {
  water_salinity: { bit: 1, probe: "ec" },
  water_ec: { bit: 1, probe: "ec" },
  water_temp: { bit: 1, probe: "ec" },
  water_level: { bit: 2, probe: "ultrasonic" },
};

export interface WaterProbeStatus { ec?: string | null; ultrasonic?: string | null }

/** Quality of ONE metric from the raw evidence, or undefined when the evidence does not cover it. */
export function fieldQuality(
  quantity: string,
  flags: number | null | undefined,
  probes?: WaterProbeStatus | null,
): "valid" | "error" | "estimated" | undefined {
  if (typeof flags !== "number" || !Number.isFinite(flags)) return undefined;
  const soilBit = SOIL_FAULT_BIT[quantity];
  if (soilBit !== undefined) return (flags & soilBit) !== 0 ? "error" : "valid";
  const water = WATER_SOURCE[quantity];
  if (water) {
    const status = probes?.[water.probe];
    if ((flags & water.bit) !== 0 || status === "fault") return "error";
    return status === "unknown" ? "estimated" : "valid";
  }
  return undefined;
}
