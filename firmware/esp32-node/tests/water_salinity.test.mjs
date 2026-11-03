import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const src = readFileSync(new URL("../src/trạm 1.ino", import.meta.url), "utf8");

test("station 1 never derives salinity from EC (I-22)", () => {
  assert.ok(!/ecMsCm\s*\*\s*0\.64f?/.test(src), "EC x 0.64 fallback must not exist");
  assert.match(src, /horizon::salinityPptFromRegister\(\s*salinity\.ok/);
  assert.match(src, /#include "shared\/water_salinity\.h"/);
  assert.match(src, /horizon::filteredAverageFinite/);
});

test("host build of the salinity semantics passes", (t) => {
  const bin = path.join(tmpdir(), `water_salinity_host_${process.pid}`);
  const cpp = new URL("./water_salinity_host.cpp", import.meta.url).pathname;
  try {
    execFileSync(process.env.CXX || "g++", ["-std=c++17", "-Wall", "-Wextra", "-o", bin, cpp]);
  } catch (error) {
    if (error.code === "ENOENT") return t.skip("no C++ compiler on this machine");
    throw error;
  }
  const out = execFileSync(bin, { encoding: "utf8" });
  assert.match(out, /all assertions passed/);
});
