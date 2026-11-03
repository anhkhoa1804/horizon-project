const PLACEHOLDER_PATTERNS = [
  /^gateway-secret-0[1-6]$/i,
  /^station-secret-0[1-6]$/i,
  /^replace[-_ ]?me$/i,
  /^change[-_ ]?me$/i,
  /^example$/i,
  /^placeholder$/i,
  /^test[-_ ]only/i,
];

export function configuredSecret(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const normalized = value.trim();
  return normalized.length >= 32 && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function headerSecret(text, macro) {
  const match = text?.match(new RegExp(`^\\s*#define\\s+${macro}\\s+(.+?)\\s*$`, "m"));
  return match?.[1]?.replace(/^['"]|['"]$/g, "").trim();
}

/** Return safe credential diagnostics; never include a supplied value. */
export function auditRequiredCredentials({ env, gatewayHeaderText = null, stationHeaders = {} }) {
  const checks = [
    {
      credentialClass: "gateway ingest token",
      name: "GATEWAY_INGEST_TOKEN",
      source: "apps/web runtime and Supabase Edge Function secret configuration",
      value: env.GATEWAY_INGEST_TOKEN,
    },
    {
      credentialClass: "station HMAC key (STATION_01)",
      name: "REMOTE_CONFIG_STATION_01_KEY",
      source: "apps/web runtime, gateway_secrets.h, and station_01_config_secrets.h",
      value: env.REMOTE_CONFIG_STATION_01_KEY,
    },
    {
      credentialClass: "station HMAC key (STATION_02)",
      name: "REMOTE_CONFIG_STATION_02_KEY",
      source: "apps/web runtime, gateway_secrets.h, and station_02_config_secrets.h",
      value: env.REMOTE_CONFIG_STATION_02_KEY,
    },
  ];
  const issues = checks
    .filter((check) => !configuredSecret(check.value))
    .map(({ credentialClass, name, source }) => ({
      credentialClass,
      source,
      reason: `${name} is missing or a placeholder`,
    }));

  const headerRequirements = [
    ["GATEWAY_INGEST_TOKEN_VALUE", "GATEWAY_INGEST_TOKEN", "gateway ingest token"],
    ["REMOTE_CONFIG_STATION_01_KEY_VALUE", "REMOTE_CONFIG_STATION_01_KEY", "station HMAC key (STATION_01)", "station_01"],
    ["REMOTE_CONFIG_STATION_02_KEY_VALUE", "REMOTE_CONFIG_STATION_02_KEY", "station HMAC key (STATION_02)", "station_02"],
  ];
  for (const [macro, envName, credentialClass, stationHeaderName] of headerRequirements) {
    const raw = headerSecret(gatewayHeaderText, macro);
    if (!configuredSecret(raw)) {
      issues.push({
        credentialClass,
        source: "firmware/esp32-node/src/gateway/gateway_secrets.h (untracked deployment file)",
        reason: `${macro} is missing or a placeholder`,
      });
    } else if (configuredSecret(env[envName]) && raw !== env[envName].trim()) {
      issues.push({
        credentialClass,
        source: `apps/web runtime ${envName} and gateway_secrets.h`,
        reason: `configured sources for ${envName} do not match`,
      });
    }
    if (stationHeaderName) {
      const stationRaw = headerSecret(stationHeaders[stationHeaderName], "REMOTE_CONFIG_KEY_VALUE");
      if (!configuredSecret(stationRaw)) {
        issues.push({
          credentialClass,
          source: `firmware/esp32-node/src/${stationHeaderName}_config_secrets.h (untracked deployment file)`,
          reason: "REMOTE_CONFIG_KEY_VALUE is missing or a placeholder",
        });
      } else if (configuredSecret(env[envName]) && stationRaw !== env[envName].trim()) {
        issues.push({
          credentialClass,
          source: `apps/web runtime ${envName} and ${stationHeaderName}_config_secrets.h`,
          reason: "configured sources for the station HMAC key do not match",
        });
      }
    }
  }
  return issues;
}

/** Inspect names only; callers must never log or return rows' value fields. */
export function inspectHostedSecretNames(rows, requiredNames = ["GATEWAY_INGEST_TOKEN"]) {
  if (!Array.isArray(rows) && rows && Array.isArray(rows.secrets)) rows = rows.secrets;
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.name !== "string")) {
    return { verified: false, missing: [] };
  }
  const names = new Set(rows.map((row) => row.name));
  return { verified: true, missing: requiredNames.filter((name) => !names.has(name)) };
}
