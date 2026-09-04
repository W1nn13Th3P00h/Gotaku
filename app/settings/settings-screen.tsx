'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage, inputClasses } from '@/components/ui/field'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'
import { ToggleChip } from '@/components/ui/chip'
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
    try {
      // Pas besoin de lire le résultat ici : `getPermissionSnapshot` est relu
      // à chaque rendu, y compris celui déclenché par `setActivating(false)`
      // ci-dessous, donc reflète déjà l'état système à jour.
      await subscribeToPush()
    } finally {
      // Toujours réactiver le bouton, même si `subscribeToPush` a levé (ex.
      // NEXT_PUBLIC_VAPID_PUBLIC_KEY absente) : jamais bloqué en désactivé
      // sans possibilité de réessayer.
      setActivating(false)
    }
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

  function markDirty() {
    setSaveError(null)
    setSaved(false)
  }

  function toggleWeekday(value: number) {
    markDirty()
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
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader title="Réglages" />
      </div>

      <section className="mt-6">
        {!installed ? (
          <Card className="text-sm">
            <p className="font-medium">Ajoute Gokaku à ton écran d&apos;accueil</p>
            <p className="mt-2 text-muted">
              Dans Safari, appuie sur l&apos;icône de partage puis « Sur l&apos;écran d&apos;accueil ».
              Les notifications de rappel ne fonctionnent que depuis l&apos;application installée.
            </p>
          </Card>
        ) : permission === 'granted' ? (
          <Card className="text-sm text-muted">Notifications activées.</Card>
        ) : permission === 'denied' ? (
          <Card className="text-sm text-muted">
            Notifications refusées. Pour les activer, change l&apos;autorisation dans les réglages du
            système, puis reviens ici.
          </Card>
        ) : permission === 'unsupported' ? (
          <Card className="text-sm text-muted">
            Les notifications ne sont pas prises en charge sur cet appareil.
          </Card>
        ) : (
          <Button variant="primary" size="lg" block onClick={handleActivate} disabled={activating}>
            {activating ? 'Activation…' : 'Activer les notifications'}
          </Button>
        )}
      </section>

      <Card className="mt-8">
        <h2 className="text-sm font-medium">Rappel quotidien</h2>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Heure" inline>
            <input
              type="time"
              value={timeLocal}
              onChange={(e) => {
                setTimeLocal(e.target.value)
                markDirty()
              }}
              className={`${inputClasses} w-auto`}
            />
          </Field>

          <fieldset>
            <legend className="text-sm">Jours</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <ToggleChip
                  key={day.value}
                  selected={weekdays.includes(day.value)}
                  onClick={() => toggleWeekday(day.value)}
                >
                  <span className="sr-only">{day.label}</span>
                  <span aria-hidden="true">{day.label.slice(0, 3)}</span>
                </ToggleChip>
              ))}
            </div>
          </fieldset>

          <Field label="Fuseau horaire">
            <input
              type="text"
              value={timezone}
              onChange={(e) => {
                setTimezoneOverride(e.target.value)
                markDirty()
              }}
              className={inputClasses}
            />
          </Field>

          <Field label="Rappel actif" inline>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => {
                setActive(e.target.checked)
                markDirty()
              }}
              className="h-5 w-5 accent-accent"
            />
          </Field>

          {saveError ? <FormMessage kind="error">{saveError}</FormMessage> : null}
          {saved ? <FormMessage kind="success">Rappel sauvegardé.</FormMessage> : null}

          <Button variant="primary" block onClick={handleSave}>
            Sauvegarder
          </Button>
        </div>
      </Card>

      {/*
        La déconnexion vit ici et non sur l'accueil : `docs/spec.md` limite
        l'accueil à la génération, au rappel, à la dernière séance et aux accès
        modèles/banque/historique, « rien d'autre ».
      */}
      <Section title="Compte" className="mt-8">
        <form action="/auth/signout" method="post">
          <Button type="submit" block>
            Se déconnecter
          </Button>
        </form>
      </Section>
    </Page>
  )
}
