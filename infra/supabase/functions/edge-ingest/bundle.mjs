// src/config.ts
function resolveIngestConfig(env = process.env) {
  return {
    allowedContractVersion: env.DEFAULT_CONTRACT_VERSION ?? "v1",
    maxTimestampDriftSeconds: Number(env.MAX_TIMESTAMP_DRIFT_SECONDS ?? "300"),
    salinityWarningLevel: Number(env.SALINITY_WARNING_LEVEL ?? "1.2"),
    salinityCriticalLevel: Number(env.SALINITY_CRITICAL_LEVEL ?? "1.8"),
    lowBatteryVoltage: Number(env.LOW_BATTERY_VOLTAGE ?? "3.6"),
    lowSignalStrengthDbm: Number(env.LOW_SIGNAL_STRENGTH_DBM ?? "-95"),
    gatewayIngestToken: env.GATEWAY_INGEST_TOKEN
  };
}

// src/canonical.ts
function fmtNumber(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
function buildCanonicalString(payload) {
  const str = (v) => v !== void 0 && v !== null ? String(v) : "";
  const num = (v) => typeof v === "number" ? fmtNumber(v) : "";
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
    str(payload.contract_version)
  ].join("|");
}
function buildSoilCanonicalString(payload) {
  const str = (v) => v !== void 0 && v !== null ? String(v) : "";
  const num = (v) => typeof v === "number" ? fmtNumber(v) : "";
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
    str(payload.contract_version)
  ].join("|");
}
function selectCanonicalString(payload) {
  return payload.reading_kind === "soil" ? buildSoilCanonicalString(payload) : buildCanonicalString(payload);
}
async function signPayload(payload, deviceSecret) {
  const canonical = selectCanonicalString(payload);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(deviceSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// src/ingest.ts
function inRange(value, min, max) {
  return value >= min && value <= max;
}
function readingKind(payload) {
  return payload.reading_kind === "soil" ? "soil" : "water";
}
function hasRequiredFields(payload) {
  const baseFieldsOk = Boolean(
    payload.contract_version && payload.device_id && payload.message_id && Number.isFinite(payload.timestamp) && payload.firmware_version && Number.isFinite(payload.fault_flags)
  );
  if (!baseFieldsOk) {
    return false;
  }
  if (readingKind(payload) === "soil") {
    const soil = payload.soil;
    if (!soil) {
      return false;
    }
    return [soil.air_temp_c, soil.air_humidity_pct, soil.soil_temp_c, soil.soil_moisture_pct, soil.soil_ec_ms_cm, soil.soil_ph].some(
      (v) => typeof v === "number" && Number.isFinite(v)
    );
  }
  return Boolean(
    payload.sensor_status?.ec_probe && payload.sensor_status?.ultrasonic && Number.isFinite(payload.salinity) && Number.isFinite(payload.water_level)
  );
}
function isFaulty(payload) {
  if (readingKind(payload) === "soil") {
    return false;
  }
  if (payload.fault_flags > 0) {
    return true;
  }
  return payload.sensor_status?.ec_probe === "fault" || payload.sensor_status?.ultrasonic === "fault";
}
function soilValuesInRange(payload) {
  const soil = payload.soil;
  if (!soil) {
    return false;
  }
  const checks = [
    [soil.air_temp_c, -10, 60],
    [soil.air_humidity_pct, 0, 100],
    [soil.soil_temp_c, -10, 60],
    [soil.soil_moisture_pct, 0, 100],
    [soil.soil_ec_ms_cm, 0, 20],
    [soil.soil_ec_us_cm ?? null, 0, 2e4],
    [soil.soil_salinity ?? null, 0, 1e5],
    [soil.soil_tds ?? null, 0, 1e5],
    [soil.soil_ph, 0, 14]
  ];
  return checks.every(([value, min, max]) => value === null || inRange(value, min, max));
}
function optionalInRange(value, min, max) {
  return typeof value !== "number" || inRange(value, min, max);
}
function auditRow(payload, status, reason, timestamp) {
  return {
    message_id: payload.message_id ?? "",
    device_id: payload.device_id ?? "",
    status,
    reason,
    timestamp
  };
}
async function emitAlertEvents(db, payload, config, nowEpochSeconds) {
  const salinityWarningLevel = config.salinityWarningLevel ?? 1.2;
  const salinityCriticalLevel = config.salinityCriticalLevel ?? 1.8;
  const lowBatteryVoltage = config.lowBatteryVoltage ?? 3.6;
  const lowSignalStrengthDbm = config.lowSignalStrengthDbm ?? -95;
  const events = [];
  if (readingKind(payload) === "water" && typeof payload.salinity === "number") {
    if (payload.salinity >= salinityCriticalLevel) {
      events.push({
        station_id: payload.device_id,
        event_type: "HIGH_SALINITY",
        severity: "critical",
        message_id: payload.message_id,
        details: { salinity: payload.salinity, threshold: salinityCriticalLevel },
        timestamp: nowEpochSeconds
      });
    } else if (payload.salinity >= salinityWarningLevel) {
      events.push({
        station_id: payload.device_id,
        event_type: "HIGH_SALINITY",
        severity: "warning",
        message_id: payload.message_id,
        details: { salinity: payload.salinity, threshold: salinityWarningLevel },
        timestamp: nowEpochSeconds
      });
    }
  }
  if (typeof payload.battery_voltage === "number" && payload.battery_voltage < lowBatteryVoltage) {
    events.push({
      station_id: payload.device_id,
      event_type: "LOW_BATTERY",
      severity: "warning",
      message_id: payload.message_id,
      details: { battery_voltage: payload.battery_voltage, threshold: lowBatteryVoltage },
      timestamp: nowEpochSeconds
    });
  }
  if (typeof payload.signal_strength_dbm === "number" && payload.signal_strength_dbm < lowSignalStrengthDbm) {
    events.push({
      station_id: payload.device_id,
      event_type: "OFFLINE",
      severity: "info",
      message_id: payload.message_id,
      details: { signal_strength_dbm: payload.signal_strength_dbm, threshold: lowSignalStrengthDbm },
      timestamp: nowEpochSeconds
    });
  }
  for (const event of events) {
    await db.insertEvent(event);
  }
}
async function ingestTelemetry(request, db, config, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  try {
    const payload = request.payload;
    const kind = readingKind(payload);
    if (!hasRequiredFields(payload)) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "required field missing", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "required field missing", retryable: false };
    }
    if (payload.contract_version !== config.allowedContractVersion) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "unsupported contract version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "unsupported contract version", retryable: false };
    }
    const headerContractVersion = request.headers["x-contract-version"];
    if (headerContractVersion && headerContractVersion !== payload.contract_version) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "x-contract-version header does not match payload.contract_version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "x-contract-version header does not match payload.contract_version", retryable: false };
    }
    const gatewayToken = request.headers["x-gateway-token"] ?? "";
    const isGatewayTokenAuthorized = Boolean(config.gatewayIngestToken) && timingSafeEqualHex(gatewayToken, config.gatewayIngestToken ?? "");
    const authenticatingDeviceId = request.headers["x-device-id"];
    if (!isGatewayTokenAuthorized && !authenticatingDeviceId) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "missing x-device-id header", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "missing x-device-id header", retryable: false };
    }
    if (isGatewayTokenAuthorized) {
      if (!await db.isDeviceRegistered(payload.device_id)) {
        await db.insertAuditLog(auditRow(payload, "device_not_registered", "attributed station is not a known, active device", nowEpochSeconds));
        return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "attributed station is not a known, active device", retryable: false };
      }
    } else {
      const knownSecret = await db.getDeviceSecret(authenticatingDeviceId);
      if (!knownSecret) {
        await db.insertAuditLog(auditRow(payload, "device_not_registered", "unknown or inactive authenticating device", nowEpochSeconds));
        return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "unknown or inactive authenticating device", retryable: false };
      }
      const expectedSig = await signPayload(payload, knownSecret);
      if (!timingSafeEqualHex(expectedSig, request.headers["x-signature"] ?? "")) {
        await db.insertAuditLog(auditRow(payload, "invalid_signature", "signature verification failed", nowEpochSeconds));
        return { ok: false, error_code: "INVALID_SIGNATURE", message: "signature verification failed", retryable: false };
      }
    }
    if (!isGatewayTokenAuthorized && authenticatingDeviceId !== payload.device_id && !await db.isDeviceRegistered(payload.device_id)) {
      await db.insertAuditLog(auditRow(payload, "device_not_registered", "attributed station is not a known, active device", nowEpochSeconds));
      return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "attributed station is not a known, active device", retryable: false };
    }
    const headerTimestamp = Number.parseInt(request.headers["x-timestamp"], 10);
    const isHeaderValid = isGatewayTokenAuthorized && !request.headers["x-timestamp"] || !Number.isNaN(headerTimestamp) && Math.abs(nowEpochSeconds - headerTimestamp) <= config.maxTimestampDriftSeconds;
    const isPayloadValid = Math.abs(nowEpochSeconds - payload.timestamp) <= config.maxTimestampDriftSeconds;
    if (!isHeaderValid || !isPayloadValid) {
      const reason = !isHeaderValid ? "header timestamp is outside allowed drift window" : "payload timestamp is outside allowed drift window";
      await db.insertAuditLog(auditRow(payload, "expired_timestamp", reason, nowEpochSeconds));
      return {
        ok: false,
        error_code: "TIMESTAMP_OUT_OF_WINDOW",
        message: reason,
        retryable: false
      };
    }
    const valuesInRange = kind === "soil" ? soilValuesInRange(payload) : inRange(payload.salinity, 0, 50) && inRange(payload.water_level, -100, 1e3) && optionalInRange(payload.salinity_ppm, 0, 1e5) && optionalInRange(payload.sensor_height_cm, 0, 1e4) && optionalInRange(payload.distance_cm, -100, 1e4) && optionalInRange(payload.ec_ms_cm, 0, 20) && optionalInRange(payload.ec_us_cm, 0, 2e4) && optionalInRange(payload.temperature_c, -10, 80) && optionalInRange(payload.tds_ppm, 0, 1e5) && (typeof payload.battery_voltage !== "number" || inRange(payload.battery_voltage, 2.5, 5.5)) && optionalInRange(payload.battery_percent, 0, 100) && (typeof payload.signal_strength_dbm !== "number" || inRange(payload.signal_strength_dbm, -130, -30));
    if (!valuesInRange) {
      await db.insertAuditLog(auditRow(payload, "value_out_of_range", "value out of accepted range", nowEpochSeconds));
      return { ok: false, error_code: "VALUE_OUT_OF_RANGE", message: "value out of accepted range", retryable: false };
    }
    if (isFaulty(payload)) {
      await db.insertAuditLog(auditRow(payload, "sensor_fault", "sensor fault reported by node", nowEpochSeconds));
      await db.insertEvent({
        station_id: payload.device_id,
        event_type: "SENSOR_FAULT",
        severity: "critical",
        message_id: payload.message_id,
        details: { fault_flags: payload.fault_flags, sensor_status: payload.sensor_status },
        timestamp: nowEpochSeconds
      });
      return { ok: false, error_code: "SENSOR_FAULT", message: "sensor fault reported by node", retryable: false };
    }
    const status = kind === "soil" ? await db.insertSoilReading({
      message_id: payload.message_id,
      station_id: payload.device_id,
      air_temp_c: payload.soil?.air_temp_c ?? null,
      air_humidity_pct: payload.soil?.air_humidity_pct ?? null,
      soil_temp_c: payload.soil?.soil_temp_c ?? null,
      soil_moisture_pct: payload.soil?.soil_moisture_pct ?? null,
      soil_ec_ms_cm: payload.soil?.soil_ec_ms_cm ?? null,
      soil_ec_us_cm: payload.soil?.soil_ec_us_cm ?? null,
      soil_salinity: payload.soil?.soil_salinity ?? null,
      soil_tds: payload.soil?.soil_tds ?? null,
      soil_ph: payload.soil?.soil_ph ?? null,
      sequence: payload.sequence ?? null,
      summary_minutes: payload.summary_minutes ?? null,
      crop: payload.crop ?? null,
      fault_flags: payload.fault_flags,
      timestamp: payload.timestamp,
      raw_station_payload: payload.raw_station_payload ?? null
    }) : await db.insertEnvironmental({
      message_id: payload.message_id,
      station_id: payload.device_id,
      salinity: payload.salinity,
      salinity_ppm: payload.salinity_ppm ?? null,
      water_level: payload.water_level,
      sensor_height_cm: payload.sensor_height_cm ?? null,
      distance_cm: payload.distance_cm ?? null,
      ec_ms_cm: payload.ec_ms_cm ?? null,
      ec_us_cm: payload.ec_us_cm ?? null,
      temperature_c: payload.temperature_c ?? null,
      tds_ppm: payload.tds_ppm ?? null,
      sequence: payload.sequence ?? null,
      summary_minutes: payload.summary_minutes ?? null,
      fault_flags: payload.fault_flags,
      ec_probe_status: payload.sensor_status.ec_probe,
      ultrasonic_status: payload.sensor_status.ultrasonic,
      timestamp: payload.timestamp,
      raw_station_payload: payload.raw_station_payload ?? null
    });
    if (status === "inserted") {
      try {
        if (typeof payload.battery_voltage === "number" || typeof payload.battery_percent === "number" || typeof payload.signal_strength_dbm === "number") {
          await db.insertHealth({
            station_id: payload.device_id,
            battery_voltage: payload.battery_voltage ?? null,
            battery_percent: payload.battery_percent ?? null,
            signal_strength_dbm: payload.signal_strength_dbm ?? null,
            firmware_version: payload.firmware_version,
            timestamp: payload.timestamp
          });
        }
        await db.touchDeviceSeen(payload.device_id, payload.firmware_version, nowEpochSeconds);
        await emitAlertEvents(db, payload, config, nowEpochSeconds);
        await db.insertAuditLog(auditRow(payload, "accepted", "payload inserted", nowEpochSeconds));
      } catch (sideEffectError) {
        const message = sideEffectError instanceof Error ? sideEffectError.message : "unexpected error";
        await db.insertAuditLog(auditRow(payload, "accepted", `payload inserted; side effect failed: ${message}`, nowEpochSeconds)).catch(() => void 0);
      }
    } else {
      await db.insertAuditLog(auditRow(payload, "duplicate", "duplicate message_id ignored", nowEpochSeconds));
    }
    const ota = await db.getActiveOta(payload.device_id).catch(() => ({ update_available: false }));
    return {
      ok: true,
      status,
      station_id: payload.device_id,
      message_id: payload.message_id,
      server_timestamp: nowEpochSeconds,
      ota
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await db.insertAuditLog({
      message_id: request.payload.message_id ?? "",
      device_id: request.payload.device_id ?? "",
      status: "internal_error",
      reason: message,
      timestamp: nowEpochSeconds
    }).catch(() => void 0);
    return { ok: false, error_code: "INTERNAL_ERROR", message, retryable: true };
  }
}

