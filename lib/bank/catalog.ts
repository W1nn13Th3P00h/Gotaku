import type { SupabaseClient } from '@supabase/supabase-js'

import type { Exercise, ExerciseId } from '@/lib/generator/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * Ce que le générateur a besoin de charger avant de tourner : le catalogue et
 * le contexte d'historique (fraîcheur, volume par zone). Vit hors de
 * `lib/generator/`, qui ne connaît pas Supabase.
 */

/** Vue exercice pour l'écran de génération : `Exercise` du module pur, plus le nom affiché. */
export type CatalogExercise = Exercise & { name: string }

type ExerciseRow = {
  id: string
  slug: string
  name: string
  type: Exercise['type']
  position: Exercise['position']
  symmetry: Exercise['symmetry']
  intensity: 1 | 2 | 3
  duration_target_s: number
  duration_min_s: number
  duration_max_s: number
  active: boolean
  exercise_zones: { zone_code: ZoneCode; is_primary: boolean }[]
  exercise_equipment: { equipment_code: Exercise['equipment'][number] }[]
}

export async function loadCatalog(supabase: SupabaseClient): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, slug, name, type, position, symmetry, intensity, duration_target_s, duration_min_s, duration_max_s, active, exercise_zones(zone_code, is_primary), exercise_equipment(equipment_code)',
    )
    .eq('active', true)

  if (error) throw error

  return ((data ?? []) as unknown as ExerciseRow[]).map((row): CatalogExercise => {
    const primary = row.exercise_zones.find((z) => z.is_primary)
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      position: row.position,
      symmetry: row.symmetry,
      zones: row.exercise_zones.map((z) => z.zone_code),
      primary_zone: primary?.zone_code ?? row.exercise_zones[0]?.zone_code ?? 'abs',
      equipment: row.exercise_equipment.map((e) => e.equipment_code),
      intensity: row.intensity,
      duration_target_s: row.duration_target_s,
      duration_min_s: row.duration_min_s,
      duration_max_s: row.duration_max_s,
      active: row.active,
    }
  })
}

export type GeneratorHistory = {
  lastPerformed: Map<ExerciseId, Date>
  zoneVolume30d: Map<ZoneCode, number>
}

/**
 * Fraîcheur (`exercise_last_performed`) et volume 30 jours par zone, pour la
 * pondération de l'étape 3 (`docs/generator.md`). Tant que le Lot 3 (exécution)
 * n'existe pas, aucune séance n'est `completed` : les deux Maps sont vides, ce
 * qui est le résultat réel de la requête, pas un stub à remplacer plus tard.
 */
export async function loadGeneratorHistory(
  supabase: SupabaseClient,
  catalog: Exercise[],
): Promise<GeneratorHistory> {
  const zonesByExerciseId = new Map(catalog.map((e) => [e.id, e.zones]))

  const lastPerformed = new Map<ExerciseId, Date>()
  const zoneVolume30d = new Map<ZoneCode, number>()

  const { data: lastPerformedRows, error: lastPerformedError } = await supabase
    .from('exercise_last_performed')
    .select('exercise_id, last_performed_at')

  if (lastPerformedError) throw lastPerformedError

  for (const row of (lastPerformedRows ?? []) as {
    exercise_id: string
    last_performed_at: string | null
  }[]) {
    if (row.last_performed_at) lastPerformed.set(row.exercise_id, new Date(row.last_performed_at))
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: itemRows, error: itemsError } = await supabase
    .from('session_items')
    .select('exercise_id, duration_s, per_side, sessions!inner(status, completed_at)')
    .eq('sessions.status', 'completed')
    .gte('sessions.completed_at', since.toISOString())

  if (itemsError) throw itemsError

  for (const row of (itemRows ?? []) as {
    exercise_id: string
    duration_s: number
    per_side: boolean
  }[]) {
    const cost = row.duration_s * (row.per_side ? 2 : 1)
    for (const zone of zonesByExerciseId.get(row.exercise_id) ?? []) {
      zoneVolume30d.set(zone, (zoneVolume30d.get(zone) ?? 0) + cost)
    }
  }

  return { lastPerformed, zoneVolume30d }
}
