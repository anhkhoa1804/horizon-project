import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { applyDevSoilFixture, soilFixtureEnabled, DEV_SOIL_FIXTURE_FLAG } from "../lib/dev/soilFixture";
import { getObservatoryViewModel } from "../lib/monitoring/buildObservatory";
import { vi } from "../lib/i18n/vi";

const ON = { [DEV_SOIL_FIXTURE_FLAG]: "1", NODE_ENV: "development" } as Record<string, string>;

async function realModelWithoutSoil() {
  // "real" mode with no repository data resolves to nulls; if the environment has no database this
  // falls back to the same empty shape the page renders.
  return getObservatoryViewModel("real", vi);
}

describe("development soil fixture (STATION_02)", () => {
  it("is OFF by default", () => {
    assert.equal(soilFixtureEnabled({}), false);
    assert.equal(soilFixtureEnabled({ NODE_ENV: "development" }), false);
    assert.equal(soilFixtureEnabled({ [DEV_SOIL_FIXTURE_FLAG]: "0", NODE_ENV: "development" }), false);
    assert.equal(soilFixtureEnabled({ [DEV_SOIL_FIXTURE_FLAG]: "true", NODE_ENV: "development" }), false, "only the explicit value 1 enables it");
  });

  it("can never be enabled in production or on Vercel, even with the flag set", () => {
    assert.equal(soilFixtureEnabled({ ...ON, NODE_ENV: "production" }), false);
    assert.equal(soilFixtureEnabled({ ...ON, VERCEL: "1" }), false);
    assert.equal(soilFixtureEnabled({ ...ON, VERCEL_ENV: "preview" }), false);
    assert.equal(soilFixtureEnabled({ ...ON, VERCEL_ENV: "production" }), false);
  });

  it("returns the very same model when disabled (no silent fallback)", async () => {
    const model = await realModelWithoutSoil();
    const r = applyDevSoilFixture(model, { NODE_ENV: "production", [DEV_SOIL_FIXTURE_FLAG]: "1" });
    assert.equal(r.active, false);
    assert.equal(r.model, model);
    const r2 = applyDevSoilFixture(model, {});
    assert.equal(r2.model, model);
  });

  it("fills only STATION_02 soil when enabled, labelled as a fixture, leaving water and gateway untouched", async () => {
    const model = await realModelWithoutSoil();
    const before = model.stations.find((s) => s.id === "STATION_02");
    if (!before || before.primary.value !== null) return; // environment already has real soil data
    const r = applyDevSoilFixture(model, ON);
    assert.equal(r.active, true);
    const s2 = r.model.stations.find((s) => s.id === "STATION_02")!;
    assert.equal(s2.primary.value, "34.2");
    for (const m of [s2.primary, ...s2.environment.flatMap((g) => g.metrics)]) {
      assert.equal(m.provenance.origin, "demo", "fixture values must never carry a telemetry origin");
      assert.match(m.provenance.source ?? "", /DEV FIXTURE/);
    }
    const soilGroup = s2.environment.find((g) => g.domain === "soil")!;
    assert.equal(soilGroup.metrics.find((m) => m.labelKey === "ec")?.value, "1.46");
    assert.equal(soilGroup.metrics.find((m) => m.labelKey === "temperature")?.value, "28.6", "soil temperature, not air");
    const airGroup = s2.environment.find((g) => g.domain === "air")!;
    assert.equal(airGroup.metrics.find((m) => m.labelKey === "temperature")?.value, "30.1");
    for (const other of model.stations.filter((s) => s.id !== "STATION_02")) {
      assert.equal(r.model.stations.find((s) => s.id === other.id), other, `${other.id} must be untouched`);
    }
    assert.equal(r.model.mode, "real");
    assert.equal(r.model.series, model.series, "historical charts must not receive fixture points");
    assert.equal(r.model.alerts, model.alerts, "alerts must not be generated from fixtures");
    // the original is not mutated
    assert.equal(model.stations.find((s) => s.id === "STATION_02")!.primary.value, null);
  });

  it("never overrides genuine data: once STATION_02 reports, the live path takes over", async () => {
    const model = await realModelWithoutSoil();
    const i = model.stations.findIndex((s) => s.id === "STATION_02");
    if (i < 0) return;
    const live = structuredClone(model);
    live.stations[i].primary = { ...live.stations[i].primary, value: "41.0", unit: "%", provenance: { origin: "telemetry", source: "Quan trắc trực tiếp" } };
    const r = applyDevSoilFixture(live, ON);
    assert.equal(r.active, false);
    assert.equal(r.model, live);
    assert.equal(r.model.stations[i].primary.value, "41.0");
  });

  it("does nothing in demo mode (demo already labels its own synthetic data)", async () => {
    const demo = await getObservatoryViewModel("demo", vi);
    assert.equal(applyDevSoilFixture(demo, ON).model, demo);
  });

  it("is referenced by the dashboard page only — never by repositories, API routes, exports, alerts, admin or ingestion", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", "tests"].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name)) {
          const rel = path.relative(root, full).split(path.sep).join("/");
          if (rel === "lib/dev/soilFixture.ts") continue;
          if (/dev\/soilFixture|DEV_SOIL_FIXTURE|applyDevSoilFixture/.test(fs.readFileSync(full, "utf8"))) offenders.push(rel);
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, ["app/dashboard/page.tsx"]);
    const edge = path.join(root, "..", "..", "services", "edge-ingestion");
    if (fs.existsSync(edge)) {
      const grep = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" ? [] : grep(path.join(d, e.name))) : /soilFixture|DEV_SOIL_FIXTURE/.test(fs.readFileSync(path.join(d, e.name), "utf8")) ? [e.name] : []);
      assert.deepEqual(grep(edge), [], "the ingestion service must not know about fixtures");
    }
  });

  it("keeps the dev flag out of every deployment config and env template", () => {
    const repo = path.join(process.cwd(), "..", "..");
    for (const f of ["vercel.json", "apps/web/vercel.json", ".env.example", "apps/web/.env.example", "apps/web/.env.production"]) {
      const full = path.join(repo, f);
      if (fs.existsSync(full)) assert.ok(!/HORIZON_DEV_SOIL_FIXTURE\s*=\s*1|"HORIZON_DEV_SOIL_FIXTURE"/.test(fs.readFileSync(full, "utf8")), `${f} enables the fixture`);
    }
  });
});
