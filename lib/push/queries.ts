import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lecture/écriture du rappel (US2) — voir `contracts/settings-screen.md`. Un
 * seul rappel par utilisateur en v1 (Assumptions du spec) : la RLS filtre déjà
 * sur `user_id`, ce module se contente de ne jamais en créer un second.
 */

export type Reminder = {
  id: string
  userId: string
  /** Heure locale, format `HH:MM` (voir `data-model.md`). */
  timeLocal: string
  /** 1 = lundi … 7 = dimanche (FR-005). Jamais vide si `active` (FR-007). */
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

/** Le rappel de l'utilisateur, `null` si jamais réglé. */
export async function getReminder(supabase: SupabaseClient): Promise<Reminder | null> {
  const { data, error } = await supabase.from('reminders').select(REMINDER_COLUMNS).limit(1)

  if (error) throw error

  const row = (data as RawReminderRow[] | null)?.[0]
  return row ? mapReminderRow(row) : null
}

export type UpsertReminderInput = {
  timeLocal: string
  weekdays: number[]
  timezone: string
  active: boolean
}

export type UpsertReminderResult = { ok: true } | { ok: false; reason: 'NO_WEEKDAY' }

/**
 * Crée ou met à jour l'unique rappel de l'utilisateur. Refuse `NO_WEEKDAY` si
 * `input.active` et `input.weekdays.length === 0` (FR-007), sans rien écrire.
 */
export async function upsertReminder(
  supabase: SupabaseClient,
  input: UpsertReminderInput,
): Promise<UpsertReminderResult> {
  if (input.active && input.weekdays.length === 0) {
    return { ok: false, reason: 'NO_WEEKDAY' }
  }

  const payload = {
    time_local: input.timeLocal,
    weekdays: input.weekdays,
    timezone: input.timezone,
    active: input.active,
  }

  const { data: existing, error: selectError } = await supabase
    .from('reminders')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    const { error } = await supabase.from('reminders').update(payload).eq('id', existing.id)
    if (error) throw error
    return { ok: true }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('upsertReminder appelée sans utilisateur authentifié')

  const { error } = await supabase.from('reminders').insert({ user_id: user.id, ...payload })
  if (error) throw error

  return { ok: true }
}
