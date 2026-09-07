const CACHE = "kicker-app-v2";
const CORE_ASSETS = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for everything: always get the latest app when online,
// only fall back to the cached copy if there's no connection at all.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Keep the cache updated with whatever we just fetched, for offline fallback
        const responseClone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, responseClone)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
