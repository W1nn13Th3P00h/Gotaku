import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lecture/écriture des rappels — voir `specs/006-multiple-reminders/contracts/
 * reminders-queries.md`. Plusieurs rappels par utilisateur, chacun indépendant ; la
 * RLS filtre déjà sur `user_id`.
 */

export type Reminder = {
  id: string
  userId: string
  /** Heure locale, format `HH:MM` (voir `data-model.md`). */
  timeLocal: string
  /** 1 = lundi … 7 = dimanche (FR-005). Jamais vide si `active` (FR-004). */
  weekdays: number[]
  /** IANA, ex. `Europe/Paris`. */
  timezone: string
  active: boolean
}

type RawReminderRow = {
  id: string
  user_id: string
  time_local: string
  weekdays: number[]
  timezone: string
  active: boolean
}

const REMINDER_COLUMNS = 'id, user_id, time_local, weekdays, timezone, active'

function mapReminderRow(row: RawReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    // Postgres renvoie `time` sous la forme `HH:MM:SS` ; l'écran n'affiche que `HH:MM`.
    timeLocal: row.time_local.slice(0, 5),
    weekdays: row.weekdays,
    timezone: row.timezone,
    active: row.active,
  }
}

/** Tous les rappels de l'utilisateur, triés par heure croissante. `[]` si aucun réglé. */
export async function getReminders(supabase: SupabaseClient): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_COLUMNS)
    .order('time_local', { ascending: true })

  if (error) throw error

  return ((data ?? []) as RawReminderRow[]).map(mapReminderRow)
}

export type ReminderInput = {
  timeLocal: string
  weekdays: number[]
  timezone: string
  active: boolean
}

export type SaveReminderResult = { ok: true; id: string } | { ok: false; reason: 'NO_WEEKDAY' }

function toPayload(input: ReminderInput) {
  return {
    time_local: input.timeLocal,
    weekdays: input.weekdays,
    timezone: input.timezone,
    active: input.active,
  }
}

/** Crée un nouveau rappel. Refuse `NO_WEEKDAY` si `input.active` sans aucun jour coché (FR-004). */
export async function createReminder(
  supabase: SupabaseClient,
  input: ReminderInput,
): Promise<SaveReminderResult> {
  if (input.active && input.weekdays.length === 0) {
    return { ok: false, reason: 'NO_WEEKDAY' }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('createReminder appelée sans utilisateur authentifié')

  const { data, error } = await supabase
    .from('reminders')
    .insert({ user_id: user.id, ...toPayload(input) })
    .select('id')
    .single()
  if (error) throw error

  return { ok: true, id: (data as { id: string }).id }
}

/**
 * Met à jour le rappel `id`, sans toucher aux autres rappels de l'utilisateur. Même
 * refus `NO_WEEKDAY` que `createReminder`.
 */
export async function updateReminder(
  supabase: SupabaseClient,
  id: string,
  input: ReminderInput,
): Promise<SaveReminderResult> {
  if (input.active && input.weekdays.length === 0) {
    return { ok: false, reason: 'NO_WEEKDAY' }
  }

  const { error } = await supabase.from('reminders').update(toPayload(input)).eq('id', id)
  if (error) throw error

  return { ok: true, id }
}

/** Supprime le rappel `id`. Aucun effet sur les autres rappels de l'utilisateur. */
export async function deleteReminder(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}
