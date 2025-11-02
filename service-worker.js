const CACHE_NAME = "easy-scan-cache-v2";
const assetsToCache = [
  "./",
  "index.html",
  "manifest.json",
  "style.css",
  "script.js",
  "data_part_1.json",
  "data_part_2.json",
  "data_part_3.json",
  "data_part_4.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// Install: pre-cache all assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(assetsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch: serve cached first, then network fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          // cache dynamically fetched JSON
          if (request.url.endsWith(".json")) {
            const clonedResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse));
          }
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
