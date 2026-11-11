/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-f42ee70fa0';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=f42ee70fa0',
  '/js/api/poolApi.js?v=f42ee70fa0',
  '/js/components/blocks.js?v=f42ee70fa0',
  '/js/components/charts.js?v=f42ee70fa0',
  '/js/components/diagnostics.js?v=f42ee70fa0',
  '/js/components/modals.js?v=f42ee70fa0',
  '/js/components/shares.js?v=f42ee70fa0',
  '/js/components/websocket.js?v=f42ee70fa0',
  '/js/components/workers.js?v=f42ee70fa0',
  '/js/config.js?v=f42ee70fa0',
  '/js/cord.js?v=f42ee70fa0',
  '/js/main.js?v=f42ee70fa0',
  '/js/state.js?v=f42ee70fa0',
  '/js/theme.js?v=f42ee70fa0',
  '/js/utils/dom.js?v=f42ee70fa0',
  '/js/utils/formatters.js?v=f42ee70fa0',
  '/js/utils/notifications.js?v=f42ee70fa0',
  '/js/utils/storage.js?v=f42ee70fa0',
  '/main.js?v=f42ee70fa0',
  '/vendor/decimal.min.js?v=f42ee70fa0',
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
