import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const gatewaySource = readFileSync(
  new URL("../src/gateway/gateway.ino", import.meta.url),
  "utf8",
);

const testToken = "<test-token-not-secret>";

function tokenHeader(token) {
  return `x-gateway-token: ${token}`;
}

function sendAtBytes(command) {
  return `${command}\r\n`;
}

test("gateway USERDATA contains exactly one token header", () => {
  const header = tokenHeader(testToken);

  assert.equal(header, `x-gateway-token: ${testToken}`);
  assert.equal(header.includes("x-contract-version"), false);
  assert.equal(header.includes("User-Agent:"), false);
  assert.equal(header.includes("\\r"), false);
  assert.equal(header.includes("\\n"), false);
  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
});

test("gateway skips User-Agent and emits a single-line USERDATA token header", () => {
  const header = tokenHeader(testToken);
  const userdataCommand = `AT+HTTPPARA="USERDATA","${header}"`;

  assert.equal(
    userdataCommand,
    `AT+HTTPPARA="USERDATA","x-gateway-token: ${testToken}"`,
  );
  assert.equal(userdataCommand.includes("\\r\\n"), false);
  assert.equal(userdataCommand.includes("x-contract-version"), false);
  assert.equal(userdataCommand.includes("User-Agent:"), false);
  assert.equal(userdataCommand.includes("\r"), false);
  assert.equal(userdataCommand.includes("\n"), false);
});

test("gateway USERDATA UART stream has only the sendAt final CRLF", () => {
  const userdataCommand = `AT+HTTPPARA="USERDATA","${tokenHeader(testToken)}"`;
  const uartBytes = sendAtBytes(userdataCommand);

  assert.equal(
    uartBytes,
    `AT+HTTPPARA="USERDATA","x-gateway-token: ${testToken}"\r\n`,
  );
  assert.equal(uartBytes.includes("\\r\\n"), false);
  assert.equal(uartBytes.split("\r\n").length, 2);
  assert.deepEqual(uartBytes.split("\r\n"), [
    `AT+HTTPPARA="USERDATA","x-gateway-token: ${testToken}"`,
    "",
  ]);
});

test("firmware builds one token header from the configured secret", () => {
  const builder = gatewaySource.match(
    /String buildGatewayTokenHeader\(const char \*token\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(builder, "token header builder must exist");
  assert.match(builder, /header \+= "x-gateway-token: ";/);
  assert.doesNotMatch(builder, /x-contract-version/);
  assert.doesNotMatch(builder, /User-Agent/);
  assert.doesNotMatch(builder, /\\r|\\n/);
  assert.match(gatewaySource, /headerCommand \+= headerBlock;/);

  const setter = gatewaySource.match(
    /bool setGatewayHttpHeaders\(\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(setter, "header setter must exist");
  assert.doesNotMatch(setter, /AT\+HTTPPARA=\\"UA\\"/);
  assert.doesNotMatch(setter, /User-Agent/);
  assert.match(setter, /buildGatewayTokenHeader\(GATEWAY_INGEST_TOKEN\)/);
  assert.doesNotMatch(setter, /x-contract-version/);
  assert.match(setter, /return headerAccepted;/);

  const diagnostic = gatewaySource.match(
    /void printSafeGatewayHeaderDiagnostic\(\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(diagnostic, "safe USERDATA diagnostic must exist");
  assert.match(diagnostic, /ua_parameter=skipped/);
  assert.match(diagnostic, /userdata_mode=single-token-header/);
  assert.match(diagnostic, /userdata_header_count=1/);
  assert.match(diagnostic, /userdata_embedded_crlf=no/);
  assert.doesNotMatch(diagnostic, /GATEWAY_INGEST_TOKEN/);
  assert.doesNotMatch(diagnostic, /x-gateway-token/);
});

test("firmware emits only safe token presence, length, and SHA-256 fingerprint diagnostics", () => {
  const sample = "0123456789abcdef0123456789abcdef01234567890";
  const fingerprint = createHash("sha256").update(sample, "utf8").digest("hex");

  assert.equal(fingerprint, "ade057d13c6d706c43f76999cfee83080d095f4d4dba96e0d96ffd32f7f1bb5c");
  assert.match(gatewaySource, /#include <mbedtls\/sha256\.h>/);
  assert.match(gatewaySource, /mbedtls_sha256_init\(&context\);/);
  assert.match(gatewaySource, /mbedtls_sha256_starts\(&context, 0\);/);
  assert.match(gatewaySource, /mbedtls_sha256_update\(&context,/);
  assert.match(gatewaySource, /mbedtls_sha256_finish\(&context, digest\);/);
  assert.match(gatewaySource, /mbedtls_sha256_free\(&context\);/);
  const setter = gatewaySource.match(
    /bool setGatewayHttpHeaders\(\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(setter, "header setter must exist");
  assert.match(setter, /token_present=%s token_length=%u/);
  assert.match(setter, /token_fingerprint=%s/);
  assert.match(setter, /gatewayTokenFingerprint\(GATEWAY_INGEST_TOKEN\)/);
  assert.doesNotMatch(setter, /Serial\.print.*GATEWAY_INGEST_TOKEN/);
  assert.match(gatewaySource, /compact\.indexOf\("\\"auth_diagnostic\\""\) >= 0 \|\|/);
  assert.match(gatewaySource, /compact\.indexOf\("\\"base_field_diagnostic\\""\) >= 0/);
  assert.match(gatewaySource, /const size_t maxLogLength = guardedDiagnostic \? 1024 : 240/);
  assert.match(gatewaySource, /min\(responseLength, 1024\)/);
});