// src/httpHandler.ts
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function positiveNumber(value) {
  const numberValue = finiteNumber(value);
  return numberValue !== void 0 && numberValue > 0 ? numberValue : void 0;
}
function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function normalizeStationSummaryPayload(raw, nowEpochSeconds) {
  if (raw.type !== "station_summary") {
    return null;
  }
  const stationId = stringValue(raw.station_id);
  const messageId = stringValue(raw.message_id);
  const firmwareVersion = stringValue(raw.firmware_version);
  if (!stationId || !messageId || !firmwareVersion) {
    return null;
  }
  const timestamp = finiteNumber(raw.timestamp) ?? nowEpochSeconds;
  const base = {
    contract_version: "v1",
    device_id: stationId,
    message_id: messageId,
    timestamp,
    sequence: finiteNumber(raw.sequence),
    summary_minutes: finiteNumber(raw.summary_minutes),
    firmware_version: firmwareVersion,
    fault_flags: 0,
    battery_voltage: positiveNumber(raw.battery_voltage_v),
    battery_percent: finiteNumber(raw.battery_percent),
    raw_station_payload: raw
  };
  if (stationId === "STATION_02") {
    return {
      ...base,
      reading_kind: "soil",
      crop: stringValue(raw.crop),
      soil: {
        air_temp_c: nullableNumber(raw.air_temp_c),
        air_humidity_pct: nullableNumber(raw.air_humidity_pct),
        soil_temp_c: nullableNumber(raw.soil_temp_c),
        soil_moisture_pct: nullableNumber(raw.soil_moisture_pct),
        soil_ec_ms_cm: nullableNumber(raw.soil_ec_ms_cm),
        soil_ec_us_cm: nullableNumber(raw.soil_ec_us_cm),
        soil_salinity: nullableNumber(raw.soil_salinity),
        soil_tds: nullableNumber(raw.soil_tds),
        soil_ph: nullableNumber(raw.soil_ph)
      }
    };
  }
  if (stationId === "STATION_01") {
    const ecMsCm = finiteNumber(raw.ec_ms_cm);
    const ecUsCm = finiteNumber(raw.ec_us_cm);
    const waterLevel = finiteNumber(raw.water_level_cm);
    const distance = finiteNumber(raw.distance_cm);
    return {
      ...base,
      reading_kind: "water",
      salinity: finiteNumber(raw.salinity_ppt),
      salinity_ppm: finiteNumber(raw.salinity_ppm),
      water_level: waterLevel,
      sensor_height_cm: finiteNumber(raw.sensor_height_cm),
      distance_cm: distance,
      ec_ms_cm: ecMsCm,
      ec_us_cm: ecUsCm,
      temperature_c: finiteNumber(raw.temperature_c),
      tds_ppm: finiteNumber(raw.tds_ppm),
      sensor_status: {
        ec_probe: ecMsCm !== void 0 || ecUsCm !== void 0 ? "ok" : "fault",
        ultrasonic: waterLevel !== void 0 || distance !== void 0 ? "ok" : "fault"
      }
    };
  }
  return null;
}
function normalizePayload(payload, nowEpochSeconds) {
  const rawPayload = payload;
  const stationPayload = rawPayload.raw_station_payload && typeof rawPayload.raw_station_payload === "object" && !Array.isArray(rawPayload.raw_station_payload) ? rawPayload.raw_station_payload : rawPayload;
  const stationSummary = normalizeStationSummaryPayload(stationPayload, nowEpochSeconds);
  return stationSummary ?? payload;
}
function ingestResponseToHttp(result) {
  if (!result.ok) {
    const statusByCode = {
      MISSING_FIELD: 400,
      INVALID_SIGNATURE: 401,
      TIMESTAMP_OUT_OF_WINDOW: 400,
      DEVICE_NOT_REGISTERED: 404,
      VALUE_OUT_OF_RANGE: 400,
      SENSOR_FAULT: 422,
      INTERNAL_ERROR: 500
    };
    return { status: statusByCode[result.error_code], body: { ...result } };
  }
  return { status: 200, body: { ...result } };
}
async function handleIngestRequest(payload, headers, db, config, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  const normalizedPayload = normalizePayload(payload, nowEpochSeconds);
  const request = {
    headers: {
      "x-device-id": headers["x-device-id"] ?? "",
      "x-timestamp": headers["x-timestamp"] ?? "",
      "x-signature": headers["x-signature"] ?? "",
      "x-contract-version": headers["x-contract-version"] ?? "",
      "x-gateway-token": headers["x-gateway-token"] ?? ""
    },
    payload: normalizedPayload
  };
  const result = await ingestTelemetry(request, db, config, nowEpochSeconds);
  return ingestResponseToHttp(result);
}
async function handleIngestFromEnv(payload, headers, db, env, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  return handleIngestRequest(payload, headers, db, resolveIngestConfig(env), nowEpochSeconds);
}

