import type { TelemetryPayloadV1 } from "./types.js";

function fmtNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Unchanged since v1 shipped — water/direct-connect payloads. Deliberately
 * NOT extended with reading_kind/soil fields: this exact 12-field byte
 * format is what every existing water-station firmware signature depends
 * on, and there's no reason to risk it when soil payloads can have their
 * own canonical string instead (see buildSoilCanonicalString below).
 */
export function buildCanonicalString(payload: TelemetryPayloadV1): string {
  const str = (v: any) => (v !== undefined && v !== null ? String(v) : "");
  const num = (v: any) => (typeof v === "number" ? fmtNumber(v) : "");

  return [
    str(payload.device_id),
    str(payload.message_id),
    str(payload.timestamp),
    num(payload.salinity),
    num(payload.water_level),
    str(payload.fault_flags),
    str(payload.sensor_status?.ec_probe),
    str(payload.sensor_status?.ultrasonic),
    num(payload.battery_voltage),
    str(payload.signal_strength_dbm),
    str(payload.firmware_version),
    str(payload.contract_version),
  ].join("|");
}

/**
 * Soil-kind payloads (reading_kind: "soil") sign a different, purpose-built
 * canonical string instead of extending the water one — every soil field
 * must be covered by the signature (nothing here should be tamperable
 * post-signing), and introducing them into buildCanonicalString above
 * would mean either changing its byte format (risking the proven water
 * path) or leaving soil values unsigned (a real integrity gap). Two
 * separate, fully-specified formats is simpler than one conditional one.
 */
export function buildSoilCanonicalString(payload: TelemetryPayloadV1): string {
  const str = (v: any) => (v !== undefined && v !== null ? String(v) : "");
  const num = (v: any) => (typeof v === "number" ? fmtNumber(v) : "");
  const soil = payload.soil;

  return [
    str(payload.device_id),
    str(payload.message_id),
    str(payload.timestamp),
    "soil",
    num(soil?.air_temp_c),
    num(soil?.air_humidity_pct),
    num(soil?.soil_temp_c),
    num(soil?.soil_moisture_pct),
    num(soil?.soil_ec_ms_cm),
    num(soil?.soil_ph),
    str(payload.fault_flags),
    str(payload.firmware_version),
    str(payload.contract_version),
  ].join("|");
}

function selectCanonicalString(payload: TelemetryPayloadV1): string {
  return payload.reading_kind === "soil" ? buildSoilCanonicalString(payload) : buildCanonicalString(payload);
}

export async function signPayload(payload: TelemetryPayloadV1, deviceSecret: string): Promise<string> {
  const canonical = selectCanonicalString(payload);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(deviceSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string compare. Runs in both Node and Deno (edge runtime),
 * so it can't rely on node:crypto's timingSafeEqual.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}
