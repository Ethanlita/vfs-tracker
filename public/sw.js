const BUILD_ID = '__BUILD_ID__';
const APP_CACHE = `vfs-app-${BUILD_ID}`;
const RUNTIME_CACHE = `vfs-runtime-${BUILD_ID}`;
const STATIC_ASSET_CACHE = 'vfs-static-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(APP_CACHE);
        await cache.addAll(APP_SHELL);
      } catch (error) {
        console.warn('[sw] Failed to precache app shell', error);
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE && key !== STATIC_ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(APP_CACHE);
          cache.put('/index.html', networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cache = await caches.open(APP_CACHE);
          const cached = await cache.match('/index.html');
          if (cached) {
            return cached;
          }
          throw error;
        }
      })()
    );
    return;
  }

  const destination = request.destination;

  if (destination === 'script' || destination === 'style' || destination === 'font') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) {
          fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
            })
            .catch(() => {});
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          if (cached) {
            return cached;
          }
          throw error;
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
          })
          .catch(() => {});
        return cached;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (cached) {
          return cached;
        }
        throw error;
      }
    })()
  );
});
