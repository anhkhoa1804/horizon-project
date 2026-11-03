const { readFileSync } = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const preload = path.join(__dirname, "remote-config-browser-preload.cjs");
const { spawn, spawnSync } = require("node:child_process");
const { createServer } = require("node:http");
const { once } = require("node:events");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.HORIZON_PLAYWRIGHT_MODULE || "playwright",
);
(async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create table stations(id text primary key);insert into stations values ('STATION_01'),('STATION_02'),('STATION_03');create table users(id uuid primary key);create table alert_configs(id int);create function is_admin() returns boolean language sql as 'select false';create table audit_events(id uuid primary key default gen_random_uuid(),actor text,action text,entity text,entity_id text,metadata jsonb,occurred_at timestamptz default now());`,
  );
  for (const migration of [
    "014_device_runtime_configs.sql",
    "034_remote_configuration_v1.sql",
  ])
    await db.exec(
      readFileSync(
        path.join(root, "infra/supabase/migrations", migration),
        "utf8",
      ),
    );
  const proxy = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("content-type", "application/json");
    try {
      const url = new URL(req.url, "http://test");
      let result;
      if (url.pathname.includes("/rpc/")) {
        const p = JSON.parse(body);
        if (url.pathname.endsWith("store_remote_config"))
          result = (
            await db.query(
              "select store_remote_config($1::jsonb,$2,$3) result",
              [JSON.stringify(p.p_config), p.p_expected_revision, p.p_actor],
            )
          ).rows[0].result;
        else
          result = (
            await db.query(
              "select record_remote_config_event($1::jsonb,$2,$3,$4,$5) result",
              [
                JSON.stringify(p.p_config),
                p.p_state,
                p.p_evidence,
                p.p_actor,
                p.p_reason,
              ],
            )
          ).rows[0].result;
      } else {
        const columns = url.searchParams.get("select") ?? "*";
        if (!/^([a-z_]+,)*[a-z_]+$/.test(columns))
          throw Error("invalid QA select");
        const table = url.pathname.endsWith("audit_events")
          ? "audit_events"
          : "device_runtime_configs";
        result = (await db.query(`select ${columns} from ${table}`)).rows.map(
          (r) => ({
            ...r,
            ...("config_revision" in r
              ? { config_revision: Number(r.config_revision) }
              : {}),
            ...("applied_revision" in r
              ? {
                  applied_revision:
                    r.applied_revision == null
                      ? null
                      : Number(r.applied_revision),
                }
              : {}),
          }),
        );
      }
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ code: e.code, message: "isolated QA database error" }),
      );
    }
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const qaUrl = "http://127.0.0.1:" + proxy.address().port;
  const key = "test-only-config-key-01234567890123456789";
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--port",
      "4180",
    ],
    {
      cwd: path.join(root, "apps/web"),
      env: {
        ...process.env,
        NODE_OPTIONS: "--require " + JSON.stringify(preload),
        HORIZON_REMOTE_QA_URL: qaUrl,
        GATEWAY_INGEST_TOKEN: "test-only-gateway-token",
        REMOTE_CONFIG_STATION_01_KEY: key,
        REMOTE_CONFIG_STATION_02_KEY: key,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  child.stdout.on("data", (b) => {
    if (String(b).includes("Ready")) ready = true;
  });
  child.stderr.on("data", () => {});
  let browser;
  try {
    for (let i = 0; i < 100 && !ready; i++)
      await new Promise((r) => setTimeout(r, 200));
    assert.ok(ready, "isolated Next server must start");
    browser = await chromium.launch({
      ...(process.env.HORIZON_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HORIZON_BROWSER_EXECUTABLE }
        : {}),
      headless: true,
    });
    const context = await browser.newContext({});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:4180/admin", {
      waitUntil: "networkidle",
    });
    if (page.url().includes("/login")) {
      const env = Object.fromEntries(
        readFileSync(path.join(root, "apps/web/.env.local"), "utf8")
          .split(/\r?\n/)
          .filter((l) => l.includes("=") && !l.startsWith("#"))
          .map((l) => {
            const i = l.indexOf("=");
            return [
              l.slice(0, i),
              l
                .slice(i + 1)
                .trim()
                .replace(/^['"]|['"]$/g, ""),
            ];
          }),
      );
      await page
        .locator("input[name=email]")
        .fill(env.ADMIN_ALLOWED_EMAILS.split(",")[0]);
      await page.locator("input[name=password]").fill(env.ADMIN_PASSWORD);
      await page.locator("button[type=submit]").click();
      await page.waitForURL("**/admin");
    }
    const runtime = page.locator("#runtime");
    assert.equal(await runtime.locator("form").count(), 2);
    assert.ok((await runtime.innerText()).includes("UNSET"));
    const form = runtime.locator("form").first();
    await form.locator("input[name=sample_interval_seconds]").fill("12");
    await form.locator("input[name=sleep_interval_seconds]").fill("7");
    await form.locator("select[name=mode]").selectOption("maintenance");
    await form.locator("button[type=submit]").click();
    await form.getByRole("status").waitFor();
    assert.match(
      await form.getByRole("status").innerText(),
      /Chưa xác nhận thiết bị áp dụng/,
    );
    let row = (await db.query("select * from device_runtime_configs")).rows[0];
    assert.equal(Number(row.config_revision), 1);
    assert.equal(row.sample_interval_seconds, 12);
    assert.equal(row.mode, "maintenance");
    assert.equal(row.delivery_state, "STORED");
    await db.exec(
      `create function test_fail_audit() returns trigger language plpgsql as $$begin raise exception 'QA audit failure';end;$$;create trigger test_fail_audit before insert on audit_events for each row execute function test_fail_audit();`,
    );
    await form.locator("input[name=sample_interval_seconds]").fill("13");
    await form.locator("button[type=submit]").click();
    await form.getByRole("alert").waitFor();
    assert.match(await form.getByRole("alert").innerText(), /hoàn tác/);
    assert.equal(
      await form.locator("input[name=sample_interval_seconds]").inputValue(),
      "13",
    );
    row = (await db.query("select * from device_runtime_configs")).rows[0];
    assert.equal(Number(row.config_revision), 1);
    assert.equal(row.sample_interval_seconds, 12);
    await db.exec("drop trigger test_fail_audit on audit_events");
    await form.locator("button[type=submit]").click();
    await form.getByRole("status").waitFor();
    row = (await db.query("select * from device_runtime_configs")).rows[0];
    assert.equal(Number(row.config_revision), 2);
    assert.equal(row.sample_interval_seconds, 13);
    const auth = { "x-gateway-token": "test-only-gateway-token" };
    const response = await fetch(
      "http://localhost:4180/api/public/gateway/configs",
      { headers: auth },
    );
    assert.equal(response.status, 200);
    const fetched = await response.json();
    const executable = (name) =>
      path.join(
        root,
        "firmware/esp32-node/build",
        name + (process.platform === "win32" ? ".exe" : ""),
      );
    const hostEnv = {
      ...process.env,
      PATH: `C:/msys64/mingw64/bin${path.delimiter}${process.env.PATH}`,
    };
    const gateway = spawnSync(
      executable("remote_gateway_host"),
      [JSON.stringify(fetched)],
      { encoding: "utf8", env: hostEnv },
    );
    assert.equal(gateway.status, 0, gateway.stderr);
    const sent = JSON.parse(gateway.stdout).sent[0];
    const station = spawnSync(
      executable("remote_config_host"),
      ["station", key, "1", "", sent, "ok"],
      { encoding: "utf8", env: hostEnv },
    );
    assert.equal(station.status, 0, station.stderr);
    const receipts = JSON.parse(station.stdout).responses;
    for (const [frame, state] of [
      [sent, "SENT"],
      [receipts[0], "ACKNOWLEDGED"],
      [receipts[1], "APPLIED"],
    ]) {
      const result = await fetch(
        "http://localhost:4180/api/public/gateway/configs/events",
        {
          method: "POST",
          headers: { ...auth, "content-type": "application/json" },
          body: JSON.stringify({
            contract_version: 1,
            gateway_id: "GATEWAY_01",
            state,
            frame,
          }),
        },
      );
      assert.equal(result.status, 200);
    }
    row = (await db.query("select * from device_runtime_configs")).rows[0];
    assert.equal(row.delivery_state, "APPLIED");
    assert.equal(Number(row.applied_revision), 2);
    await page.reload({ waitUntil: "networkidle" });
    assert.match(await runtime.innerText(), /APPLIED/);
    assert.match(await runtime.innerText(), /Chưa kiểm chứng phần cứng/);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://localhost:4180/admin#runtime", {
        waitUntil: "networkidle",
      });
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(over, false, "Admin overflow at " + width);
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        admin_forms: 2,
        real_server_action: true,
        station_attested_revision: 2,
        admin_applied_readback: true,
        audit_failure_rolled_back: true,
        failed_values_preserved: true,
        widths: [390, 1440],
        browser_errors: 0,
        production_configuration_writes: 0,
      }),
    );
  } finally {
    if (browser) await browser.close();
    child.kill();
    proxy.close();
    await db.close();
  }
})().catch((e) => {
  const message = String(e?.message ?? "unexpected failure")
    .replace(/(token|secret|password|authorization|api[_-]?key)(\s*[:=]\s*)\S+/gi, "$1$2[redacted]")
    .replace(/\b(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{20,}/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
  console.error(`Remote configuration browser QA failed (${e?.name ?? "Error"}): ${message}`);
  process.exitCode = 1;
});
