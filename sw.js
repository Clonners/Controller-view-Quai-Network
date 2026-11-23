/* Kataribe · app instalable (estandar/app, APP-PAQUETE.md). Service worker mínimo: NO guarda nada y NO atiende pedidos.
   Sin manejador de «fetch» cada pedido va directo a la red, como sin service worker: ni páginas, ni /api, ni montos, ni sesión,
   ni cookies quedan en una copia (O25, O34). Al activarse borra las copias que haya dejado un service worker viejo; si había alguna,
   la página que se está viendo puede venir de esa copia y se vuelve a pedir a la red una sola vez. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))).then(() => ks.length
    ? self.clients.claim().then(() => self.clients.matchAll({ type: 'window' })).then((cs) => cs.forEach((c) => c.navigate(c.url)))
    : null)));
});
