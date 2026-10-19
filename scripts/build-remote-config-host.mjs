import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  build = path.join(root, "firmware/esp32-node/build");
mkdirSync(build, { recursive: true });
const header = path.join(build, "ArduinoJson.h"),
  digest = "a05ac98f4481d2398c103ca5ffcce8e2fcd7fa2fa1d8d9f38d5757454f448d97";
if (!existsSync(header)) {
  const response = await fetch(
    "https://github.com/bblanchon/ArduinoJson/releases/download/v7.4.2/ArduinoJson-v7.4.2.h",
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw Error("ArduinoJson dependency fetch failed");
  writeFileSync(header, Buffer.from(await response.arrayBuffer()));
}
if (createHash("sha256").update(readFileSync(header)).digest("hex") !== digest)
  throw Error("ArduinoJson 7.4.2 checksum mismatch");
const compiler =
  process.env.CXX ??
  (process.platform === "win32" && existsSync("C:/msys64/mingw64/bin/g++.exe")
    ? "C:/msys64/mingw64/bin/g++.exe"
    : "g++");
for (const source of ["remote_config_host", "remote_gateway_host", "simple_telemetry_host"]) {
  const args = [
    "-std=c++17",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-Ifirmware/esp32-node/tests/host",
    "-Ifirmware/esp32-node/build",
    `firmware/esp32-node/tests/${source}.cpp`,
    "-o",
    path.join(build, source + (process.platform === "win32" ? ".exe" : "")),
    "-lcrypto",
  ];
  const result = spawnSync(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "Compiled production station/gateway configuration handlers and telemetry parser/mapping for host simulation.",
);