// src/supabaseDb.ts
var SupabaseDb = class _SupabaseDb {
  constructor(supabaseUrl, serviceRoleKey) {
    this.supabaseUrl = supabaseUrl;
    this.serviceRoleKey = serviceRoleKey;
  }
  static fromEnv(env = process.env) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing Supabase env vars");
    }
    return new _SupabaseDb(url.replace(/\/$/, ""), key);
  }
  async request(table, method, body, query = "") {
    const headers = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}${query}`, {
      method,
      headers,
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }
  async getDeviceSecret(deviceId) {
    const result = await this.request(
      "devices",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&select=device_secret,status&limit=1`
    );
    if (!result.ok) {
      return null;
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    if (rows[0].status && rows[0].status !== "active") {
      return null;
    }
    return rows[0].device_secret ?? null;
  }
  async isDeviceRegistered(deviceId) {
    const result = await this.request(
      "devices",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&select=status&limit=1`
    );
    if (!result.ok) {
      return false;
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    return !rows[0].status || rows[0].status === "active";
  }
  async insertEnvironmental(row) {
    const result = await this.request("environmental_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      salinity: row.salinity,
      salinity_ppm: row.salinity_ppm,
      water_level: row.water_level,
      sensor_height_cm: row.sensor_height_cm,
      distance_cm: row.distance_cm,
      ec_ms_cm: row.ec_ms_cm,
      ec_us_cm: row.ec_us_cm,
      temperature_c: row.temperature_c,
      tds_ppm: row.tds_ppm,
      sequence: row.sequence,
      summary_minutes: row.summary_minutes,
      fault_flags: row.fault_flags,
      ec_probe_status: row.ec_probe_status,
      ultrasonic_status: row.ultrasonic_status,
      timestamp: new Date(row.timestamp * 1e3).toISOString(),
      raw_station_payload: row.raw_station_payload
    });
    if (result.ok) {
      return "inserted";
    }
    if (result.status === 409 || result.text.includes("duplicate") || result.text.includes("23505")) {
      return "duplicate_ignored";
    }
    throw new Error(result.text || `insert failed with status ${result.status}`);
  }
  async insertSoilReading(row) {
    const result = await this.request("soil_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      air_temp_c: row.air_temp_c,
      air_humidity_pct: row.air_humidity_pct,
      soil_temp_c: row.soil_temp_c,
      soil_moisture_pct: row.soil_moisture_pct,
      soil_ec_ms_cm: row.soil_ec_ms_cm,
      soil_ec_us_cm: row.soil_ec_us_cm,
      soil_salinity: row.soil_salinity,
      soil_tds: row.soil_tds,
      soil_ph: row.soil_ph,
      sequence: row.sequence,
      summary_minutes: row.summary_minutes,
      crop: row.crop,
      fault_flags: row.fault_flags,
      timestamp: new Date(row.timestamp * 1e3).toISOString(),
      raw_station_payload: row.raw_station_payload
    });
    if (result.ok) {
      return "inserted";
    }
    if (result.status === 409 || result.text.includes("duplicate") || result.text.includes("23505")) {
      return "duplicate_ignored";
    }
    throw new Error(result.text || `insert failed with status ${result.status}`);
  }
  async insertEvent(row) {
    const result = await this.request("environmental_events", "POST", {
      station_id: row.station_id,
      event_type: row.event_type,
      severity: row.severity,
      message_id: row.message_id,
      details: row.details ?? {},
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    });
    if (!result.ok) {
      throw new Error(result.text || `event insert failed with status ${result.status}`);
    }
  }
  async insertAuditLog(row) {
    await this.request("ingestion_audit_logs", "POST", {
      message_id: row.message_id,
      device_id: row.device_id,
      status: row.status,
      reason: row.reason,
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    }).catch(() => void 0);
  }
  async insertHealth(row) {
    const result = await this.request("station_health_logs", "POST", {
      station_id: row.station_id,
      battery_voltage: row.battery_voltage,
      battery_percent: row.battery_percent,
      signal_strength_dbm: row.signal_strength_dbm,
      firmware_version: row.firmware_version,
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    });
    if (!result.ok) {
      throw new Error(result.text || `health insert failed with status ${result.status}`);
    }
  }
  async touchDeviceSeen(deviceId, firmwareVersion, seenAt) {
    await this.request(
      "devices",
      "PATCH",
      { last_seen_at: new Date(seenAt * 1e3).toISOString(), firmware_version: firmwareVersion },
      `?device_id=eq.${encodeURIComponent(deviceId)}`
    ).catch(() => void 0);
  }
  async getActiveOta(deviceId) {
    const result = await this.request(
      "firmware_updates",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&active=eq.true&select=target_version,binary_url,sha256,size_bytes&limit=1`
    );
    if (!result.ok) {
      return { update_available: false };
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { update_available: false };
    }
    return {
      update_available: true,
      target_version: rows[0].target_version,
      binary_url: rows[0].binary_url,
      sha256: rows[0].sha256,
      size_bytes: rows[0].size_bytes
    };
  }
};

// src/edgeEntry.ts
async function processIngestHttp(payload, headers, env, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  const db = SupabaseDb.fromEnv(env);
  return handleIngestFromEnv(payload, headers, db, env, nowEpochSeconds);
}
export {
  processIngestHttp
};
