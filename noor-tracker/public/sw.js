const CACHE_NAME = "noor-tracker-v1";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/register",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip auth and API routes — always go to network
  if (url.pathname.startsWith("/api/")) return;

  // For navigation requests: network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Serve from cache when offline
          return caches.match(event.request).then((cached) => {
            return cached || caches.match("/offline.html");
          });
        })
    );
    return;
  }

  // For other static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache static assets
        if (response.ok && (
          url.pathname.startsWith("/_next/static/") ||
          url.pathname.startsWith("/icons/") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".js")
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
