// Hikmar AI — Service Worker
// Enables offline support, caching, and PWA installability

const CACHE_NAME = 'hikmar-ai-v1';
const STATIC_ASSETS = [
  '/ui',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Don't fail install if some assets are missing
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache for UI
// Always network for API calls (/chat, /smart-home, /status)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use network for API endpoints
  const isApiCall = ['/chat', '/smart-home', '/status'].some(path =>
    url.pathname.startsWith(path)
  );

  if (isApiCall) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For UI: try network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If nothing in cache, return offline page
          return new Response(
            '<html><body style="background:#080C14;color:#C9A84C;font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;"><div><h2>Hikmar AI</h2><p>You are offline. Connect to the internet to use Hikmar.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'Hikmar AI', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  }
});
