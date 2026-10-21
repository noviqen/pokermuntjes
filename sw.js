// Offline: eerst netwerk, anders uit cache.
const CACHE = 'pokermuntjes-6';
const BESTANDEN = ['./', 'index.html', 'style.css?v=6', 'app.js?v=6', 'manifest.json?v=1', 'icon-180.png?v=1', 'icon-192.png?v=1'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BESTANDEN))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const kopie = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, kopie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('index.html'))));
});
