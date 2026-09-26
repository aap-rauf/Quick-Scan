// ============================================================
// EASY SCAN SERVICE WORKER
// ============================================================

const CACHE = "easy-scan-v1.0.8";

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

    caches.open(CACHE).then(cache => {

      return cache.addAll(ASSETS);

    })

  );

});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

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
// APP UPDATE BUTTON
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

  if (event.request.method !== "GET") {
    return;
  }


  const requestURL =
    new URL(event.request.url);


  // ========================================================
  // GOOGLE SHEETS
  // ========================================================
  //
  // DO NOT CACHE GOOGLE SHEET HERE.
  //
  // script.js downloads it directly and saves
  // the latest successful inventory in localStorage.
  //

  if (
    requestURL.hostname === "docs.google.com"
  ) {

    return;

  }


  // ========================================================
  // APP FILES / OTHER RESOURCES
  // ========================================================

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        if (cachedResponse) {

          return cachedResponse;

        }


        return fetch(event.request)
          .then(networkResponse => {

            if (
              !networkResponse ||
              networkResponse.status !== 200
            ) {

              return networkResponse;

            }


            const copy =
              networkResponse.clone();


            caches.open(CACHE)
              .then(cache => {

                cache.put(
                  event.request,
                  copy
                );

              });


            return networkResponse;

          })

          .catch(() => {

            // If the request cannot be reached,
            // return an offline response instead
            // of causing an unhandled failure.

            return new Response(
              "Offline",
              {
                status: 503,
                headers: {
                  "Content-Type":
                    "text/plain"
                }
              }
            );

          });

      })

  );

});
