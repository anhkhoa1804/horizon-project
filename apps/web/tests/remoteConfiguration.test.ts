import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { remoteConfigStore } from "../lib/gateway/remoteConfigStore";
import {
  configGet,
  configEventPost,
  saveRemoteConfig,
  RemoteDbError,
  type RemoteStore,
} from "../lib/gateway/remoteConfigService";
import {
  isRemoteConfig,
  canonicalConfig,
  crc16,
  encodeConfigFrame,
  decodeConfigFrame,
  deriveConfigState,
  type RemoteConfig,
} from "../lib/gateway/remoteProtocol";
const root = path.resolve("../.."),
  key = "test-only-config-key-01234567890123456789",
  token = "test-only-gateway-token";
const config = (overrides: Partial<RemoteConfig> = {}): RemoteConfig => ({
  contract_version: 1,
  config_revision: 1,
  station_id: "STATION_02",
  sample_interval_seconds: 30,
  sleep_interval_seconds: 30,
  mode: "normal",
  ...overrides,
});
function native(args: string[]) {
  return spawnSync(
    path.join(
      root,
      "firmware/esp32-node/build/remote_config_host" +
        (process.platform === "win32" ? ".exe" : ""),
    ),
    args,
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `C:/msys64/mingw64/bin${path.delimiter}${process.env.PATH}`,
      },
    },
  );
}
function station(c: RemoteConfig, stored = "", fail = false, id = "2") {
  const result = native([
    "station",
    key,
    id,
    stored,
    encodeConfigFrame(c, "SET", key),
    fail ? "fail" : "ok",
  ]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create table stations(id text primary key);insert into stations values ('STATION_01'),('STATION_02'),('STATION_03');create table users(id uuid primary key);create table alert_configs(id int);create function is_admin() returns boolean language sql as 'select false';create table audit_events(id uuid primary key default gen_random_uuid(),actor text,action text,entity text,entity_id text,metadata jsonb,occurred_at timestamptz default now());`,
  );
  for (const name of [
    "014_device_runtime_configs.sql",
    "034_remote_configuration_v1.sql",
  ])
    await db.exec(
      readFileSync(path.join(root, "infra/supabase/migrations", name), "utf8"),
    );
  return db;
}
function store(db: PGlite): RemoteStore {
  async function rpc(name: string, args: unknown[]) {
    try {
      return (
        await db.query<{ value: any }>(
          `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
          args,
        )
      ).rows[0].value;
    } catch (e) {
      throw new RemoteDbError((e as { code: string }).code);
    }
  }
  return {
    async desired() {
      return (
        await db.query<RemoteConfig>(
          `select contract_version,config_revision::double precision as config_revision,station_id,sample_interval_seconds,sleep_interval_seconds,mode from device_runtime_configs where contract_version=1 order by station_id`,
        )
      ).rows;
    },
    put(c, r, a) {
      return rpc("store_remote_config", [JSON.stringify(c), r, a]);
    },
    record(c, s, e, r) {
      return rpc("record_remote_config_event", [
        JSON.stringify(c),
        s,
        e,
        "GATEWAY_01",
        r ?? null,
      ]);
    },
  };
}
const get = (auth = token) =>
  new Request("http://test/configs", { headers: { "x-gateway-token": auth } });
const event = (
  c: RemoteConfig,
  type: "SET" | "ACK" | "APPLIED" | "REJECTED",
  state: string,
  auth = token,
) =>
  new Request("http://test/events", {
    method: "POST",
    headers: { "x-gateway-token": auth, "content-type": "application/json" },
    body: JSON.stringify({
      contract_version: 1,
      gateway_id: "GATEWAY_01",
      state,
      frame: encodeConfigFrame(
        c,
        type,
        key,
        type === "REJECTED" ? "stale" : "ok",
      ),
    }),
  });
