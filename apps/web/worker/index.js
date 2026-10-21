/* eslint-disable */
/**
 * Custom service-worker code, bundled into public/sw.js by @ducanh2912/next-pwa (customWorkerSrc "worker").
 *
 * WHY THIS EXISTS. The plugin's generated "pages" rule is supposed to answer a failed navigation with the
 * precached /offline page. Verified against a real production build with the server actually stopped
 * (Playwright's setOffline does NOT reach service-worker fetches, so it cannot prove this): visited pages
 * and /offline render, but a route that was never visited fails with the browser's own error page
 * (net::ERR_FAILED). That is the case the offline page exists for.
 *
 * WHAT IT DOES. It answers top-level navigations itself, network-first:
 *   online              -> the network response; successful HTML pages are stored for later offline reads
 *   offline, visited    -> the stored copy
 *   offline, unvisited  -> the precached /offline page (HTTP 200 shell, never a misleading 404)
 * It deliberately does NOT touch /admin, /api, non-GET requests, or non-navigation requests: those keep the
 * NetworkOnly / default rules defined in next.config.ts, so signed-in operator pages and API responses are
 * never stored in the browser cache.
 */
(function () {
  var PAGES = "horizon-pages-v1";
  var OFFLINE = "/offline";

  function excluded(url) {
    var p = url.pathname;
    return p === "/admin" || p.indexOf("/admin/") === 0 || p.indexOf("/api/") === 0;
  }

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.mode !== "navigate" || request.method !== "GET") return;
    var url = new URL(request.url);
    if (url.origin !== self.location.origin || excluded(url)) return;

    // We own this navigation: stop the generated rules from also answering it.
    event.stopImmediatePropagation();
    event.respondWith(
      (async function () {
        try {
          var response = await fetch(request);
          var type = response.headers.get("content-type") || "";
          if (response.status === 200 && !response.redirected && type.indexOf("text/html") === 0) {
            var copy = response.clone();
            event.waitUntil(caches.open(PAGES).then(function (c) { return c.put(request, copy); }).catch(function () {}));
          }
          return response;
        } catch (error) {
          var cached = (await caches.match(request, { cacheName: PAGES })) || (await caches.match(request)); // any cache, e.g. the start-url copy of "/"
          if (cached) return cached;
          var offline = await caches.match(OFFLINE, { ignoreSearch: true });
          if (offline) return offline;
          throw error;
        }
      })()
    );
  });
})();
