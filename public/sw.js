// Service worker minimal : aucune mise en cache (hors périmètre v1, voir
// research.md § Manifest et service worker). `install`/`activate` prennent
// simplement le contrôle sans délai.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// T017 : affiche la notification reçue. Payload envoyé par
// supabase/functions/send-reminders (JSON { title, body }) ; repli si absent
// ou non-JSON plutôt que de planter le service worker.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || 'Gokaku'
  const body = data.body || "C'est l'heure de ta séance."

  event.waitUntil(self.registration.showNotification(title, { body }))
})

// FR-015 : ouvre directement l'écran générateur, jamais l'accueil.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/generateur'))
})
