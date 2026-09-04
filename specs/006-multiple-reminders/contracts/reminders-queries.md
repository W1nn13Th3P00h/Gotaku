# Contrat interne : `lib/push/queries.ts`

Remplace le contrat borné à un seul rappel de `specs/004-pwa-push-reminder/contracts/
settings-screen.md` § `lib/push/queries.ts`. Type `Reminder` inchangé :

```ts
type Reminder = {
  id: string
  userId: string
  timeLocal: string   // 'HH:MM'
  weekdays: number[]  // 1 = lundi … 7 = dimanche
  timezone: string    // IANA
  active: boolean
}

type ReminderInput = {
  timeLocal: string
  weekdays: number[]
  timezone: string
  active: boolean
}

type SaveReminderResult = { ok: true; id: string } | { ok: false; reason: 'NO_WEEKDAY' }
```

## `getReminders(supabase): Promise<Reminder[]>`

Tous les rappels de l'utilisateur courant (RLS `reminders_own` fait déjà le filtrage),
triés par `time_local` croissant. `[]` si l'utilisateur n'a jamais rien réglé —
**jamais `null`**, contrairement à l'ancien `getReminder`.

## `createReminder(supabase, input: ReminderInput): Promise<SaveReminderResult>`

Refuse `NO_WEEKDAY` si `input.active && input.weekdays.length === 0`, sans rien
écrire (règle inchangée de FR-004). Sinon, insère une nouvelle ligne pour
l'utilisateur courant (`auth.getUser()`, comme l'ancien `upsertReminder` sur son
chemin de création) et retourne son `id`.

## `updateReminder(supabase, id: string, input: ReminderInput): Promise<SaveReminderResult>`

Même refus `NO_WEEKDAY`. Sinon, met à jour la ligne `id` (filtrée aussi par `eq('id',
id)`, la RLS empêchant de toute façon d'atteindre le rappel d'un autre utilisateur) et
retourne le même `id`. Ne touche à aucune autre ligne.

## `deleteReminder(supabase, id: string): Promise<void>`

Supprime la ligne `id`. La RLS empêche de supprimer un rappel qui n'appartient pas à
l'utilisateur courant. Aucun effet sur les autres rappels ; `reminder_sends` déjà
associés à ce rappel disparaissent avec lui (`on delete cascade`, inchangé).

## Garanties (à couvrir par les tests d'implémentation)

- `NO_WEEKDAY` refusé de façon identique par `createReminder` et `updateReminder` —
  même règle qu'aujourd'hui, appliquée par rappel plutôt qu'une seule fois par
  utilisateur.
- Modifier ou supprimer un rappel par son `id` ne modifie ni ne supprime les autres
  rappels de l'utilisateur.
- `getReminders` sur un utilisateur sans aucun rappel retourne `[]`, jamais une
  erreur ni `null`.

## Hors contrat

- Aucune fonction de ce module n'envoie de Web Push : c'est le rôle exclusif de
  l'Edge Function (`supabase/functions/send-reminders/`), inchangée par cette
  feature.
- Aucune limite de nombre de rappels n'est appliquée ici (voir spec § Assumptions).
