import type { SupabaseClient } from '@supabase/supabase-js'

import { computeTotalDurationS } from '@/lib/sessions/composition'
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

const HISTORY_WINDOW_DAYS = 30

/**
 * Séances `in_progress`/`completed` de l'utilisateur, triées par date
 * décroissante, statut effectif calculé par ligne. Une composition `draft`
 * (Lot 4) n'apparaît jamais ici.
 *
 * Triée par `started_at` (toujours renseigné dès qu'une séance est démarrée)
 * plutôt que par `coalesce(completed_at, started_at)` : le query builder
 * Supabase ne permet pas d'ordonner sur une expression calculée, et l'écart
 * pratique entre les deux tris est nul pour un usage mono-utilisateur.
 */
export async function listSessionsForHistory(
  supabase: SupabaseClient,
): Promise<HistorySessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(HISTORY_SESSION_COLUMNS)
    .in('status', ['in_progress', 'completed'])
    .order('started_at', { ascending: false })

  if (error) throw error

  const now = new Date()
  return ((data ?? []) as unknown as RawHistorySessionRow[]).map((row) =>
    mapHistorySessionRow(row, now),
  )
}

type RawHistorySummaryRow = {
  zone_code: ZoneCode
  seconds_worked: number
  session_count: number
  total_volume_s: number
}

/**
 * Synthèse des 30 derniers jours (RPC `session_history_summary`). `null` (pas
 * un tableau vide) si aucune séance `completed` sur la fenêtre, pour que
 * l'appelant affiche le message explicite requis par FR-017 plutôt qu'un
 * tableau de zéros.
 */
export async function getHistorySummary30d(
  supabase: SupabaseClient,
): Promise<HistorySummary30d[] | null> {
  const since = new Date()
  since.setDate(since.getDate() - HISTORY_WINDOW_DAYS)

  const { data, error } = await supabase.rpc('session_history_summary', {
    since: since.toISOString(),
  })

  if (error) throw error

  const rows = (data ?? []) as RawHistorySummaryRow[]
  if (rows.length === 0 || rows[0]?.session_count === 0) return null

  return rows.map((row) => ({
    zoneCode: row.zone_code,
    secondsWorked: row.seconds_worked,
    sessionCount: row.session_count,
    totalVolumeS: row.total_volume_s,
  }))
}

/**
 * Trie la synthèse par volume décroissant (zone la plus travaillée en tête),
 * pour que `/history` mette en évidence les zones les plus et les moins
 * travaillées sans calcul manuel (FR-016, SC-004). `session_history_summary`
 * renvoie l'ordre du référentiel (`order by z.sort`) : ce tri ne change que
 * l'affichage, jamais la donnée. Tri stable — les zones à égalité de volume
 * gardent l'ordre du référentiel entre elles.
 */
export function sortHistorySummaryByVolume(rows: HistorySummary30d[]): HistorySummary30d[] {
  return [...rows].sort((a, b) => b.secondsWorked - a.secondsWorked)
}

/**
 * Lecture pour la composition manuelle (Lot 4) — voir
 * `specs/003-manual-session-templates/data-model.md`.
 */

export type CompositionItem = {
  id: string
  exerciseId: string
  ord: number
  name: string
  durationS: number
  perSide: boolean
  /** Bornes de l'exercice rattaché, pour le clampage côté interface. */
  minS: number
  maxS: number
}

export type CompositionForEdit = {
  sessionId: string
  items: CompositionItem[]
  /** Recalculée à la lecture (× 2 si `perSide`), jamais relue telle quelle depuis la base. */
  totalDurationS: number
  isEmpty: boolean
}

export type TemplateSummary = {
  id: string
  name: string
  itemCount: number
  totalDurationS: number
}

type RawCompositionItemRow = {
  id: string
  exercise_id: string
  ord: number
  duration_s: number
  per_side: boolean
  exercises: { name: string; duration_min_s: number; duration_max_s: number } | null
}

type RawCompositionRow = {
  id: string
  session_items: RawCompositionItemRow[]
}

const COMPOSITION_COLUMNS = `
  id,
  session_items (
    id,
    exercise_id,
    ord,
    duration_s,
    per_side,
    exercises ( name, duration_min_s, duration_max_s )
  )
`

function mapCompositionRow(row: RawCompositionRow): CompositionForEdit {
  const items = [...row.session_items]
    .sort((a, b) => a.ord - b.ord)
    .map((it): CompositionItem => {
      // Comme `getSessionForExecution` : un item sans exercice rattaché est une
      // corruption de données (clé étrangère non nulle), pas un cas à absorber.
      if (!it.exercises) throw new Error(`item de composition sans exercice rattaché : ${it.id}`)

      return {
        id: it.id,
        exerciseId: it.exercise_id,
        ord: it.ord,
        name: it.exercises.name,
        durationS: it.duration_s,
        perSide: it.per_side,
        minS: it.exercises.duration_min_s,
        maxS: it.exercises.duration_max_s,
      }
    })

  return {
    sessionId: row.id,
    items,
    totalDurationS: computeTotalDurationS(items),
    isEmpty: items.length === 0,
  }
}

/**
 * Cherche la composition manuelle en cours de l'utilisateur (`status = 'draft'
 * AND source = 'manual'`) ; en crée une si aucune n'existe. Ne renvoie jamais
 * `null` (voir `research.md` § Une seule composition active à la fois).
 */
export async function getOrCreateDraftComposition(
  supabase: SupabaseClient,
): Promise<CompositionForEdit> {
  const { data: existingRows, error: selectError } = await supabase
    .from('sessions')
    .select(COMPOSITION_COLUMNS)
    .eq('status', 'draft')
    .eq('source', 'manual')
    .order('created_at', { ascending: false })
    .limit(1)

  if (selectError) throw selectError

  const existing = (existingRows as unknown as RawCompositionRow[] | null)?.[0]
  if (existing) return mapCompositionRow(existing)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('getOrCreateDraftComposition appelée sans utilisateur authentifié')

  // `target_duration_s`/`seed` n'ont pas de sens pour une composition manuelle
  // (colonnes du générateur) : 0 en placeholder, `target_duration_s` étant tenu
  // à jour par les mutations de composition (voir `mutations.ts`).
  const { data: created, error: insertError } = await supabase
    .from('sessions')
    .insert({ user_id: user.id, status: 'draft', source: 'manual', target_duration_s: 0, seed: 0 })
    .select(COMPOSITION_COLUMNS)
    .single()

  if (insertError) throw insertError

  return mapCompositionRow(created as unknown as RawCompositionRow)
}

type RawTemplateRow = {
  id: string
  name: string
  template_items: { duration_s: number; per_side: boolean }[]
}

const TEMPLATE_SUMMARY_COLUMNS = `
  id,
  name,
  template_items ( duration_s, per_side )
`

/** Tous les modèles de l'utilisateur, les plus récents en premier. */
export async function listTemplates(supabase: SupabaseClient): Promise<TemplateSummary[]> {
  const { data, error } = await supabase
    .from('session_templates')
    .select(TEMPLATE_SUMMARY_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawTemplateRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    itemCount: row.template_items.length,
    totalDurationS: computeTotalDurationS(
      row.template_items.map((item) => ({ durationS: item.duration_s, perSide: item.per_side })),
    ),
  }))
}
