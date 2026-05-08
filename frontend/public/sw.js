/* Zantia Formação — Service Worker (PWA, root-scope deploy) */
const CACHE_NAME = 'zantia-formacao-v5-' + new Date().toISOString().slice(0,10);
const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS).catch(() => null))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
    }
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);

  // Never cache cross-origin or API calls
  if (u.pathname.includes('/api/') || u.origin !== self.location.origin) return;

  // Network-first for navigation (always serve fresh HTML when online)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((r) => {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, r.clone())).catch(() => null);
          return r;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match('/')))
    );
    return;
  }

  // Cache-first for hashed static assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached ||
      fetch(e.request).then((r) => {
        if (r && r.status === 200 && r.type === 'basic') {
          const cp = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, cp)).catch(() => null);
        }
        return r;
      }).catch(() => cached)
    )
  );
});
