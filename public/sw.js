// Service worker minimal : aucune mise en cache (hors périmètre v1, voir
// research.md § Manifest et service worker). `install`/`activate` prennent
// simplement le contrôle sans délai ; `push`/`notificationclick` sont ajoutés
// par T017.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
