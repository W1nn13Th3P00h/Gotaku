import type { SupabaseClient } from '@supabase/supabase-js'

import type { ItemStatus } from '@/lib/session-player/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * Lecture pour l'exécution (Lot 3) : une séance déjà créée par ailleurs (Lot 2/4),
 * chargée avec ses items et les champs d'affichage de leur exercice.
 * Voir `specs/002-session-execution-history/contracts/sessions-queries.md`.
 */

export type SessionExecutionItem = {
  id: string
  exerciseId: string
  ord: number
  durationS: number
  perSide: boolean
  status: ItemStatus
  exercise: {
    name: string
    instructions: string[]
    primaryZone: ZoneCode
    zones: ZoneCode[]
  }
}

export type SessionForExecution = {
  id: string
  targetDurationS: number
  startedAt: string | null
  items: SessionExecutionItem[]
}

/** Statut effectif, calculé (jamais stocké) — voir `data-model.md` § Statut effectif. */
export type EffectiveStatus = 'completed' | 'in_progress' | 'abandoned'

export type HistorySessionRow = {
  id: string
  /** `completed_at` si la séance est terminée, `started_at` sinon. */
  date: string
  actualDurationS: number | null
  exerciseCount: number
  zonesWorked: ZoneCode[]
  effectiveStatus: EffectiveStatus
}

/** Une ligne par zone du référentiel — voir `getHistorySummary30d` (Phase 5). */
export type HistorySummary30d = {
  zoneCode: ZoneCode
  secondsWorked: number
  sessionCount: number
  totalVolumeS: number
}

type RawSessionForExecutionRow = {
  id: string
  target_duration_s: number
  started_at: string | null
  session_items: {
    id: string
    exercise_id: string
    ord: number
    duration_s: number
    per_side: boolean
    status: ItemStatus
    exercises: {
      name: string
      instructions: string[]
      exercise_zones: { zone_code: ZoneCode; is_primary: boolean }[]
    } | null
  }[]
}

const SESSION_FOR_EXECUTION_COLUMNS = `
  id,
  target_duration_s,
  started_at,
  session_items (
    id,
    exercise_id,
    ord,
    duration_s,
    per_side,
    status,
    exercises ( name, instructions, exercise_zones ( zone_code, is_primary ) )
  )
`

/**
 * Charge la séance et ses items (avec le nécessaire à l'affichage de chaque
 * exercice) pour l'écran d'exécution. `null` si la séance n'existe pas ou
 * n'appartient pas à l'utilisateur (RLS renvoie zéro ligne, pas une erreur).
 */
export async function getSessionForExecution(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SessionForExecution | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_FOR_EXECUTION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as unknown as RawSessionForExecutionRow

  const items = [...row.session_items]
    .sort((a, b) => a.ord - b.ord)
    .map((it): SessionExecutionItem => {
      // `exercises` ne peut être `null` que si l'exercice référencé a été
      // supprimé, ce qu'interdit la contrainte de clé étrangère : corruption
      // de données, pas un cas à absorber silencieusement.
      if (!it.exercises) throw new Error(`item de séance sans exercice rattaché : ${it.id}`)

      const primary = it.exercises.exercise_zones.find((z) => z.is_primary)

      return {
        id: it.id,
        exerciseId: it.exercise_id,
        ord: it.ord,
        durationS: it.duration_s,
        perSide: it.per_side,
        status: it.status,
        exercise: {
          name: it.exercises.name,
          instructions: it.exercises.instructions,
          primaryZone: primary?.zone_code ?? it.exercises.exercise_zones[0]?.zone_code ?? 'abs',
          zones: it.exercises.exercise_zones.map((z) => z.zone_code),
        },
      }
    })

  return {
    id: row.id,
    targetDurationS: row.target_duration_s,
    startedAt: row.started_at,
    items,
  }
}

type RawHistorySessionRow = {
  id: string
  status: 'draft' | 'in_progress' | 'completed'
  started_at: string | null
  completed_at: string | null
  actual_duration_s: number | null
  session_items: {
    status: ItemStatus
    exercises: { exercise_zones: { zone_code: ZoneCode }[] } | null
  }[]
}

const HISTORY_SESSION_COLUMNS = `
  id,
  status,
  started_at,
  completed_at,
  actual_duration_s,
  session_items (
    status,
    exercises ( exercise_zones ( zone_code ) )
  )
`

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Défini seulement pour une séance déjà démarrée (`status IN ('in_progress',
 * 'completed')`, donc `started_at` non nul) — voir `data-model.md` § Statut effectif.
 */
function computeEffectiveStatus(row: RawHistorySessionRow, now: Date): EffectiveStatus {
  if (row.status === 'completed') return 'completed'
  if (!row.started_at) {
    // Garanti par les filtres des deux requêtes de ce module (`status` restreint à
    // `in_progress`/`completed`) : une séance `draft` n'entre jamais ici.
    throw new Error(`séance ${row.id} sans started_at pour un statut effectif`)
  }
  return isSameLocalDay(new Date(row.started_at), now) ? 'in_progress' : 'abandoned'
}

function mapHistorySessionRow(row: RawHistorySessionRow, now: Date): HistorySessionRow {
  const date = row.completed_at ?? row.started_at
  if (!date) {
    throw new Error(`séance ${row.id} sans date affichable (ni completed_at ni started_at)`)
  }

  const zonesWorked = [
    ...new Set(
      row.session_items.flatMap((it) => it.exercises?.exercise_zones.map((z) => z.zone_code) ?? []),
    ),
  ]

  return {
    id: row.id,
    date,
    actualDurationS: row.actual_duration_s,
    exerciseCount: row.session_items.length,
    zonesWorked,
    effectiveStatus: computeEffectiveStatus(row, now),
  }
}

/**
 * Séances `in_progress` de l'utilisateur dont le statut effectif n'est pas
 * `abandoned` (donc `started_at` est aujourd'hui, en heure locale). Une
 * composition `draft` (Lot 4) n'est jamais retournée : elle n'a pas encore de
 * `started_at`.
 */
export async function getResumableSessionsToday(
  supabase: SupabaseClient,
): Promise<HistorySessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(HISTORY_SESSION_COLUMNS)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })

  if (error) throw error

  const now = new Date()
  return ((data ?? []) as unknown as RawHistorySessionRow[])
    .map((row) => mapHistorySessionRow(row, now))
    .filter((row) => row.effectiveStatus === 'in_progress')
}