test("canonical bounds, CRC and authenticated cross-language frames", () => {
  assert.equal(crc16("123456789"), "29B1");
  assert.equal(JSON.parse(canonicalConfig(config())).config_revision, 1);
  for (const type of ["SET", "ACK", "APPLIED", "REJECTED"] as const) {
    const frame = encodeConfigFrame(
      config(),
      type,
      key,
      type === "REJECTED" ? "stale" : "ok",
    );
    assert.equal(decodeConfigFrame(frame, key)?.type, type);
    const result = native(["decode", key, frame]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).revision, 1);
    const corrupt = frame.slice(0, -1) + (frame.endsWith("0") ? "1" : "0");
    assert.equal(decodeConfigFrame(corrupt, key), null);
    assert.equal(native(["decode", key, corrupt]).status, 1);
  }
  for (const bad of [
    { contract_version: 2 },
    { station_id: "GATEWAY_01" },
    { sample_interval_seconds: 4 },
    { sleep_interval_seconds: -1 },
    { mode: "unknown" },
    { config_revision: 4294967296 },
    { extra: true },
  ])
    assert.equal(isRemoteConfig({ ...config(), ...bad }), false);
  assert.ok(
    isRemoteConfig(
      config({
        config_revision: 4294967295,
        sample_interval_seconds: 86400,
        sleep_interval_seconds: 0,
      }),
    ),
  );
});
test("real station core persists, reboots, rejects stale/conflicting revisions and honors all modes", () => {
  const first = station(config());
  assert.equal(first.revision, 1);
  assert.equal(first.sample_ms, 30000);
  assert.deepEqual(
    first.responses.map((f: string) => decodeConfigFrame(f, key)?.type),
    ["ACK", "APPLIED"],
  );
  const duplicate = station(config(), first.stored);
  assert.equal(duplicate.stored, first.stored);
  assert.equal(duplicate.responses.length, 2);
  const conflict = station(
    config({ sample_interval_seconds: 31 }),
    first.stored,
  );
  assert.equal(conflict.revision, 1);
  assert.equal(
    decodeConfigFrame(conflict.responses[0], key)?.reason,
    "conflict",
  );
  const second = station(
    config({ config_revision: 2, mode: "rain_saver" }),
    first.stored,
  );
  assert.equal(second.raw_samples, 3);
  const stale = station(config(), second.stored);
  assert.equal(stale.revision, 2);
  assert.equal(decodeConfigFrame(stale.responses[0], key)?.reason, "stale");
  const maintenance = station(
    config({ config_revision: 3, mode: "maintenance" }),
    second.stored,
  );
  assert.equal(maintenance.sleep_ms, 0);
  const failed = station(
    config({ config_revision: 4 }),
    maintenance.stored,
    true,
  );
  assert.equal(failed.revision, 3);
  assert.equal(failed.stored, maintenance.stored);
  assert.deepEqual(
    failed.responses.map((f: string) => decodeConfigFrame(f, key)?.type),
    ["ACK", "REJECTED"],
  );
  assert.equal(
    decodeConfigFrame(failed.responses[1], key)?.reason,
    "persistence",
  );
  assert.equal(station(config(), " ", false, "1").responses.length, 0);
});
test("gateway retries after lost receipt and stops only on matching APPLIED", () => {
  const frame = encodeConfigFrame(config(), "SET", key);
  function run(receipt: string, last: string, now: string) {
    const r = native(["gateway", key, frame, receipt, last, now]);
    assert.equal(r.status, 0);
    return JSON.parse(r.stdout);
  }
  assert.equal(run("", "100", "200").due, false);
  assert.equal(run("", "100", "30100").due, true);
  assert.equal(
    run(encodeConfigFrame(config(), "ACK", key), "100", "30100").due,
    true,
  );
  assert.equal(
    run(encodeConfigFrame(config(), "APPLIED", key), "100", "30100").due,
    false,
  );
  assert.equal(
    run(
      encodeConfigFrame(config({ config_revision: 2 }), "APPLIED", key),
      "100",
      "30100",
    ).applied,
    0,
  );
  const applied = station(config());
  const replay = station(config(), applied.stored);
  assert.equal(decodeConfigFrame(replay.responses[1], key)?.type, "APPLIED");
});
test("real PostgreSQL migration: optimistic revisions, atomic audit rollback and permissions", async () => {
  const db = await database();
  try {
    const s = store(db);
    assert.equal(
      (await saveRemoteConfig(s, config(), 0, "admin")).kind,
      "success",
    );
    assert.equal(
      (await saveRemoteConfig(s, config({ config_revision: 2 }), 1, "admin"))
        .revision,
      1,
    );
    assert.equal(
      (
        await saveRemoteConfig(
          s,
          config({ sample_interval_seconds: 40 }),
          0,
          "admin",
        )
      ).kind,
      "conflict",
    );
    await db.exec(
      `create function fail_audit() returns trigger language plpgsql as $$begin raise exception 'test outage';end;$$;create trigger test_audit_failure before insert on audit_events for each row execute function fail_audit();`,
    );
    assert.equal(
      (
        await saveRemoteConfig(
          s,
          config({ config_revision: 2, sample_interval_seconds: 40 }),
          1,
          "admin",
        )
      ).kind,
      "audit_error",
    );
    assert.equal((await s.desired())[0].config_revision, 1);
    await db.exec("drop trigger test_audit_failure on audit_events");
    assert.equal(
      (
        await saveRemoteConfig(
          s,
          config({ config_revision: 2, sample_interval_seconds: 40 }),
          1,
          "admin",
        )
      ).revision,
      2,
    );
    for (const invalid of [
      null,
      [],
      { ...config(), sample_interval_seconds: "oops" },
    ])
      assert.equal(
        (
          await db.query<{ valid: boolean }>(
            "select validate_remote_config($1::jsonb) valid",
            [JSON.stringify(invalid)],
          )
        ).rows[0].valid,
        false,
      );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select store_remote_config($1::jsonb,0,$2)", [
        JSON.stringify(config()),
        "anon",
      ]),
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(db.query("select * from device_runtime_configs"));
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
test("actual handlers fail closed and never fabricate configurations or evidence", async () => {
  const db = await database();
  try {
    const s = store(db);
    assert.equal(
      (await configGet(get("wrong"), s, token, () => key)).status,
      401,
    );
    assert.equal((await configGet(get(), s, undefined, () => key)).status, 503);
    assert.equal((await configGet(get(), null, token, () => key)).status, 503);
    assert.deepEqual(
      (await (await configGet(get(), s, token, () => key)).json()).configs,
      [],
    );
    assert.equal(
      (
        await configEventPost(
          event(config(), "APPLIED", "APPLIED"),
          s,
          token,
          () => key,
        )
      ).status,
      404,
    );
    await s.put(config(), 0, "admin");
    assert.equal(
      (
        await configEventPost(
          event(config({ config_revision: 2 }), "APPLIED", "APPLIED"),
          s,
          token,
          () => key,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await configEventPost(
          event(config(), "ACK", "APPLIED"),
          s,
          token,
          () => key,
        )
      ).status,
      422,
    );
    assert.equal(
      (await configGet(get(), s, token, () => undefined)).status,
      503,
    );
    const badMac = event(config(), "APPLIED", "APPLIED");
    const body = await badMac.json();
    body.frame = body.frame.slice(0, -1) + "Z";
    assert.equal(
      (
        await configEventPost(
          new Request(badMac.url, {
            method: "POST",
            headers: badMac.headers,
            body: JSON.stringify(body),
          }),
          s,
          token,
          () => key,
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await configEventPost(
          new Request("http://test", {
            method: "POST",
            headers: { "x-gateway-token": token },
            body: "{}",
          }),
          s,
          token,
          () => key,
        )
      ).status,
      415,
    );
    assert.equal(
      (
        await configEventPost(
          new Request("http://test", {
            method: "POST",
            headers: {
              "x-gateway-token": token,
              "content-type": "application/json",
            },
            body: "x".repeat(513),
          }),
          s,
          token,
          () => key,
        )
      ).status,
      413,
    );
    const broken = {
      ...s,
      async desired() {
        throw new RemoteDbError("08006");
      },
    };
    assert.equal(
      (await configGet(get(), broken, token, () => key)).status,
      500,
    );
    assert.equal(
      (await saveRemoteConfig(s, config({ mode: "broken" as any }), 1, "admin"))
        .kind,
      "validation_error",
    );
  } finally {
    await db.close();
  }
});
test("Admin → Supabase SDK HTTP → real PostgreSQL → gateway HTTP → real station core → durable receipt", async () => {
  const db = await database(),
    sql = store(db);
  let sdk: RemoteStore | null = null,
    outage = 0;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const b of req) chunks.push(Buffer.from(b));
    const body = Buffer.concat(chunks).toString();
    try {
      if (req.url?.startsWith("/rest/v1/")) {
        let data: unknown;
        if (req.url.includes("/rpc/store_remote_config")) {
          const p = JSON.parse(body);
          data = await sql.put(p.p_config, p.p_expected_revision, p.p_actor);
        } else if (req.url.includes("/rpc/record_remote_config_event")) {
          const p = JSON.parse(body);
          data = await sql.record(
            p.p_config,
            p.p_state,
            p.p_evidence,
            p.p_reason,
          );
        } else data = await sql.desired();
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(data));
        return;
      }
      if (outage && req.url === "/events") {
        res.statusCode = outage;
        res.end("test transport outage");
        return;
      }
      const request = new Request("http://test" + req.url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(req.method === "POST" ? { body } : {}),
      });
      const response =
        req.url === "/configs"
          ? await configGet(request, sdk, token, () => key)
          : await configEventPost(request, sdk, token, () => key);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await response.text());
    } catch (e) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          code: (e as RemoteDbError).code,
          message: "isolated test database failure",
        }),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  sdk = remoteConfigStore(
    createClient(base, "test-only-anon-key", {
      auth: { persistSession: false },
    }),
  );
  try {
    assert.equal(
      (await saveRemoteConfig(sdk, config(), 0, "admin")).kind,
      "success",
    );
    const response = await fetch(base + "/configs", {
      headers: { "x-gateway-token": token },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const fetched = await response.json();
    assert.equal(fetched.hardware_verified, false);
    const gateway = gatewayHost(fetched);
    assert.equal(gateway.valid, true);
    assert.deepEqual(gateway.sent, fetched.frames);
    const result = native(["station", key, "2", "", gateway.sent[0], "ok"]);
    assert.equal(result.status, 0, result.stderr);
    const replies = JSON.parse(result.stdout).responses;
    async function forward(frame: string, state: string) {
      return fetch(base + "/events", {
        method: "POST",
        headers: {
          "x-gateway-token": token,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contract_version: 1,
          gateway_id: "GATEWAY_01",
          state,
          frame,
        }),
      });
    }
    for (const status of [401, 403, 404, 409, 422, 500]) {
      outage = status;
      assert.equal((await forward(replies[1], "APPLIED")).status, status);
      assert.equal(
        (
          await db.query<{ delivery_state: string }>(
            "select delivery_state from device_runtime_configs",
          )
        ).rows[0].delivery_state,
        "RETRIEVED",
      );
    }
    outage = 0;
    for (const [frame, state] of [
      [fetched.frames[0], "SENT"],
      [replies[1], "APPLIED"],
      [replies[0], "ACKNOWLEDGED"],
      [replies[1], "APPLIED"],
    ])
      assert.equal((await forward(frame, state)).status, 200);
    let row = (
      await db.query<{ delivery_state: string; applied_revision: number }>(
        "select delivery_state,applied_revision from device_runtime_configs",
      )
    ).rows[0];
    assert.equal(row.delivery_state, "APPLIED");
    assert.equal(Number(row.applied_revision), 1);
    assert.equal(
      Number(
        (
          await db.query<{ count: number }>(
            "select count(*) count from audit_events",
          )
        ).rows[0].count,
      ),
      5,
    );
    assert.equal(
      (
        await saveRemoteConfig(
          sdk,
          config({ config_revision: 2, sample_interval_seconds: 40 }),
          1,
          "admin",
        )
      ).revision,
      2,
    );
    assert.equal((await forward(replies[1], "APPLIED")).status, 200);
    row = (
      await db.query<{ delivery_state: string; applied_revision: number }>(
        "select delivery_state,applied_revision from device_runtime_configs",
      )
    ).rows[0];
    assert.equal(row.delivery_state, "STORED");
    assert.equal(Number(row.applied_revision), 1);
  } finally {
    server.close();
    await once(server, "close");
    await db.close();
  }
});

