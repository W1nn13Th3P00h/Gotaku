'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { upsertReminder, type Reminder } from '@/lib/push/queries'
import { subscribeToPush } from '@/lib/push/subscribe'
import { createClient } from '@/lib/supabase/client'

/**
 * Écran de réglages : installation PWA + activation des notifications (US1),
 * formulaire du rappel (US2). Voir `contracts/settings-screen.md`.
 *
 * `installed`/`permission`/`detectedTimezone` sont lus via
 * `useSyncExternalStore` plutôt que `useState`+`useEffect` : ce sont des
 * valeurs externes au rendu React qui diffèrent forcément entre le rendu
 * serveur (aucune info navigateur) et le client — le cas exact que cette API
 * est faite pour couvrir sans avertissement d'hydratation ni `setState`
 * synchrone dans un effet.
 */

type Props = {
  reminder: Reminder | null
}

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

const WEEKDAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
] as const

/** Pas d'évènement fiable pour ces lectures : la resouscription n'a rien à faire. */
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

function getDetectedTimezoneSnapshot(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function getDetectedTimezoneServerSnapshot(): string {
  return ''
}

export function SettingsScreen({ reminder }: Props) {
  const supabase = useMemo(() => createClient(), [])

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
  const detectedTimezone = useSyncExternalStore(
    subscribeNoop,
    getDetectedTimezoneSnapshot,
    getDetectedTimezoneServerSnapshot,
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

  const [timeLocal, setTimeLocal] = useState(reminder?.timeLocal ?? '07:00')
  const [weekdays, setWeekdays] = useState<number[]>(reminder?.weekdays ?? [])
  // `null` tant que l'utilisateur n'a pas modifié le champ à la main : la
  // timezone détectée (potentiellement différente entre le rendu serveur et le
  // client, voir plus haut) reste alors la valeur affichée/soumise.
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(
    reminder?.timezone ?? null,
  )
  const [active, setActive] = useState(reminder?.active ?? false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const timezone = timezoneOverride ?? detectedTimezone

  function toggleWeekday(value: number) {
    setSaveError(null)
    setSaved(false)
    setWeekdays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value].sort((a, b) => a - b),
    )
  }

  async function handleSave() {
    setSaveError(null)
    setSaved(false)
    const result = await upsertReminder(supabase, { timeLocal, weekdays, timezone, active })
    if (!result.ok) {
      setSaveError('Sélectionne au moins un jour pour activer le rappel.')
      return
    }
    setSaved(true)
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

      <section className="mt-8 rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">Rappel quotidien</h2>

        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          Heure
          <input
            type="time"
            value={timeLocal}
            onChange={(e) => {
              setTimeLocal(e.target.value)
              setSaveError(null)
              setSaved(false)
            }}
            className="rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm">Jours</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                aria-pressed={weekdays.includes(day.value)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm ' +
                  (weekdays.includes(day.value)
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border')
                }
              >
                {day.label.slice(0, 3)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex flex-col gap-1 text-sm">
          Fuseau horaire
          <input
            type="text"
            value={timezone}
            onChange={(e) => {
              setTimezoneOverride(e.target.value)
              setSaveError(null)
              setSaved(false)
            }}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>

        <label className="mt-4 flex items-center justify-between gap-3 text-sm">
          Rappel actif
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
              setSaveError(null)
              setSaved(false)
            }}
            className="h-5 w-5"
          />
        </label>

        {saveError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
        ) : null}
        {saved ? <p className="mt-3 text-sm text-muted">Rappel sauvegardé.</p> : null}

        <button
          type="button"
          onClick={handleSave}
          className="mt-4 w-full rounded-lg bg-accent py-3 text-sm font-medium text-accent-foreground"
        >
          Sauvegarder
        </button>
      </section>
    </main>
  )
}
