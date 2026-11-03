import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { CON_HO } from "@/lib/geo";
import { getExternalWeather, getExternalWeatherHistory24h } from "@/lib/external/weather";

/**
 * The adapter's contract is that it NEVER invents a value: every failure mode
 * resolves to `null` so the UI can say "unavailable" instead of showing a
 * plausible-looking number that came from nowhere. These tests exercise each
 * failure path against a stubbed `fetch`.
 */

const realFetch = globalThis.fetch;

function stubFetch(impl: typeof globalThis.fetch) {
  globalThis.fetch = impl;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("external weather 24h history adapter", () => {
  it("parses hourly Open-Meteo history for the chart", async () => {
    stubFetch(async () =>
      jsonResponse({
        hourly: {
          time: ["2026-09-02T22:00", "2026-09-02T23:00"],
          temperature_2m: [27.5, 27.1],
          relative_humidity_2m: [77, 79],
          wind_speed_10m: [10.5, 11.0],
          precipitation: [0, 0.2],
        },
      }),
    );

    const result = await getExternalWeatherHistory24h();
    assert.ok(result);
    assert.equal(result.points.length, 2);
    assert.deepEqual(result.points[1], {
      time: "2026-09-02T23:00",
      temperatureC: 27.1,
      humidityPct: 79,
      windKph: 11.0,
      precipitationMm: 0.2,
    });
  });

  it("requests 23 past hours plus the current forecast hour", async () => {
    let requested = "";
    stubFetch(async (input) => {
      requested = String(input);
      return jsonResponse({ hourly: { time: ["2026-09-03T01:00"], temperature_2m: [26.4] } });
    });

    await getExternalWeatherHistory24h();
    assert.match(requested, /hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation/);
    assert.match(requested, /past_hours=23/);
    assert.match(requested, /forecast_hours=1/);
    assert.match(requested, /wind_speed_unit=kmh/);
  });

  it("returns null when all hourly fields are missing", async () => {
    stubFetch(async () =>
      jsonResponse({
        hourly: {
          time: ["2026-09-02T22:00"],
          temperature_2m: [null],
          relative_humidity_2m: ["n/a"],
          wind_speed_10m: [undefined],
          precipitation: [NaN],
        },
      }),
    );

    assert.equal(await getExternalWeatherHistory24h(), null);
  });
});

describe("external weather adapter", () => {
  it("parses a well-formed upstream response", async () => {
    stubFetch(async () =>
      jsonResponse({
        current: {
          time: "2026-08-22T09:45",
          temperature_2m: 30.4,
          relative_humidity_2m: 71,
          wind_speed_10m: 15.6,
          precipitation: 0,
        },
      }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.temperatureC, 30.4);
    assert.equal(result.humidityPct, 71);
    assert.equal(result.windKph, 15.6);
    assert.equal(result.precipitationMm, 0);
    assert.equal(result.observedAt, "2026-08-22T09:45");
    assert.equal(result.source, "Open-Meteo");
    // Regional, never a station — this is what keeps it out of telemetry.
    assert.equal(result.area, "Cồn Hô");
  });

  it("keeps a genuine zero rather than treating it as missing", async () => {
    // 0.0 mm of rain is a real observation. A truthiness check here would
    // turn "no rain" into "no data", which is a different claim.
    stubFetch(async () =>
      jsonResponse({ current: { temperature_2m: 29, precipitation: 0, relative_humidity_2m: 0 } }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.precipitationMm, 0);
    assert.equal(result.humidityPct, 0);
  });

  it("returns null on a non-200 response", async () => {
    stubFetch(async () => jsonResponse({}, false, 503));
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when the body has no `current` block", async () => {
    stubFetch(async () => jsonResponse({ latitude: 10.2 }));
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when every field is unparseable rather than rendering four dashes", async () => {
    stubFetch(async () =>
      jsonResponse({
        current: {
          temperature_2m: "hot",
          relative_humidity_2m: null,
          wind_speed_10m: undefined,
          precipitation: NaN,
        },
      }),
    );
    assert.equal(await getExternalWeather(), null);
  });

  it("keeps the fields it can parse and nulls only the ones it cannot", async () => {
    stubFetch(async () =>
      jsonResponse({ current: { temperature_2m: 31.2, relative_humidity_2m: "n/a" } }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.temperatureC, 31.2);
    assert.equal(result.humidityPct, null, "unparseable field must be null, never coerced to 0");
  });

  it("returns null when the request throws (network error or timeout)", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when the request aborts on timeout", async () => {
    stubFetch(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    assert.equal(await getExternalWeather(), null);
  });

  it("requests Cồn Hô's coordinates and asks for km/h", async () => {
    let requested = "";
    stubFetch(async (input) => {
      requested = String(input);
      return jsonResponse({ current: { temperature_2m: 30 } });
    });

    await getExternalWeather();

    // Asserted against the shared constant rather than a literal, and the
    // literal is what this used to be: the private copy in this adapter said
    // 10.2419/105.826, which is ~48 km from where the stations actually are.
    // Open-Meteo answers for a model grid cell, so that was silently
    // returning a different place's weather. Pinning the constant means the
    // two can never disagree again.
    assert.match(requested, new RegExp(`latitude=${CON_HO.lat}`));
    assert.match(requested, new RegExp(`longitude=${CON_HO.lng}`));
    assert.match(requested, /wind_speed_unit=kmh/);

    // The centroid must sit on the island, not in the next province.
    assert.ok(Math.abs(CON_HO.lat - 10.0725) < 0.01, "reference point drifted in latitude");
    assert.ok(Math.abs(CON_HO.lng - 106.2525) < 0.01, "reference point drifted in longitude");
    // No credential should ever appear in this URL.
    assert.ok(!/api[_-]?key|token|secret/i.test(requested), "adapter must not send a credential");
  });
});
