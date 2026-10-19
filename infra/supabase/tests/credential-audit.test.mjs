import test from "node:test";
import assert from "node:assert/strict";
import { auditRequiredCredentials, configuredSecret, inspectHostedSecretNames } from "../credential-audit.mjs";

test("repository placeholders and empty credentials are rejected without echoing values", () => {
  assert.equal(configuredSecret("gateway-secret-01"), false);
  assert.equal(configuredSecret("replace-me"), false);
  assert.equal(configuredSecret(""), false);
  const issues = auditRequiredCredentials({
    env: { GATEWAY_INGEST_TOKEN: "replace-me", REMOTE_CONFIG_STATION_01_KEY: "", REMOTE_CONFIG_STATION_02_KEY: "ok-012345678901234567890123456789" },
    gatewayHeaderText: "#define GATEWAY_INGEST_TOKEN_VALUE \"test-only-gateway-token\"",
  });
  assert.equal(issues.length, 7);
  assert.ok(issues.some((issue) => issue.credentialClass === "gateway ingest token"));
  assert.ok(issues.some((issue) => issue.credentialClass === "station HMAC key (STATION_01)"));
  assert.ok(issues.some((issue) => issue.credentialClass === "station HMAC key (STATION_02)"));
  assert.ok(issues.every((issue) => !JSON.stringify(issue).includes("test-only-gateway-token")));
});

test("fully configured deployment values produce no credential diagnostics", () => {
  const keys = {
    GATEWAY_INGEST_TOKEN: "g".repeat(40),
    REMOTE_CONFIG_STATION_01_KEY: "a".repeat(40),
    REMOTE_CONFIG_STATION_02_KEY: "b".repeat(40),
  };
  const gatewayHeaderText = Object.entries(keys)
    .map(([name, value]) => `#define ${name}_VALUE \"${value}\"`)
    .join("\n");
  const stationHeaders = {
    station_01: `#define REMOTE_CONFIG_KEY_VALUE "${keys.REMOTE_CONFIG_STATION_01_KEY}"`,
    station_02: `#define REMOTE_CONFIG_KEY_VALUE "${keys.REMOTE_CONFIG_STATION_02_KEY}"`,
  };
  assert.deepEqual(auditRequiredCredentials({ env: keys, gatewayHeaderText, stationHeaders }), []);
});

test("mismatched runtime and device keys fail with names only", () => {
  const env = {
    GATEWAY_INGEST_TOKEN: "g".repeat(40),
    REMOTE_CONFIG_STATION_01_KEY: "a".repeat(40),
    REMOTE_CONFIG_STATION_02_KEY: "b".repeat(40),
  };
  const gatewayHeaderText = `#define GATEWAY_INGEST_TOKEN_VALUE "${env.GATEWAY_INGEST_TOKEN}"\n#define REMOTE_CONFIG_STATION_01_KEY_VALUE "${"x".repeat(40)}"\n#define REMOTE_CONFIG_STATION_02_KEY_VALUE "${env.REMOTE_CONFIG_STATION_02_KEY}"`;
  const stationHeaders = {
    station_01: `#define REMOTE_CONFIG_KEY_VALUE "${env.REMOTE_CONFIG_STATION_01_KEY}"`,
    station_02: `#define REMOTE_CONFIG_KEY_VALUE "${env.REMOTE_CONFIG_STATION_02_KEY}"`,
  };
  const issues = auditRequiredCredentials({ env, gatewayHeaderText, stationHeaders });
  assert.equal(issues.length, 1);
  assert.match(issues[0].reason, /do not match/);
  assert.ok(!JSON.stringify(issues).includes("x".repeat(40)));
});

test("hosted secret inventory checks names without exposing secret values", () => {
  const missing = inspectHostedSecretNames([
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: "do-not-print" },
  ]);
  assert.deepEqual(missing, { verified: true, missing: ["GATEWAY_INGEST_TOKEN"] });
  assert.ok(!JSON.stringify(missing).includes("do-not-print"));
  assert.deepEqual(
    inspectHostedSecretNames({ secrets: [{ name: "GATEWAY_INGEST_TOKEN", value: "do-not-print" }] }),
    { verified: true, missing: [] },
  );
  assert.deepEqual(inspectHostedSecretNames({ error: "unavailable" }), { verified: false, missing: [] });
});
