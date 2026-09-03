import { cost, costForDuration } from '@/lib/generator/cost'
import { createRng } from '@/lib/generator/rng'
import { weightedPick } from '@/lib/generator/select'
import type { Exercise, ExerciseId, GeneratorContext } from '@/lib/generator/types'
import { computeDeficits, computeTargetShares, weight } from '@/lib/generator/weighting'
import type { EquipmentCode, ZoneCode } from '@/lib/referentials'

export type SessionItemForReplace = {
  exercise: Exercise
  /** Durée retenue, par côté sur un exercice asymétrique. */
  durationS: number
}

export type ReplaceParams = {
  currentItems: SessionItemForReplace[]
  indexToReplace: number
  catalog: Exercise[]
  availableEquipment: EquipmentCode[]
  /** Zones demandées de la séance d'origine, pour retrouver la même pondération. */
  requestedZones: ZoneCode[]
  preferNeglectedZones?: boolean
  /** Budget cible de la séance d'origine, pour retrouver la même pondération. */
  sessionTargetDurationS: number
  context: Pick<GeneratorContext, 'now' | 'lastPerformed' | 'zoneVolume30d' | 'seed'>
}

export type ReplaceResult =
  | { ok: true; exercise: Exercise; durationS: number }
  | { ok: false }

/**
 * Remplacement d'un exercice : même type, coût dans une fenêtre du coût remplacé,
 * élargissement progressif si aucun candidat ne convient. Réutilise le poids de
 * l'étape 3 (fraîcheur, besoin de zone, bruit), calculé sur la séance sans l'item
 * remplacé.
 */
export function replaceExercise(params: ReplaceParams): ReplaceResult {
  const target = params.currentItems[params.indexToReplace]
  if (target === undefined) return { ok: false }

  const replacedCost = costForDuration(target.durationS, target.exercise.symmetry)
  const equipmentSet = new Set(params.availableEquipment)
  const inSessionIds = new Set<ExerciseId>(params.currentItems.map((i) => i.exercise.id))

  const withinWindow = (e: Exercise, pct: number): boolean => {
    const c = cost(e)
    return c >= replacedCost * (1 - pct) && c <= replacedCost * (1 + pct)
  }

  const baseEligible = (e: Exercise): boolean =>
    e.active &&
    e.id !== target.exercise.id &&
    !inSessionIds.has(e.id) &&
    e.type === target.exercise.type &&
    e.equipment.every((eq) => equipmentSet.has(eq))

  // Fenêtre de zone primaire ±15 %, puis toute zone du remplacé ±15 %, puis ±30 %.
  const attempts: ((e: Exercise) => boolean)[] = [
    (e) => baseEligible(e) && e.zones.includes(target.exercise.primary_zone) && withinWindow(e, 0.15),
    (e) =>
      baseEligible(e) &&
      e.zones.some((z) => target.exercise.zones.includes(z)) &&
      withinWindow(e, 0.15),
    (e) =>
      baseEligible(e) &&
      e.zones.some((z) => target.exercise.zones.includes(z)) &&
      withinWindow(e, 0.3),
  ]

  const rng = createRng(params.context.seed)
  const targetShares = computeTargetShares(
    params.requestedZones,
    params.preferNeglectedZones ?? false,
    params.context.zoneVolume30d,
  )
  const otherSelected = params.currentItems
    .filter((_, i) => i !== params.indexToReplace)
    .map((item) => item.exercise)

  for (const attempt of attempts) {
    const pool = params.catalog.filter(attempt)
    if (pool.length === 0) continue

    const deficits = computeDeficits(
      targetShares,
      otherSelected,
      params.sessionTargetDurationS,
      cost,
    )
    const weights = pool.map((e) =>
      weight(e, params.context.now, params.context.lastPerformed, params.requestedZones, deficits, rng),
    )
    const pick = weightedPick(pool, weights, rng)
    return { ok: true, exercise: pick, durationS: pick.duration_target_s }
  }

  return { ok: false }
}
