/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-9aae65bfe0';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=9aae65bfe0',
  '/js/api/poolApi.js?v=9aae65bfe0',
  '/js/components/blocks.js?v=9aae65bfe0',
  '/js/components/charts.js?v=9aae65bfe0',
  '/js/components/diagnostics.js?v=9aae65bfe0',
  '/js/components/modals.js?v=9aae65bfe0',
  '/js/components/shares.js?v=9aae65bfe0',
  '/js/components/websocket.js?v=9aae65bfe0',
  '/js/components/workers.js?v=9aae65bfe0',
  '/js/config.js?v=9aae65bfe0',
  '/js/cord.js?v=9aae65bfe0',
  '/js/main.js?v=9aae65bfe0',
  '/js/state.js?v=9aae65bfe0',
  '/js/theme.js?v=9aae65bfe0',
  '/js/utils/dom.js?v=9aae65bfe0',
  '/js/utils/formatters.js?v=9aae65bfe0',
  '/js/utils/notifications.js?v=9aae65bfe0',
  '/js/utils/storage.js?v=9aae65bfe0',
  '/main.js?v=9aae65bfe0',
  '/vendor/decimal.min.js?v=9aae65bfe0',
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
