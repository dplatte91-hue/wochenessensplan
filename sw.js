// Macht die App offline nutzbar (z. B. bei schlechtem Empfang im Supermarkt).
// Strategie: erst Netz, bei Fehler die zuletzt gespeicherte Version.
// Die Datenbank-Verbindung von Firebase wird nicht angefasst – sie hat ihren eigenen Offline-Speicher.
const CACHE = 'essensplan-v2';
const CACHED_ORIGINS = [self.location.origin, 'https://www.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !CACHED_ORIGINS.includes(url.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
