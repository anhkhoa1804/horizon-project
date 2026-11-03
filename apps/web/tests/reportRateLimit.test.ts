import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  clientIdentifier,
  consumeReportQuota,
  memoryRateLimited,
  resetMemoryRateLimit,
  REPORT_RATE_MAX,
} from "@/lib/reports/rateLimit";

/**
 * The report endpoint is the only unauthenticated write path in the system,
 * so its throttle is a real security control rather than a nicety.
 *
 * Two defects motivated this suite. The counter lived in a module-level Map,
 * which on Vercel means one quota per lambda instance — bypassable by forcing
 * concurrency. And it was keyed on the LEFTMOST `x-forwarded-for` entry, which
 * is whatever the caller sent: rotating that header bought unlimited quota.
 */

function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/public/reports", { headers });
}

describe("report rate limit — client identity", () => {
  it("prefers platform headers a caller cannot forge", () => {
    // Vercel overwrites these at the edge, discarding any client-sent copy.
    assert.equal(
      clientIdentifier(req({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })),
      "9.9.9.9",
    );
    assert.equal(
      clientIdentifier(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })),
      "9.9.9.9",
    );
  });

  it("ignores a spoofed leftmost x-forwarded-for entry", () => {
    // The regression: an attacker prepends an arbitrary address. The rightmost
    // hop is the one added closest to our own infrastructure.
    const id = clientIdentifier(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" }));
    assert.equal(id, "203.0.113.7");
    assert.notEqual(id, "1.1.1.1", "the caller-controlled entry must not become the quota key");
  });

  it("falls back to one shared strict bucket rather than a permissive one", () => {
    assert.equal(clientIdentifier(req({})), "unknown");
    assert.equal(clientIdentifier(req({ "x-forwarded-for": "  " })), "unknown");
  });
});

describe("report rate limit — memory fallback", () => {
  beforeEach(() => resetMemoryRateLimit());

  it("allows exactly the configured number of calls, then refuses", () => {
    for (let i = 0; i < REPORT_RATE_MAX; i++) {
      assert.equal(memoryRateLimited("ip"), false, `call ${i + 1} should pass`);
    }
    assert.equal(memoryRateLimited("ip"), true, "one past the cap must be refused");
  });

  it("keeps separate quotas per client", () => {
    for (let i = 0; i < REPORT_RATE_MAX; i++) memoryRateLimited("a");
    assert.equal(memoryRateLimited("a"), true);
    assert.equal(memoryRateLimited("b"), false, "a different client must be unaffected");
  });

  it("releases the quota once the window has passed", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < REPORT_RATE_MAX; i++) memoryRateLimited("ip", t0);
    assert.equal(memoryRateLimited("ip", t0), true);
    assert.equal(memoryRateLimited("ip", t0 + 3_600_001), false, "next window starts clean");
  });
});

describe("report rate limit — durable path", () => {
  beforeEach(() => resetMemoryRateLimit());

  const rpcClient = (impl: (args: unknown) => { data: unknown; error: unknown }) =>
    ({ rpc: async (_name: string, args: unknown) => impl(args) }) as never;

  it("uses the shared counter when it answers, and reports which backend ran", async () => {
    const allowed = await consumeReportQuota(rpcClient(() => ({ data: true, error: null })), "ip");
    assert.deepEqual(allowed, { limited: false, backend: "durable" });

    const refused = await consumeReportQuota(rpcClient(() => ({ data: false, error: null })), "ip");
    assert.deepEqual(refused, { limited: true, backend: "durable" });
  });

  it("namespaces the bucket so it cannot collide with another limiter", async () => {
    let seen: Record<string, unknown> | null = null;
    await consumeReportQuota(
      rpcClient((args) => {
        seen = args as Record<string, unknown>;
        return { data: true, error: null };
      }),
      "203.0.113.7",
    );
    assert.equal(seen!.p_bucket, "report:203.0.113.7");
    assert.equal(seen!.p_max, REPORT_RATE_MAX);
  });

  it("degrades to the memory limiter instead of failing open", async () => {
    // The realistic case: migration 021 has not been applied, so the function
    // does not exist. Waving every request through would be the wrong answer.
    const broken = rpcClient(() => ({ data: null, error: { message: "function does not exist" } }));

    for (let i = 0; i < REPORT_RATE_MAX; i++) {
      const r = await consumeReportQuota(broken, "ip");
      assert.equal(r.limited, false);
      assert.equal(r.backend, "memory", "caller must be able to see it degraded");
    }
    assert.equal((await consumeReportQuota(broken, "ip")).limited, true, "fallback still enforces");
  });

  it("still throttles when Supabase is absent entirely (demo mode)", async () => {
    for (let i = 0; i < REPORT_RATE_MAX; i++) {
      assert.equal((await consumeReportQuota(null, "ip")).limited, false);
    }
    assert.equal((await consumeReportQuota(null, "ip")).limited, true);
  });

  it("does not fail open when the client throws", async () => {
    const throwing = {
      rpc: async () => {
        throw new Error("network down");
      },
    } as never;

    for (let i = 0; i < REPORT_RATE_MAX; i++) {
      assert.equal((await consumeReportQuota(throwing, "ip")).limited, false);
    }
    assert.equal((await consumeReportQuota(throwing, "ip")).limited, true);
  });
});
