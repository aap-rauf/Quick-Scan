const CACHE_NAME = "easy-scan-cache-v1";
const assetsToCache = [
  ".",
  "index.html",
  "manifest.json",
  "style.css",
  "script.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Try cache first, then network, then fallback to cache
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request).catch(() => caches.match('index.html'));
    })
  );
});
