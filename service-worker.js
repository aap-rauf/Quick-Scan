// ============================================================
// EASY SCAN SERVICE WORKER
// ============================================================

const CACHE = "easy-scan-v1.1.5";

const INVENTORY_BACKUP_CACHE = "easyScanInventoryBackup-v1";

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

    caches.open(CACHE).then(async cache => {

      await cache.addAll(ASSETS);

      // Activate this version immediately.
      await self.skipWaiting();

    })

  );

});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", event => {

  event.waitUntil(

    (async () => {

      const keys = await caches.keys();

      await Promise.all(

        keys.map(key => {

          if (key !== CACHE && key !== INVENTORY_BACKUP_CACHE) {
            return caches.delete(key);
          }

          return null;

        })

      );

      // Start controlling open pages immediately.
      await self.clients.claim();

    })()

  );

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
  // NAVIGATION
  // ========================================================
  //
  // IMPORTANT:
  // When Easy Scan is closed and opened again while offline,
  // the browser makes a new navigation request for the app.
  //
  // Always use the cached index.html as the offline fallback.
  //

  if (event.request.mode === "navigate") {

    event.respondWith(

      caches.match("./index.html")

        .then(cachedPage => {

          // IMPORTANT:
          // If the app was opened before, return the cached page
          // immediately. Do NOT wait for a network timeout.
          if (cachedPage) {
            return cachedPage;
          }

          // First-ever load still uses the network.
          return fetch(event.request)

            .then(networkResponse => {

              if (
                networkResponse &&
                networkResponse.status === 200
              ) {

                const copy =
                  networkResponse.clone();

                caches.open(CACHE)
                  .then(cache => {
                    cache.put(
                      "./index.html",
                      copy
                    );
                  });

              }

              return networkResponse;

            })

            .catch(() => {

              return new Response(
                "Easy Scan is not available offline yet. Open it once while online.",
                {
                  status: 503,
                  headers: {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                }
              );

            });

        })

    );

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


            // Cache successful same-origin resources
            // and CORS resources such as JsBarcode.
            const copy =
              networkResponse.clone();

            caches.open(CACHE)
              .then(cache => {

                cache.put(
                  event.request,
                  copy
                ).catch(() => {
                  // Ignore resources the browser does not
                  // allow CacheStorage to store.
                });

              });


            return networkResponse;

          })

          .catch(() => {

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
