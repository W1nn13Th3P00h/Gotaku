'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormMessage, inputClasses, selectClasses } from '@/components/ui/field'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'
import { ToggleChip } from '@/components/ui/chip'
import { createReminder, deleteReminder, updateReminder, type Reminder } from '@/lib/push/queries'
import { subscribeToPush } from '@/lib/push/subscribe'
import {
  EQUIPMENT,
  MOBILITY_FOCUSES,
  PRACTICES,
  equipmentLabel,
  mobilityFocusLabel,
  practiceLabel,
  type EquipmentCode,
  type MobilityFocusCode,
  type PracticeCode,
} from '@/lib/referentials'
import {
  updateAvailableEquipment,
  updateMajorDeficitFocus,
  updatePractices,
} from '@/lib/settings/queries'
import { createClient } from '@/lib/supabase/client'

/**
 * Écran de réglages : installation PWA + activation des notifications (Lot 5),
 * liste des rappels (US1/US2/US3 de `specs/006-multiple-reminders/`). Voir
 * `specs/006-multiple-reminders/contracts/settings-screen.md`.
 *
 * `installed`/`permission`/`detectedTimezone` sont lus via
 * `useSyncExternalStore` plutôt que `useState`+`useEffect` : ce sont des
 * valeurs externes au rendu React qui diffèrent forcément entre le rendu
 * serveur (aucune info navigateur) et le client — le cas exact que cette API
 * est faite pour couvrir sans avertissement d'hydratation ni `setState`
 * synchrone dans un effet.
 */

type Props = {
  reminders: Reminder[]
  availableEquipment: EquipmentCode[]
  practices: PracticeCode[]
  mainPractice: PracticeCode | null
  majorDeficitFocus: MobilityFocusCode | null
}

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * Une carte par rappel, existant ou en cours d'ajout. `key` est une clé locale
 * React stable, jamais envoyée à la base ; `id` reste `null` tant que la carte
 * n'a pas été sauvegardée au moins une fois.
 */
type ReminderDraft = {
  key: string
  id: string | null
  timeLocal: string
  weekdays: number[]
  timezone: string
  active: boolean
  saving: boolean
  saveError: string | null
  saved: boolean
}

let nextDraftKey = 0

function newReminderDraft(timezone: string): ReminderDraft {
  nextDraftKey += 1
  return {
    key: `new-${nextDraftKey}`,
    id: null,
    timeLocal: '07:00',
    weekdays: [],
    timezone,
    active: false,
    saving: false,
    saveError: null,
    saved: false,
  }
}

function draftFromReminder(reminder: Reminder): ReminderDraft {
  return {
    key: reminder.id,
    id: reminder.id,
    timeLocal: reminder.timeLocal,
    weekdays: reminder.weekdays,
    timezone: reminder.timezone,
    active: reminder.active,
    saving: false,
    saveError: null,
    saved: false,
  }
}

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

type ReminderCardProps = {
  draft: ReminderDraft
  onChange: (patch: Partial<ReminderDraft>) => void
  onSave: () => void
  onDelete: () => void
}

