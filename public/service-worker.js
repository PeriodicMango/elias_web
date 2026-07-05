// ---------------------------------------------------------------------------
// Elias Console — Service Worker
// Cache-first for static assets, network-first for API, network-only for auth.
// ---------------------------------------------------------------------------

const CACHE_NAME = "elias-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/css/main.css",
  "/css/home.css",
  "/js/api.js",
  "/js/app.js",
  "/js/home.js",
  "/icon.svg",
  "/manifest.json",
];

// ---------------------------------------------------------------------------
// Install — pre-cache critical static assets
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Pre-cache failed for some assets:", err);
      });
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean old cache versions
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // Claim all clients so the SW controls pages immediately
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — strategy routing
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { pathname } = new URL(event.request.url);

  // Auth routes — never cache (contains OAuth redirects)
  if (pathname.startsWith("/auth")) {
    return; // pass through to network
  }

  // API routes — network-first, no cache fallback (online-first app)
  if (pathname.startsWith("/api")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "offline" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Don't cache non-success responses or non-GET requests
        if (!response || response.status !== 200 || event.request.method !== "GET") {
          return response;
        }

        // Clone and store in cache
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });

        return response;
      }).catch(() => {
        // Offline fallback for navigation requests — return the app shell
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        // For other requests, just fail
        return new Response("Offline", { status: 503 });
      });
    })
  );
});
