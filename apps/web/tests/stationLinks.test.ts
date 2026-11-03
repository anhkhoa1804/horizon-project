import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { isPilotStation, OBSERVATORY_HREF, PILOT_STATION_IDS } from "@/lib/publicStations";
import { stationProfiles } from "@/lib/stationProfile";

describe("canonical station links", () => {
  it("sends every station link to the observatory anchor", () => {
    // The per-station pages (/s/:id) are gone: the observatory answers the
    // same question better, and everything those pages carried that was not
    // telemetry now sits on Home's network chapter. The hash matters — a QR
    // code on a station in the field must land on the Bento, not on the
    // Monitoring page title.
    assert.equal(OBSERVATORY_HREF, "/dashboard#observatory");
    assert.ok(OBSERVATORY_HREF.includes("#"), "the deep link must carry its anchor");
  });

  it("covers exactly the three pilot stations", () => {
    assert.deepEqual([...PILOT_STATION_IDS], ["STATION_01", "STATION_02", "STATION_03"]);
  });

  it("rejects the simulator fixtures that exist in the database", () => {
    // STATION_04/05 are seed rows, not operational hardware — they must not
    // become linkable routes.
    assert.ok(!isPilotStation("STATION_04"));
    assert.ok(!isPilotStation("STATION_05"));
    assert.ok(!isPilotStation("nonsense"));
  });

  it("has a profile for every station the network chapter renders", () => {
    for (const id of PILOT_STATION_IDS) {
      assert.ok(stationProfiles[id], `no profile for ${id}`);
      assert.ok(stationProfiles[id].name.length > 0);
    }
  });
});

describe("station link call sites", () => {
  it("builds no /s/ route anywhere — the route no longer exists", () => {
    // Guards the invariant rather than one instance of it. /s/:id survives
    // only as a redirect declared in next.config.ts; anything in app/ or
    // components/ still constructing that path would be linking through a
    // redirect hop to a page that is not coming back.
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/["'`]\/s\/\$\{/.test(src) || /["']\/s\/STATION_/.test(src)) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };

    for (const root of roots) if (fs.existsSync(root)) walk(root);

    assert.deepEqual(offenders, [], `station routes found: ${offenders.join(", ")}`);
  });

  it("routes the removed pages through redirects rather than deleting them", () => {
    // Printed QR codes and any existing inbound link must not 404.
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    assert.match(config, /source: "\/about", destination: "\/"/, "/about must redirect to Home");
    assert.match(
      config,
      /source: "\/s\/:stationId", destination: "\/dashboard#observatory"/,
      "/s/:id must redirect to the observatory anchor",
    );
    // 307, not 308 — see the note in next.config.ts.
    assert.ok(!/permanent: true/.test(config), "these redirects must stay non-permanent");
  });

  it("no longer ships the routes themselves", () => {
    assert.ok(!fs.existsSync(path.join(process.cwd(), "app", "about")), "/about page is back");
    assert.ok(!fs.existsSync(path.join(process.cwd(), "app", "s")), "/s/[stationId] page is back");
  });
});
