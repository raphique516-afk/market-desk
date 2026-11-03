// Market Desk offline support: app shell cached; data fetched fresh when online, last copy used offline.
const CACHE = "market-desk-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Network first for everything on our origin, falling back to the last cached copy.
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname.endsWith("data.enc.json") ? "data.enc.json" : e.request, copy)); }
    return r;
  }).catch(() => caches.match(url.pathname.endsWith("data.enc.json") ? "data.enc.json" : e.request).then(m => m || caches.match("index.html"))));
});
