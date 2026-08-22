const CACHE_NAME = 'snow-ball-cache-v6';
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg?v=6',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Promise.allSettled to prevent the overall install from failing if one of the resources has a transient error (e.g. 304 or redirect)
      return Promise.allSettled(
        PRE_CACHE_ASSETS.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn(`[Service Worker] Failed to pre-cache asset: ${asset}`, err);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => self.clients.claim());
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, and optionally update cache in background (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch errors (e.g. when offline)
          });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Cache newly requested assets dynamically
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Serve offline fallback if nav state
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
