const CACHE_NAME = "satark-v4";

const FILES_TO_CACHE = [
  "./",
  "./Index.html",
  "./style.css",
  "./app.js",
  "./Assets/satark-drishti-logo.jpeg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response.ok) {
          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseCopy);
          });
        }

        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cachedFile) {
          if (cachedFile) return cachedFile;

          if (event.request.mode === "navigate") {
            return caches.match("./Index.html");
          }

          return Response.error();
        });
      })
  );
});