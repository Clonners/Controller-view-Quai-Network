/* Kataribe panel — service worker (offline copy of the static shell) */

/* build:assets:start — written by `python3 build.py --stamp`; do not edit by hand */
const CACHE = 'panel-ascii-b54d6479d2';
const ASSETS = [
  '/',
  '/index.html',
  '/mining.html',
  '/controller_view.html',
  '/404.html',
  '/css/panel.css?v=b54d6479d2',
  '/js/api/poolApi.js?v=b54d6479d2',
  '/js/components/blocks.js?v=b54d6479d2',
  '/js/components/charts.js?v=b54d6479d2',
  '/js/components/diagnostics.js?v=b54d6479d2',
  '/js/components/modals.js?v=b54d6479d2',
  '/js/components/shares.js?v=b54d6479d2',
  '/js/components/websocket.js?v=b54d6479d2',
  '/js/components/workers.js?v=b54d6479d2',
  '/js/config.js?v=b54d6479d2',
  '/js/frame.js?v=b54d6479d2',
  '/js/main.js?v=b54d6479d2',
  '/js/state.js?v=b54d6479d2',
  '/js/theme.js?v=b54d6479d2',
  '/js/utils/dom.js?v=b54d6479d2',
  '/js/utils/formatters.js?v=b54d6479d2',
  '/js/utils/notifications.js?v=b54d6479d2',
  '/js/utils/storage.js?v=b54d6479d2',
  '/main.js?v=b54d6479d2',
  '/vendor/decimal.min.js?v=b54d6479d2',
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
  // /nuevo/ is a separate page with its own release cadence: never cache it here.
  if (requestUrl.pathname.startsWith('/nuevo/') || requestUrl.pathname === '/nuevo') return;

  // Network first, so a new release is seen on the next visit; the cached copy
  // is used only when the network fails (offline).
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then((r) => r || caches.match('/404.html'))
    )
  );
});
