const CACHE = "padelhub-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./vivo.html",
  "./marcador.html",
  "./ligas.html",
  "./torneos.html",
  "./admin.html",
  "./css/styles.css",
  "./css/hub.css",
  "./js/app.js",
  "./js/scoring.js",
  "./js/sounds.js",
  "./js/sync.js",
  "./js/firebase-config.js",
  "./js/procup-data.js",
  "./js/hub-nav.js",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      return Promise.allSettled(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" }).then((res) => {
            if (res.ok) return c.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  // Let external URLs (Firebase, Google Fonts, CDNs) pass directly
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Network-first for JS and HTML to ensure real-time admin sync
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(e.request).then((cached) => {
          return cached || (e.request.mode === "navigate" ? caches.match("./index.html") : null);
        });
      })
  );
});
