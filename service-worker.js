// ============================================================
// EASY SCAN SERVICE WORKER
// ============================================================

const CACHE = "easy-scan-v1.0.6";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


// ============================================================
// INSTALL
// ============================================================

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE)
      .then(cache => {

        return cache.addAll(ASSETS);

      })

  );

  // IMPORTANT:
  // Do NOT call skipWaiting() here.
  //
  // The app will ask the user:
  // "New version available. Update now?"
  //
});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(keys => {

        return Promise.all(

          keys.map(key => {

            if (key !== CACHE) {

              return caches.delete(key);

            }

            return null;

          })

        );

      })

  );

  self.clients.claim();

});


// ============================================================
// UPDATE BUTTON FROM index.html
// ============================================================

self.addEventListener("message", event => {

  if (
    event.data &&
    event.data.action === "skipWaiting"
  ) {

    self.skipWaiting();

  }

});


// ============================================================
// FETCH
// ============================================================

self.addEventListener("fetch", event => {

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }


  const requestURL =
    new URL(event.request.url);


  // ========================================================
  // GOOGLE SHEET
  // ========================================================
  //
  // NEVER cache the Google Sheet in Service Worker.
  //
  // script.js handles the inventory:
  //
  // Internet:
  //     Download latest Sheet
  //
  // Changed:
  //     Save new inventory
  //
  // Unchanged:
  //     Keep existing inventory
  //
  // Offline:
  //     Use saved inventory
  //
  // ========================================================

  if (
    requestURL.hostname ===
    "docs.google.com"
  ) {

    return;

  }


  // ========================================================
  // APP + OTHER RESOURCES
  // ========================================================

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        // Use cached version first
        if (cachedResponse) {

          return cachedResponse;

        }


        // Not cached → try network
        return fetch(event.request)

          .then(networkResponse => {

            if (
              !networkResponse ||
              networkResponse.status !== 200
            ) {

              return networkResponse;

            }


            // Save successful response
            const responseClone =
              networkResponse.clone();


            caches.open(CACHE)
              .then(cache => {

                cache.put(
                  event.request,
                  responseClone
                );

              });


            return networkResponse;

          });

      })

  );

});
