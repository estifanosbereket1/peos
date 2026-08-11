/* peos service worker
 * - Precache the app shell so first paint works offline once registered.
 * - Network-first for navigations, falling back to the cached shell /
 *   /offline.html so an already-installed app never shows a blank tab.
 * - Stale-while-revalidate for hashed _next/static assets (JS/CSS/fonts),
 *   which are versioned by Next so cache keys never collide across deploys.
 * - Never touch /api (auth + dynamic data) or cross-origin requests.
 */

const SHELL_CACHE = "peos-shell-v2";
const RUNTIME_CACHE = "peos-runtime-v2";
const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            fetch(url)
              .then((res) => {
                if (res.ok && !res.redirected) cache.put(url, res);
              })
              .catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStatic(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    /\.(?:woff2?|ttf|otf|css|js|mjs|png|svg|ico|webp|avif)$/.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, then cached shell, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return caches.match("/offline.html");
          }),
        ),
    );
    return;
  }

  // Hashed/static assets: stale-while-revalidate into the runtime cache.
  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else (public static files already in precache): cache-first.
  if (url.pathname.startsWith("/") && !url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(SHELL_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return res;
          }),
      ),
    );
  }
});

// Allow the page to tell us a new worker is waiting so it can prompt the user.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});