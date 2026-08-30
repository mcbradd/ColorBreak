// `build` is injected in the registration URL by the immutable application
// bundle. Each publish therefore activates a distinct cache and removes old
// ColorBreak caches without relying on a manually edited version label.
const BUILD = new URL(self.location.href).searchParams.get("build") || "unknown";
const CACHE = `colorbreak-${BUILD}`;
const CACHE_PREFIX = "colorbreak-";
const CORE = [
  "./",
  "./manifest.webmanifest",
  "./icon.svg",
  "./methodology.html",
  "./data/products.json",
  "./data/corrections.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const scopePath = self.location.pathname.replace(/\/[^/]*$/, "/");
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;

  // Never persist navigations or shared/query URLs: these can contain a public
  // buyer setup and must not become browser-cache history.
  if (event.request.mode === "navigate" || url.search) {
    event.respondWith(fetch(event.request).catch(() => caches.match("./")));
    return;
  }
  const immutable = url.pathname.startsWith(`${scopePath}assets/`) || url.pathname.startsWith(`${scopePath}data/`) || /\.(?:js|css|svg|json|webmanifest)$/i.test(url.pathname);
  if (!immutable) return;
  // Price snapshots and app files are always requested from the network first.
  // The cached response is only an offline fallback, so a fresh publication is
  // never hidden behind a previously cached snapshot.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.open(CACHE).then((cache) => cache.match(event.request))),
  );
});
