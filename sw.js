/* BitQuai Service Worker — PWA Offline Cache */
const CACHE = 'bitquai-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/site.webmanifest',
  '/css/brand.min.css',
  '/css/shared.css',
  '/css/styles.min.css',
  '/controller_styles.min.css',
  '/vendor/chart.min.js',
  '/vendor/decimal.min.js',
  '/main.js',
  '/js/main.js',
  '/js/state.js',
  '/js/config.js',
  '/js/api/poolApi.js',
  '/js/utils/formatters.js',
  '/js/utils/notifications.js',
  '/js/utils/storage.js',
  '/js/components/charts.js',
  '/js/components/blocks.js',
  '/js/components/workers.js',
  '/js/components/modals.js',
  '/js/components/diagnostics.js',
  '/js/components/shares.js',
  '/js/components/websocket.js',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/favicon.ico',
  '/assets/brand/bitquai-logo-nav.png',
  '/assets/brand/bitquai-icon-q-256.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Keep live pool/RPC requests network-only; cache only this site's static shell.
  if (e.request.method !== 'GET') return;
  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('/404.html')))
  );
});
