/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-e05cb9a8bd';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=e05cb9a8bd',
  '/js/api/poolApi.js?v=e05cb9a8bd',
  '/js/components/blocks.js?v=e05cb9a8bd',
  '/js/components/charts.js?v=e05cb9a8bd',
  '/js/components/diagnostics.js?v=e05cb9a8bd',
  '/js/components/modals.js?v=e05cb9a8bd',
  '/js/components/shares.js?v=e05cb9a8bd',
  '/js/components/websocket.js?v=e05cb9a8bd',
  '/js/components/workers.js?v=e05cb9a8bd',
  '/js/config.js?v=e05cb9a8bd',
  '/js/cord.js?v=e05cb9a8bd',
  '/js/main.js?v=e05cb9a8bd',
  '/js/state.js?v=e05cb9a8bd',
  '/js/theme.js?v=e05cb9a8bd',
  '/js/utils/dom.js?v=e05cb9a8bd',
  '/js/utils/formatters.js?v=e05cb9a8bd',
  '/js/utils/notifications.js?v=e05cb9a8bd',
  '/js/utils/storage.js?v=e05cb9a8bd',
  '/main.js?v=e05cb9a8bd',
  '/vendor/decimal.min.js?v=e05cb9a8bd',
  '/site.webmanifest',
  '/fonts/jetbrains-mono-kataribe.woff2',
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
