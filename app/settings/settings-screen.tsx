'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import { subscribeToPush } from '@/lib/push/subscribe'

/**
 * Écran de réglages : installation PWA + activation des notifications (US1),
 * formulaire du rappel (US2, ajouté par une tâche suivante). Voir
 * `contracts/settings-screen.md`.
 *
 * `installed`/`permission` sont lus via `useSyncExternalStore` plutôt que
 * `useState`+`useEffect` : ce sont des valeurs externes au rendu React
 * (`display-mode`, `Notification.permission`) qui diffèrent forcément entre le
 * rendu serveur (aucune info navigateur) et le client — le cas exact que cette
 * API est faite pour couvrir sans avertissement d'hydratation ni
 * `setState` synchrone dans un effet.
 */

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/** Pas d'évènement fiable pour ces deux lectures : la resouscription n'a rien à faire. */
function subscribeNoop() {
  return () => {}
}

/** `research.md` § Détection de l'installation : `display-mode`, pas `beforeinstallprompt`. */
function getInstalledSnapshot(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // Repli Safari iOS plus ancien.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function getInstalledServerSnapshot(): boolean {
  return false
}

function getPermissionSnapshot(): PermissionState {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function getPermissionServerSnapshot(): PermissionState {
  return 'unsupported'
}

export function SettingsScreen() {
  const installed = useSyncExternalStore(
    subscribeNoop,
    getInstalledSnapshot,
    getInstalledServerSnapshot,
  )
  const permission = useSyncExternalStore(
    subscribeNoop,
    getPermissionSnapshot,
    getPermissionServerSnapshot,
  )
  const [activating, setActivating] = useState(false)

  // T004 : enregistrement du service worker, condition préalable à tout
  // abonnement (Phase 2, Foundational). Jamais de demande de permission ici.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  async function handleActivate() {
    if (activating) return
    setActivating(true)
    // Pas besoin de lire le résultat ici : `getPermissionSnapshot` est relu à
    // chaque rendu, y compris celui déclenché par `setActivating(false)`
    // ci-dessous, donc reflète déjà l'état système à jour.
    await subscribeToPush()
    setActivating(false)
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <section className="mt-6">
        {!installed ? (
          <div className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">Ajoute Gokaku à ton écran d&apos;accueil</p>
            <p className="mt-2 text-muted">
              Dans Safari, appuie sur l&apos;icône de partage puis « Sur l&apos;écran d&apos;accueil ».
              Les notifications de rappel ne fonctionnent que depuis l&apos;application installée.
            </p>
          </div>
        ) : permission === 'granted' ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted">
            Notifications activées.
          </p>
        ) : permission === 'denied' ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted">
            Notifications refusées. Pour les activer, change l&apos;autorisation dans les réglages du
            système, puis reviens ici.
          </p>
        ) : permission === 'unsupported' ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted">
            Les notifications ne sont pas prises en charge sur cet appareil.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="w-full rounded-lg bg-accent py-4 text-base font-medium text-accent-foreground disabled:opacity-40"
          >
            Activer les notifications
          </button>
        )}
      </section>
    </main>
  )
}
