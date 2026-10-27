import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const gw = readFileSync(new URL("../src/gateway/gateway.ino", import.meta.url), "utf8");

test("host build of the durable queue, outcome classes and session driver passes", (t) => {
  const bin = path.join(tmpdir(), `upload_queue_host_${process.pid}`);
  const cpp = new URL("./upload_queue_host.cpp", import.meta.url).pathname;
  try {
    execFileSync(process.env.CXX || "g++", ["-std=c++17", "-Wall", "-Wextra", "-Werror", "-o", bin, cpp]);
  } catch (error) {
    if (error.code === "ENOENT") return t.skip("no C++ compiler on this machine");
    throw error;
  }
  assert.match(execFileSync(bin, { encoding: "utf8" }), /upload_queue host tests passed/);
});

// Source-level guards for the wiring in gateway.ino that the host test cannot see.
test("gateway takes custody BEFORE it ACKs a station frame", () => {
  const fn = gw.slice(gw.indexOf("void handleSimpleLoRaLine("));
  const enqueue = fn.indexOf("uploadQueue->enqueue(");
  const noCustody = fn.indexOf("EnqueueResult::NoCustody");
  const ack = fn.indexOf("sendSimpleAck(station1, seq)");
  assert.ok(enqueue > 0 && noCustody > enqueue && ack > noCustody, "enqueue -> NoCustody return -> ACK, in that order");
  assert.ok(!/sendSimpleAck\(station1, seq\);\s*\/\/ ACK before any HTTP/.test(gw), "old ACK-before-everything path must be gone");
  const guard = fn.slice(noCustody, ack);
  assert.match(guard, /return;/, "NoCustody must return without ACK");
});

test("gateway no longer gates uploads on a station pair or overwrites staged frames", () => {
  for (const gone of ["pairedBatchTriggered", "pendingStation1Ready", "pendingUploadStation1", "stagePairedUpload", "servicePairedBatchUpload"]) {
    assert.ok(!gw.includes(gone), `${gone} must not exist`);
  }
});

test("a terminal HTTP answer is never counted as a successful upload", () => {
  assert.ok(!/outcome\s*!=\s*HTTP_POST_RETRY/.test(gw), "TERMINAL_REJECTION used to be treated as uploaded");
  assert.ok(!gw.includes("gatewayHeaderSerializationBlocked"), "permanent latch replaced by HoldSystemic back-off");
});

test("modem sessions keep draining LoRa and the health line has no secrets", () => {
  assert.match(gw, /modemHttpBusy && !inLoraService && loraSerial\.available\(\) > 0/);
  const health = gw.slice(gw.indexOf("static void logGatewayHealth()"), gw.indexOf("void handleSimpleLoRaLine("));
  assert.ok(!/GATEWAY_INGEST_TOKEN|SIM_APN|token|payload/i.test(health.replace(/\/\/.*$/gm, "")), "health line must not print token, APN or payload");
});
