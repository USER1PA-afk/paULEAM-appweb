/* PAuleam Service Worker — hand-rolled, no dependencies.
 *
 * Strategy:
 *   - Cross-origin (Insforge API, *.insforge.app) and same-origin /api/* are
 *     NEVER intercepted. Auth (Track A/B) and DB/RPC always hit the network so
 *     no session or ERP data is ever stale or cached.
 *   - Navigations: network-first, falling back to the cached /offline page.
 *   - Static same-origin assets (/_next/static, /icons, images): cache-first
 *     with background revalidation (stale-while-revalidate).
 *
 * Bump CACHE_NAME to force clients to drop old caches on the next activate.
 */
const CACHE_NAME = "pauleam-v1";
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never touch mutations.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin (Insforge etc.) or our own API routes.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations → network-first with /offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return cached ?? Response.error();
      })
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      })
    );
  }
});
