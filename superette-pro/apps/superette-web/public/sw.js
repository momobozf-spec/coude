/*
 * Superette — service worker.
 *
 * Bewust klein en voorspelbaar:
 *   - App-schil: de gebouwde bestanden van Next (/_next/static/, onveranderlijk
 *     per build), iconen, manifest en de offlinepagina → cache-first.
 *   - Pagina's (navigaties) → altijd netwerk; offline krijg je /offline.html.
 *     HTML wordt niet bewaard.
 *   - API: ALLEEN publieke prijsroutes (ketens, categorieën, zoeken, promoties,
 *     productdetail en -geschiedenis) → netwerk eerst; zonder netwerk een kopie
 *     van hooguit 10 minuten oud. Antwoorden met `Cache-Control: no-store`
 *     (o.a. alles voor een ingelogde gebruiker) worden nooit bewaard.
 *   - Al de rest (inloggen, lijsten, alerts, meldingen, voorkeuren, account,
 *     elke POST/PATCH/DELETE) gaat ongemoeid naar het netwerk en komt nooit in
 *     een cache: persoonlijke gegevens blijven uit de worker.
 *
 * Geregistreerd door src/components/service-worker-registrar.tsx, alleen in
 * productie. De API-basis komt binnen als ?api=… in de URL van dit script.
 */
const VERSION = 'v1';
const STATIC_CACHE = `superette-static-${VERSION}`;
const API_CACHE = `superette-api-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];
const API_MAX_AGE_MS = 10 * 60 * 1000;
const CACHED_AT = 'x-superette-cached-at';

/** Publieke, niet-persoonlijke GET-routes (relatief t.o.v. de API-basis). */
const PUBLIC_API_PATH = /^\/compare\/(chains|categories|search|promotions|products\/[^/]+(\/history)?)$/;

const apiBase = (() => {
  try {
    return new URL(self.location.href).searchParams.get('api') || '';
  } catch {
    return '';
  }
})();

/** @returns {'static' | 'navigate' | 'public-api' | 'bypass'} */
function classify(request, base, origin) {
  if (request.method !== 'GET') return 'bypass';
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return 'bypass';
  }
  if (url.origin === origin) {
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || PRECACHE.includes(url.pathname)) return 'static';
    if (request.mode === 'navigate') return 'navigate';
  }
  if (base) {
    let api;
    try {
      api = new URL(base);
    } catch {
      return 'bypass';
    }
    const prefix = api.pathname.replace(/\/+$/, '');
    if (url.origin === api.origin && url.pathname.startsWith(`${prefix}/`)) {
      return PUBLIC_API_PATH.test(url.pathname.slice(prefix.length)) ? 'public-api' : 'bypass';
    }
  }
  return 'bypass';
}

/** Mag dit API-antwoord in de cache? Alleen geslaagd en zonder no-store. */
function isStorable(response) {
  if (!response || !response.ok) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  return !/\bno-store\b/.test(cacheControl);
}

/** Is een bewaarde kopie nog jong genoeg om offline te tonen? */
function isFresh(cachedAt, now) {
  const at = Number(cachedAt);
  return Number.isFinite(at) && at > 0 && now - at <= API_MAX_AGE_MS;
}

// Voor de unit-tests (vm-sandbox); in de browser onschuldig.
self.__superetteSw = { classify, isStorable, isFresh, PUBLIC_API_PATH, API_MAX_AGE_MS };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('superette-') && key !== STATIC_CACHE && key !== API_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (isStorable(response)) {
      const headers = new Headers(response.headers);
      headers.set(CACHED_AT, String(Date.now()));
      const body = await response.clone().arrayBuffer();
      await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
    } else {
      await cache.delete(request);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && isFresh(cached.headers.get(CACHED_AT), Date.now())) return cached;
    if (cached) await cache.delete(request);
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const kind = classify(event.request, apiBase, self.location.origin);
  if (kind === 'static') event.respondWith(cacheFirst(event.request));
  else if (kind === 'navigate') event.respondWith(networkFirstNavigation(event.request));
  else if (kind === 'public-api') event.respondWith(networkFirstApi(event.request));
  // 'bypass': niets doen; de browser haalt het zelf op.
});
