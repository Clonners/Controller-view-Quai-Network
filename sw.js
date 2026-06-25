/* BitQuai Service Worker — PWA Offline Cache */
const CACHE = 'bitquai-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/qdex.html',
  '/404.html',
  '/css/brand.css',
  '/css/styles.css',
  '/controller_styles.css',
  '/vendor/chart.min.js',
  '/vendor/lightweight-charts.cjs.js',
  '/vendor/decimal.min.js',
  '/main.js',
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
  // Cache-first for assets, network-first for API
  if (e.request.url.includes('/api/') || e.request.url.includes('/v1/')) {
    return; // network only
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match('/404.html')))
  );
});
