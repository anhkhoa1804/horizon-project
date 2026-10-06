// Test-process-only transport redirection. Never load this module in deployment.
if (
  !process.env.HORIZON_REMOTE_QA_URL ||
  new URL(process.env.HORIZON_REMOTE_QA_URL).hostname !== "127.0.0.1"
)
  throw Error("Browser QA requires an isolated loopback database facade");
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const url = new URL(raw);
  if (
    url.pathname === "/rest/v1/device_runtime_configs" ||
    url.pathname === "/rest/v1/audit_events" ||
    [
      "/rest/v1/rpc/store_remote_config",
      "/rest/v1/rpc/record_remote_config_event",
    ].includes(url.pathname)
  ) {
    const target =
      process.env.HORIZON_REMOTE_QA_URL + url.pathname + url.search;
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.delete("apikey");
    headers.delete("authorization");
    return originalFetch(target, { ...init, headers });
  }
  const method = String(
    init?.method || (input instanceof Request ? input.method : "GET"),
  ).toUpperCase();
  if (
    url.hostname.endsWith(".supabase.co") &&
    !["GET", "HEAD"].includes(method)
  )
    throw Error("QA refused a production Supabase mutation");
  return originalFetch(input, init);
};
