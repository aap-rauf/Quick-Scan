const CACHE = "easy-scan-v1.0.5";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS);
    })
  );

  // Do NOT activate immediately.
  // The webpage will ask the user before updating.
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key =>
          key !== CACHE
            ? caches.delete(key)
            : null
        )
      )
    )
  );

  self.clients.claim();
});

// Allow the webpage to activate the new version
self.addEventListener("message", event => {
  if (
    event.data &&
    event.data.action === "skipWaiting"
  ) {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestURL =
    new URL(event.request.url);

  // IMPORTANT:
  // Never cache Google Sheets requests.
  // Inventory must always come from Google Sheets.
  if (
    requestURL.hostname === "docs.google.com"
  ) {
    return;
  }

  // Keep the existing caching behavior
  // for the Easy Scan app and other resources.
  event.respondWith(
    caches.match(event.request).then(cached => {

      if (cached) {
        return cached;
      }

      return fetch(event.request).then(response => {

        if (
          !response ||
          response.status !== 200
        ) {
          return response;
        }

        const copy = response.clone();

        caches.open(CACHE).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      });
    })
  );
});
