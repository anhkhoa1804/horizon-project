import { createHmac, timingSafeEqual } from "node:crypto";
import schema from "../../../../contracts/remote-config.v1.schema.json";
export const CONFIG_VERSION = schema.properties.contract_version.const;
export const CONFIG_STATIONS = schema.properties.station_id.enum;
export type ConfigMode = "normal" | "rain_saver" | "maintenance";
export interface RemoteConfig {
  contract_version: 1;
  config_revision: number;
  station_id: "STATION_01" | "STATION_02";
  sample_interval_seconds: number;
  sleep_interval_seconds: number;
  mode: ConfigMode;
}
export type FrameType = "SET" | "ACK" | "REJECTED" | "APPLIED";
export type Reason =
  | "ok"
  | "stale"
  | "conflict"
  | "persistence"
  | "unsupported"
  | "invalid";
export interface ConfigFrame {
  config: RemoteConfig;
  type: FrameType;
  reason: Reason;
}
export function isRemoteConfig(value: unknown): value is RemoteConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== [...schema.required].sort().join())
    return false;
  return (
    v.contract_version === CONFIG_VERSION &&
    typeof v.station_id === "string" &&
    CONFIG_STATIONS.includes(v.station_id) &&
    Number.isInteger(v.config_revision) &&
    Number(v.config_revision) >= schema.properties.config_revision.minimum &&
    Number(v.config_revision) <= schema.properties.config_revision.maximum &&
    Number.isInteger(v.sample_interval_seconds) &&
    Number(v.sample_interval_seconds) >=
      schema.properties.sample_interval_seconds.minimum &&
    Number(v.sample_interval_seconds) <=
      schema.properties.sample_interval_seconds.maximum &&
    Number.isInteger(v.sleep_interval_seconds) &&
    Number(v.sleep_interval_seconds) >=
      schema.properties.sleep_interval_seconds.minimum &&
    Number(v.sleep_interval_seconds) <=
      schema.properties.sleep_interval_seconds.maximum &&
    typeof v.mode === "string" &&
    schema.properties.mode.enum.includes(v.mode)
  );
}
export function canonicalConfig(c: RemoteConfig): string {
  if (!isRemoteConfig(c)) throw new Error("invalid_config");
  return JSON.stringify({
    contract_version: 1,
    config_revision: c.config_revision,
    station_id: c.station_id,
    sample_interval_seconds: c.sample_interval_seconds,
    sleep_interval_seconds: c.sleep_interval_seconds,
    mode: c.mode,
  });
}
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function mac(body: string, key: string) {
  if (key.length < 32) throw Error("key_unavailable");
  return createHmac("sha256", key).update(body).digest("hex").toUpperCase();
}
export function encodeConfigFrame(
  c: RemoteConfig,
  type: FrameType,
  key: string,
  reason: Reason = "ok",
): string {
  canonicalConfig(c);
  if (
    !schema["x-wire"].types.includes(type) ||
    !schema["x-wire"].reasons.includes(reason) ||
    (type === "REJECTED") === (reason === "ok")
  )
    throw Error("invalid_result");
  const body = `HC1|1|${type}|${c.station_id === "STATION_01" ? "S1" : "S2"}|${c.config_revision}|${c.sample_interval_seconds}|${c.sleep_interval_seconds}|${c.mode}|${reason}`;
  const signed = `${body}|${crc16(body)}`;
  return `${signed}|${mac(signed, key)}`;
}
export function decodeConfigFrame(
  frame: string,
  key: string,
): ConfigFrame | null {
  if (
    frame.length >= schema["x-wire"].max_frame_bytes ||
    !/^[\x20-\x7E]+$/.test(frame)
  )
    return null;
  const p = frame.split("|");
  if (
    p.length !== 11 ||
    p[0] !== "HC1" ||
    p[1] !== "1" ||
    !["S1", "S2"].includes(p[3]) ||
    !p.slice(4, 7).every((v) => /^(0|[1-9][0-9]*)$/.test(v))
  )
    return null;
  const c = {
    contract_version: 1,
    config_revision: Number(p[4]),
    station_id: p[3] === "S1" ? "STATION_01" : "STATION_02",
    sample_interval_seconds: Number(p[5]),
    sleep_interval_seconds: Number(p[6]),
    mode: p[7],
  } as RemoteConfig;
  if (!isRemoteConfig(c)) return null;
  try {
    const expected = encodeConfigFrame(
      c,
      p[2] as FrameType,
      key,
      p[8] as Reason,
    );
    if (
      expected.length !== frame.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(frame))
    )
      return null;
    return { config: c, type: p[2] as FrameType, reason: p[8] as Reason };
  } catch {
    return null;
  }
}
export function stationConfigKey(station: string): string | undefined {
  return CONFIG_STATIONS.includes(station)
    ? process.env[`REMOTE_CONFIG_${station}_KEY`]
    : undefined;
}
export function deriveConfigState(
  row: {
    config_revision?: number;
    delivery_state?: string;
    updated_at?: string;
    last_delivery_at?: string | null;
  },
  now = Date.now(),
): string {
  if (!row.config_revision) return "UNSET";
  const state = row.delivery_state ?? "STORED";
  return !["APPLIED", "REJECTED", "FAILED"].includes(state) &&
    now - Date.parse(row.last_delivery_at ?? row.updated_at ?? "") > 86400000
    ? "STALE"
    : state;
}
