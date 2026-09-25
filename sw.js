// Service Worker: cached die App-Shell (HTML/Icons/Manifest) nur als Offline-Rückfallebene.
// Telegram-Anfragen (Foto senden, auf Rückmeldung pollen) laufen bewusst NICHT über den
// Cache, sondern immer direkt über das Netz - brauchen ohnehin eine aktive Verbindung.
//
// WICHTIG für Updates: APP_VERSION hier bei jeder inhaltlichen Änderung hochzählen (synchron
// zur Versionsnummer im Info-Bereich von index.html). Nur so unterscheidet sich diese Datei
// byteweise von der vorigen Version, der Browser erkennt das Update zuverlässig, verwirft den
// alten Cache (siehe "activate" unten) und lädt die neuen Dateien frisch nach.

const APP_VERSION = "1.0.2";
const CACHE_NAME = "teecharge-shell-" + APP_VERSION;
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nur eigene Dateien behandeln - alles andere (Telegram-API) unangetastet ans Netz durchreichen.
  if (url.origin !== self.location.origin || event.request.method !== "GET") {
    return;
  }

  const isAppShellDoc =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/");

  if (isAppShellDoc) {
    // Network-first für die App-Seite selbst: jedes Öffnen mit bestehender Verbindung lädt
    // garantiert die aktuell deployte Version. Der Cache dient nur als Rückfallebene.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Icons/Manifest ändern sich praktisch nie: cache-first, im Hintergrund aktualisiert.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
