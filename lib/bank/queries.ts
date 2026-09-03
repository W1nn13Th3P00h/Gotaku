import type { SupabaseClient } from '@supabase/supabase-js'

import type { EquipmentCode, ExerciseType, RegionCode, ZoneCode } from '@/lib/referentials'

/**
 * Lecture seule de la banque pour l'écran « Banque » (Lot 1, `docs/spec.md`).
 * Aucune fonction ici n'accepte de paramètre de mutation : la banque ne se modifie
 * que via `data/exercises.json` puis `npm run seed`.
 */

export type BankFilters = {
  search?: string
  zone?: ZoneCode
  type?: ExerciseType
  equipment?: EquipmentCode
}

export type ExerciseSummary = {
  slug: string
  name: string
  type: ExerciseType
  primaryZone: ZoneCode
  zones: ZoneCode[]
  equipment: EquipmentCode[]
  durationTargetS: number
}

export type ExerciseDetail = ExerciseSummary & {
  instructions: string[]
  contraindications: string | null
  /** ISO date, ou `null` si l'exercice n'a jamais été réalisé (état valide, pas une erreur). */
  lastPerformedAt: string | null
}

export type ZoneCoverageRow = {
  zoneCode: ZoneCode
  zoneLabel: string
  regionCode: RegionCode
  exerciseCount: number
  isLowCoverage: boolean
}

/**
 * Forme d'une ligne `exercises` sélectionnée avec ses rattachements. `position` et
 * `intensity` sont typés en option, jamais requis : un appelant ne devrait jamais les
 * sélectionner, mais le mapper ci-dessous les ignore explicitement même s'ils sont
 * présents (garde contre une sélection élargie par erreur, par ex. `select('*')`).
 */
export type RawExerciseRow = {
  slug: string
  name: string
  type: ExerciseType
  duration_target_s: number
  exercise_zones: { zone_code: ZoneCode; is_primary: boolean }[]
  exercise_equipment: { equipment_code: EquipmentCode }[]
  position?: unknown
  intensity?: unknown
  [key: string]: unknown
}

export type RawExerciseDetailRow = RawExerciseRow & {
  instructions: string[]
  contraindications: string | null
  lastPerformedAt: string | null
}

export function mapExerciseRow(row: RawExerciseRow): ExerciseSummary
export function mapExerciseRow(
  row: RawExerciseDetailRow,
  opts: { detailed: true },
): ExerciseDetail
export function mapExerciseRow(
  row: RawExerciseRow | RawExerciseDetailRow,
  opts?: { detailed?: boolean },
): ExerciseSummary | ExerciseDetail {
  const primary = row.exercise_zones.find((z) => z.is_primary)
  if (!primary) {
    // Garanti par l'index unique `exercise_one_primary_zone` en base : une absence
    // ici est une corruption de données, pas un cas à absorber silencieusement.
    throw new Error(`exercice « ${row.slug} » sans zone primaire`)
  }

  const summary: ExerciseSummary = {
    slug: row.slug,
    name: row.name,
    type: row.type,
    primaryZone: primary.zone_code,
    zones: row.exercise_zones.map((z) => z.zone_code),
    equipment: row.exercise_equipment.map((e) => e.equipment_code),
    durationTargetS: row.duration_target_s,
  }

  if (!opts?.detailed) return summary

  const detailRow = row as RawExerciseDetailRow
  return {
    ...summary,
    instructions: detailRow.instructions,
    contraindications: detailRow.contraindications,
    lastPerformedAt: detailRow.lastPerformedAt,
  }
}

const EXERCISE_SUMMARY_COLUMNS = `
  slug,
  name,
  type,
  duration_target_s,
  exercise_zones ( zone_code, is_primary ),
  exercise_equipment ( equipment_code )
`

/**
 * Liste des exercices actifs, filtrée et cherchée en base. Filtres combinables par
 * ET logique ; aucun filtre fourni renvoie tous les exercices actifs.
 *
 * Recherche et type sont filtrés en base (`ilike`, `eq` sur `exercises`, sans
 * ambiguïté). Zone et matériel portent sur les tables de rattachement : un `.eq()`
 * PostgREST sur une ressource imbriquée sans modificateur `!inner` ne restreint que
 * le tableau imbriqué renvoyé, pas les lignes `exercises` elles-mêmes — et ce
 * comportement n'est pas vérifiable avec PGlite (pas de couche PostgREST, cf.
 * `research.md`). Sur 330 lignes, filtrer ces deux axes en mémoire après le fetch
 * est aussi simple et sans ambiguïté.
 */
export async function listExercises(
  supabase: SupabaseClient,
  filters: BankFilters = {},
): Promise<ExerciseSummary[]> {
  let query = supabase
    .from('exercises')
    .select(EXERCISE_SUMMARY_COLUMNS)
    .eq('active', true)
    .order('name', { ascending: true })

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data as RawExerciseRow[]).filter(
    (row) =>
      (!filters.zone || row.exercise_zones.some((z) => z.zone_code === filters.zone)) &&
      (!filters.equipment ||
        row.exercise_equipment.some((e) => e.equipment_code === filters.equipment)),
  )

  return rows.map((row) => mapExerciseRow(row))
}

/**
 * Fiche d'un exercice actif par son `slug`, avec la date de dernière exécution.
 * `null` si le slug n'existe pas ou correspond à un exercice inactif.
 */
export async function getExerciseBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ExerciseDetail | null> {
  const { data: row, error } = await supabase
    .from('exercises')
    .select(
      `
      id,
      slug,
      name,
      type,
      duration_target_s,
      instructions,
      contraindications,
      exercise_zones ( zone_code, is_primary ),
      exercise_equipment ( equipment_code )
    `,
    )
    .eq('active', true)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!row) return null

  const exercise = row as RawExerciseRow & {
    id: string
    instructions: string[]
    contraindications: string | null
  }

  // La vue est indexée par `exercise_id` (uuid), jamais par `slug`.
  const { data: lastPerformed, error: lastPerformedError } = await supabase
    .from('exercise_last_performed')
    .select('last_performed_at')
    .eq('exercise_id', exercise.id)
    .maybeSingle()

  if (lastPerformedError) throw lastPerformedError

  return mapExerciseRow(
    { ...exercise, lastPerformedAt: lastPerformed?.last_performed_at ?? null },
    { detailed: true },
  )
}

/** Seuil documenté dans `research.md` : aligné sur les zones citées par `docs/roadmap.md`. */
export const ZONE_LOW_COVERAGE_THRESHOLD = 10

/**
 * Une ligne par zone du référentiel (26 lignes), y compris les zones à zéro exercice.
 * S'appuie sur la fonction SQL `zone_coverage()` (migration dédiée) pour garantir
 * qu'un `left join` — et non un `inner join` — est bien utilisé.
 */
export async function getZoneCoverage(supabase: SupabaseClient): Promise<ZoneCoverageRow[]> {
  const { data, error } = await supabase.rpc('zone_coverage')
  if (error) throw error

  const rows = data as { zone_code: ZoneCode; zone_label: string; region_code: RegionCode; exercise_count: number }[]

  return rows.map((row) => ({
    zoneCode: row.zone_code,
    zoneLabel: row.zone_label,
    regionCode: row.region_code,
    exerciseCount: row.exercise_count,
    isLowCoverage: row.exercise_count < ZONE_LOW_COVERAGE_THRESHOLD,
  }))
}