function gatewayHost(body: unknown, receipt = "") {
  const result = spawnSync(
    path.join(
      root,
      "firmware/esp32-node/build/remote_gateway_host" +
        (process.platform === "win32" ? ".exe" : ""),
    ),
    [JSON.stringify(body), ...(receipt ? [receipt] : [])],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `C:/msys64/mingw64/bin${path.delimiter}${process.env.PATH}`,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
test("production gateway JSON, UART, persistent receipt queue and reconnect rollback", () => {
  const c = config(),
    frame = encodeConfigFrame(c, "SET", key),
    body = {
      ok: true,
      contract_version: 1,
      gateway_id: "GATEWAY_01",
      configs: [c],
      frames: [frame],
    };
  assert.equal(gatewayHost(body).valid, true);
  const applied = encodeConfigFrame(c, "APPLIED", key);
  const result = gatewayHost(body, applied);
  assert.equal(result.applied2, 1);
  assert.equal(result.pending, 0);
  for (const bad of [
    { contract_version: 2 },
    { gateway_id: "STATION_03" },
    { frames: ["bad"] },
    { configs: [{ ...c, unknown: true }] },
    { configs: [{ ...c, sample_interval_seconds: 31 }] },
    { frames: [frame, frame], configs: [c, c] },
    { frames: [frame], configs: [] },
    { configs: [{ ...c, mode: "unknown" }] },
  ]) {
    const rejected = gatewayHost({ ...body, ...bad });
    assert.equal(rejected.valid, false);
    assert.deepEqual(rejected.sent, []);
  }
  assert.equal(
    gatewayHost({
      ok: true,
      contract_version: 1,
      gateway_id: "GATEWAY_01",
      configs: [],
      frames: [],
    }).valid,
    true,
  );
});
test("readback distinguishes stale intent from evidence and hardware verification", () => {
  const before = Date.parse("2026-10-01T00:00:00Z"),
    now = before + 86400001;
  assert.equal(deriveConfigState({}), "UNSET");
  assert.equal(
    deriveConfigState(
      {
        config_revision: 1,
        delivery_state: "STORED",
        updated_at: new Date(before).toISOString(),
      },
      now,
    ),
    "STALE",
  );
  assert.equal(
    deriveConfigState(
      {
        config_revision: 1,
        delivery_state: "APPLIED",
        updated_at: new Date(before).toISOString(),
      },
      now,
    ),
    "APPLIED",
  );
});

test("independent golden fixtures match TypeScript and production C++", () => {
  const golden = JSON.parse(
    readFileSync(
      path.join(root, "contracts/fixtures/remote-config.v1.json"),
      "utf8",
    ),
  );
  for (const f of golden.fixtures) {
    assert.equal(
      encodeConfigFrame(f.config, f.type, golden.key, f.reason),
      f.frame,
    );
    assert.deepEqual(decodeConfigFrame(f.frame, golden.key)?.config, f.config);
    assert.equal(native(["decode", golden.key, f.frame]).status, 0);
  }
});

test("production Arduino adapters: boot persistence, queue bounds/corruption and retry wraparound", () => {
  const result = spawnSync(
    path.join(
      root,
      "firmware/esp32-node/build/remote_gateway_host" +
        (process.platform === "win32" ? ".exe" : ""),
    ),
    ["--self-test"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `C:/msys64/mingw64/bin${path.delimiter}${process.env.PATH}`,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("receipt audit failure cannot mark APPLIED and is reported as a server failure",async()=>{const db=await database();try{const s=store(db);await s.put(config(),0,"admin");await db.exec(`create function test_receipt_audit_failure() returns trigger language plpgsql as $$begin raise exception 'test receipt failure';end;$$;create trigger test_receipt_audit_failure before insert on audit_events for each row execute function test_receipt_audit_failure();`);const response=await configEventPost(event(config(),"APPLIED","APPLIED"),s,token,()=>key);assert.equal(response.status,500);const row=(await db.query<{delivery_state:string;applied_revision:number|null}>("select delivery_state,applied_revision from device_runtime_configs")).rows[0];assert.equal(row.delivery_state,"STORED");assert.equal(row.applied_revision,null);}finally{await db.close();}});
test("concurrent Admin writes allocate one monotonic successor",async()=>{const db=await database();try{const s=store(db);await s.put(config(),0,"admin");const results=await Promise.all([saveRemoteConfig(s,config({config_revision:2,sample_interval_seconds:40}),1,"admin-a"),saveRemoteConfig(s,config({config_revision:2,sample_interval_seconds:50}),1,"admin-b")]);assert.deepEqual(results.map(r=>r.kind).sort(),["conflict","success"]);assert.equal((await s.desired())[0].config_revision,2);assert.equal(Number((await db.query<{count:number}>("select count(*) count from audit_events")).rows[0].count),2);}finally{await db.close();}});

test("late rejection is auditable without restoring a failure after APPLIED",async()=>{const db=await database();try{const s=store(db);await s.put(config(),0,"admin");assert.equal((await configEventPost(event(config(),"APPLIED","APPLIED"),s,token,()=>key)).status,200);assert.equal((await configEventPost(event(config(),"REJECTED","REJECTED"),s,token,()=>key)).status,200);const row=(await db.query<{delivery_state:string;last_failure_reason:string|null}>("select delivery_state,last_failure_reason from device_runtime_configs")).rows[0];assert.equal(row.delivery_state,"APPLIED");assert.equal(row.last_failure_reason,null);}finally{await db.close();}});
