/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-3f5e57cd54';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=3f5e57cd54',
  '/js/api/poolApi.js?v=3f5e57cd54',
  '/js/components/blocks.js?v=3f5e57cd54',
  '/js/components/charts.js?v=3f5e57cd54',
  '/js/components/diagnostics.js?v=3f5e57cd54',
  '/js/components/modals.js?v=3f5e57cd54',
  '/js/components/shares.js?v=3f5e57cd54',
  '/js/components/websocket.js?v=3f5e57cd54',
  '/js/components/workers.js?v=3f5e57cd54',
  '/js/config.js?v=3f5e57cd54',
  '/js/frame.js?v=3f5e57cd54',
  '/js/main.js?v=3f5e57cd54',
  '/js/state.js?v=3f5e57cd54',
  '/js/theme.js?v=3f5e57cd54',
  '/js/utils/dom.js?v=3f5e57cd54',
  '/js/utils/formatters.js?v=3f5e57cd54',
  '/js/utils/notifications.js?v=3f5e57cd54',
  '/js/utils/storage.js?v=3f5e57cd54',
  '/main.js?v=3f5e57cd54',
  '/vendor/decimal.min.js?v=3f5e57cd54',
  '/site.webmanifest',
  '/fonts/jetbrains-mono-kataribe-em1200.woff2',
  '/brand/favicon.svg',
  '/brand/favicon-32.png',
  '/brand/icon-180.png',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
];
/* build:assets:end */

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
