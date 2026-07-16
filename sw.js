const CACHE = 'label-studio-po-box-prefix-20260716-v23';

const BASE = self.location.pathname.replace(/\/sw\.js$/, '') || '';

// Core app files — must be available offline immediately
const PRECACHE = [
  BASE + '/index.html',
  BASE + '/viewer.html',
  BASE + '/excel-import.html',
  BASE + '/KSkin-data.js',
  BASE + '/KSkin.jpg',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png'
];

// CDN resources cached lazily on first use — not blocking install
const CDN_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(PRECACHE.map(url =>
        c.add(url).catch(err => console.warn('Precache skipped:', url, err))
      ))
    )
    // Note: CDN resources are NOT in addAll — a CDN failure won't
    // break the service worker install
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only cache GET requests
  if (e.request.method !== 'GET') return;

  // Cloudflare Pages can redirect clean URLs/trailing-slash URLs. A redirected
  // response must not be replayed from a service worker, so navigations are
  // network-first and redirected responses are never cached.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.status === 200 && !response.redirected) {
          const toCache = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, toCache));
        }
        return response;
      }).catch(() =>
        caches.match(e.request).then(cached => {
          if (cached && !cached.redirected) return cached;
          return caches.match(BASE + '/index.html');
        })
      )
    );
    return;
  }

  // For CDN resources: cache on first successful fetch, serve from cache after
  if (CDN_CACHE.includes(e.request.url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200 && !response.redirected) {
            const toCache = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // For same-origin requests only: cache-first, network fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached && !cached.redirected) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200 && !response.redirected) {
            const toCache = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          }
          return response;
        });
      })
    );
  }
  // All other origins (analytics, etc.) — fetch without caching
});