function ReminderCard({ draft, onChange, onSave, onDelete }: ReminderCardProps) {
  function toggleWeekday(value: number) {
    onChange({
      weekdays: draft.weekdays.includes(value)
        ? draft.weekdays.filter((d) => d !== value)
        : [...draft.weekdays, value].sort((a, b) => a - b),
      saveError: null,
      saved: false,
    })
  }

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4">
        <Field label="Heure" inline>
          <input
            type="time"
            value={draft.timeLocal}
            onChange={(e) => onChange({ timeLocal: e.target.value, saveError: null, saved: false })}
            className={`${inputClasses} w-auto`}
          />
        </Field>

        <fieldset>
          <legend className="text-sm">Jours</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <ToggleChip
                key={day.value}
                selected={draft.weekdays.includes(day.value)}
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
            value={draft.timezone}
            onChange={(e) => onChange({ timezone: e.target.value, saveError: null, saved: false })}
            className={inputClasses}
          />
        </Field>

        <Field label="Rappel actif" inline>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => onChange({ active: e.target.checked, saveError: null, saved: false })}
            className="h-5 w-5 accent-accent"
          />
        </Field>

        {draft.saveError ? <FormMessage kind="error">{draft.saveError}</FormMessage> : null}
        {draft.saved ? <FormMessage kind="success">Rappel sauvegardé.</FormMessage> : null}

        <div className="flex gap-2">
          <Button variant="primary" block onClick={onSave} disabled={draft.saving}>
            {draft.saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Button>
          {draft.id !== null ? (
            <Button block onClick={onDelete}>
              Supprimer
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export function SettingsScreen({
  reminders,
  availableEquipment,
  practices: initialPractices,
  mainPractice: initialMainPractice,
  majorDeficitFocus: initialMajorDeficitFocus,
}: Props) {
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

  const [reminderDrafts, setReminderDrafts] = useState<ReminderDraft[]>(() =>
    reminders.map(draftFromReminder),
  )

  const [equipment, setEquipment] = useState<EquipmentCode[]>(availableEquipment)
  const [equipmentSaving, setEquipmentSaving] = useState(false)
  const [equipmentSaved, setEquipmentSaved] = useState(false)

  function toggleEquipment(code: EquipmentCode) {
    setEquipmentSaved(false)
    setEquipment((prev) => (prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code]))
  }

  async function handleSaveEquipment() {
    setEquipmentSaving(true)
    await updateAvailableEquipment(supabase, equipment)
    setEquipmentSaving(false)
    setEquipmentSaved(true)
  }

  const [practices, setPractices] = useState<PracticeCode[]>(initialPractices)
  const [mainPractice, setMainPractice] = useState<PracticeCode | null>(initialMainPractice)
  const [practicesSaving, setPracticesSaving] = useState(false)
  const [practicesSaved, setPracticesSaved] = useState(false)

  function togglePractice(code: PracticeCode) {
    setPracticesSaved(false)
    setPractices((prev) => {
      if (!prev.includes(code)) return [...prev, code]
      // Décocher la pratique désignée comme principale la fait redevenir non désignée.
      if (mainPractice === code) setMainPractice(null)
      return prev.filter((p) => p !== code)
    })
  }

  async function handleSavePractices() {
    setPracticesSaving(true)
    await updatePractices(supabase, practices, mainPractice)
    setPracticesSaving(false)
    setPracticesSaved(true)
  }

  const [majorDeficitFocus, setMajorDeficitFocus] = useState<MobilityFocusCode | null>(
    initialMajorDeficitFocus,
  )
  const [majorDeficitFocusSaving, setMajorDeficitFocusSaving] = useState(false)
  const [majorDeficitFocusSaved, setMajorDeficitFocusSaved] = useState(false)

  function selectMajorDeficitFocus(code: MobilityFocusCode) {
    setMajorDeficitFocusSaved(false)
    setMajorDeficitFocus((prev) => (prev === code ? null : code))
  }

  async function handleSaveMajorDeficitFocus() {
    setMajorDeficitFocusSaving(true)
    await updateMajorDeficitFocus(supabase, majorDeficitFocus)
    setMajorDeficitFocusSaving(false)
    setMajorDeficitFocusSaved(true)
  }

  function patchDraft(key: string, patch: Partial<ReminderDraft>) {
    setReminderDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  function handleAddReminder() {
    setReminderDrafts((prev) => [...prev, newReminderDraft(detectedTimezone)])
  }

  async function handleSaveReminder(key: string) {
    const draft = reminderDrafts.find((d) => d.key === key)
    if (!draft) return

    patchDraft(key, { saving: true, saveError: null, saved: false })

    const input = {
      timeLocal: draft.timeLocal,
      weekdays: draft.weekdays,
      timezone: draft.timezone,
      active: draft.active,
    }
    const result =
      draft.id === null
        ? await createReminder(supabase, input)
        : await updateReminder(supabase, draft.id, input)

    if (!result.ok) {
      patchDraft(key, { saving: false, saveError: 'Sélectionne au moins un jour pour activer le rappel.' })
      return
    }

    patchDraft(key, { saving: false, saved: true, id: result.id })
  }

  async function handleDeleteReminder(key: string) {
    const draft = reminderDrafts.find((d) => d.key === key)
    if (!draft) return

    if (draft.id !== null) {
      await deleteReminder(supabase, draft.id)
    }
    setReminderDrafts((prev) => prev.filter((d) => d.key !== key))
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

      <div className="mt-8">
        <h2 className="text-sm font-medium">Rappels</h2>

        {reminderDrafts.map((draft) => (
          <ReminderCard
            key={draft.key}
            draft={draft}
            onChange={(patch) => patchDraft(draft.key, patch)}
            onSave={() => void handleSaveReminder(draft.key)}
            onDelete={() => void handleDeleteReminder(draft.key)}
          />
        ))}

        <Button block className="mt-4" onClick={handleAddReminder}>
          Ajouter un rappel
        </Button>
      </div>

      <Card className="mt-8">
        <h2 className="text-sm font-medium">Matériel disponible</h2>
        <p className="mt-1 text-xs text-muted">
          Utilisé par défaut à chaque génération de séance. Aucune sélection : séances sans
          matériel.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {EQUIPMENT.map((item) => (
            <ToggleChip
              key={item.code}
              selected={equipment.includes(item.code)}
              onClick={() => toggleEquipment(item.code)}
            >
              {equipmentLabel(item.code)}
            </ToggleChip>
          ))}
        </div>

        {equipmentSaved ? (
          <div className="mt-3">
            <FormMessage kind="success">Matériel sauvegardé.</FormMessage>
          </div>
        ) : null}

        <Button
          variant="primary"
          block
          className="mt-4"
          onClick={handleSaveEquipment}
          disabled={equipmentSaving}
        >
          {equipmentSaving ? 'Sauvegarde…' : 'Sauvegarder'}
        </Button>
      </Card>

      <Card className="mt-8">
        <h2 className="text-sm font-medium">Pratique sportive</h2>
        <p className="mt-1 text-xs text-muted">
          Sert à présélectionner les zones de la séance personnalisée et à proposer des
          séances programmées adaptées à tes pratiques.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRACTICES.map((item) => (
            <ToggleChip
              key={item.code}
              selected={practices.includes(item.code)}
              onClick={() => togglePractice(item.code)}
            >
              {practiceLabel(item.code)}
            </ToggleChip>
          ))}
        </div>

        <div className="mt-4">
          <Field label="Sport principal" hint="Restreint aux pratiques cochées ci-dessus.">
            <select
              value={mainPractice ?? ''}
              onChange={(e) => setMainPractice((e.target.value || null) as PracticeCode | null)}
              className={selectClasses}
              disabled={practices.length === 0}
            >
              <option value="">Aucun</option>
              {PRACTICES.filter((item) => practices.includes(item.code)).map((item) => (
                <option key={item.code} value={item.code}>
                  {practiceLabel(item.code)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {practicesSaved ? (
          <div className="mt-3">
            <FormMessage kind="success">Pratique sportive sauvegardée.</FormMessage>
          </div>
        ) : null}

        <Button
          variant="primary"
          block
          className="mt-4"
          onClick={handleSavePractices}
          disabled={practicesSaving}
        >
          {practicesSaving ? 'Sauvegarde…' : 'Sauvegarder'}
        </Button>
      </Card>

      <Card className="mt-8">
        <h2 className="text-sm font-medium">Zones de mobilité</h2>
        <p className="mt-1 text-xs text-muted">
          Déficit majeur : une seule grande zone, utilisée pour présélectionner les zones de
          la séance personnalisée et proposer une séance programmée adaptée.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {MOBILITY_FOCUSES.map((item) => (
            <ToggleChip
              key={item.code}
              selected={majorDeficitFocus === item.code}
              onClick={() => selectMajorDeficitFocus(item.code)}
            >
              {mobilityFocusLabel(item.code)}
            </ToggleChip>
          ))}
        </div>

        {majorDeficitFocusSaved ? (
          <div className="mt-3">
            <FormMessage kind="success">Déficit majeur sauvegardé.</FormMessage>
          </div>
        ) : null}

        <Button
          variant="primary"
          block
          className="mt-4"
          onClick={handleSaveMajorDeficitFocus}
          disabled={majorDeficitFocusSaving}
        >
          {majorDeficitFocusSaving ? 'Sauvegarde…' : 'Sauvegarder'}
        </Button>
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
