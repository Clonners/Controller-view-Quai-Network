/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-d689eb0615';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=d689eb0615',
  '/js/api/poolApi.js?v=d689eb0615',
  '/js/components/blocks.js?v=d689eb0615',
  '/js/components/charts.js?v=d689eb0615',
  '/js/components/diagnostics.js?v=d689eb0615',
  '/js/components/modals.js?v=d689eb0615',
  '/js/components/shares.js?v=d689eb0615',
  '/js/components/websocket.js?v=d689eb0615',
  '/js/components/workers.js?v=d689eb0615',
  '/js/config.js?v=d689eb0615',
  '/js/frame.js?v=d689eb0615',
  '/js/main.js?v=d689eb0615',
  '/js/state.js?v=d689eb0615',
  '/js/theme.js?v=d689eb0615',
  '/js/utils/dom.js?v=d689eb0615',
  '/js/utils/formatters.js?v=d689eb0615',
  '/js/utils/notifications.js?v=d689eb0615',
  '/js/utils/storage.js?v=d689eb0615',
  '/main.js?v=d689eb0615',
  '/vendor/decimal.min.js?v=d689eb0615',
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
