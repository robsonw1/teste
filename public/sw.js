// Service Worker with safe update strategy:
// - network-first for navigation requests (index.html)
// - cache-first for other GET assets with background update
// - cleans old caches on activate
// - supports skipWaiting via message

// Bump this version on deploy to force clients to install the new SW and clear old caches.
const CACHE_NAME = 'forneiro-eden-v3';
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  // Activate faster
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
        return Promise.resolve();
      })
    )).then(() => self.clients.claim())
  );
});

// Helper to determine navigation requests
const isNavigationRequest = (req) => {
  return req.mode === 'navigate' || (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // ignore non-GET

  // For navigation (HTML) use network-first so users get latest index.html
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((networkResp) => {
          // update cache and return
          try {
            const cloned = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned)).catch(() => {});
          } catch (e) {
            // cloning failed (body already used or opaque), ignore cache update
            console.warn('SW: failed to clone response for caching', e);
          }
          return networkResp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // For other assets: try cache first, then network. If served from cache, update in background.
  // Special-case: fetch logo images network-first so updated logos propagate immediately
  try {
    const url = new URL(req.url);
    const pathname = url.pathname || '';
    const isLogo = pathname.toLowerCase().includes('logo') || pathname.toLowerCase().includes('logotipo');
    if (isLogo || req.destination === 'image' && pathname.toLowerCase().includes('brand')) {
      event.respondWith(
        fetch(req)
          .then((networkResp) => {
            if (networkResp && networkResp.ok) {
              try {
                const cloned = networkResp.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned)).catch(() => {});
              } catch (e) { /* ignore */ }
            }
            return networkResp;
          })
          .catch(() => caches.match(req))
      );
      return;
    }

    // Default: cache-first with background update
    event.respondWith(
      caches.match(req).then((cachedResp) => {
        const networkFetch = fetch(req).then((networkResp) => {
          if (networkResp && networkResp.ok) {
            try {
              const cloned = networkResp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned)).catch(() => {});
            } catch (e) { /* ignore */ }
          }
          return networkResp;
        }).catch(() => null);

        return cachedResp || networkFetch;
      })
    );
  } catch (err) {
    // fallback safe behavior
    event.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});

// Allow the page to tell the SW to skipWaiting (used during deploy)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
