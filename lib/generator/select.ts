import { cost } from '@/lib/generator/cost'
import type { Rng } from '@/lib/generator/rng'
import type { Exercise, ExerciseId, GeneratorContext, GeneratorInput } from '@/lib/generator/types'
import { computeDeficits, computeTargetShares, weight } from '@/lib/generator/weighting'
import type { ExerciseType } from '@/lib/referentials'

/** Roue de la fortune sur la somme des poids, sans remise. */
export function weightedPick(pool: Exercise[], weights: number[], rng: Rng): Exercise {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 0
    if (r <= 0) {
      const pick = pool[i]
      if (pick !== undefined) return pick
    }
  }
  // Filet de sécurité en cas d'arrondi flottant : le dernier candidat encaisse le reste.
  const last = pool[pool.length - 1]
  if (last === undefined) throw new Error('weightedPick appelé sur un pool vide')
  return last
}

export type SelectionResult = {
  selected: Exercise[]
  unmetRequiredTypes: ExerciseType[]
  remaining: number
}

/** Étape 4 : sélection, `requiredTypes` en priorité puis remplissage du budget. */
export function selectExercises(
  candidates: Exercise[],
  input: GeneratorInput,
  context: Pick<GeneratorContext, 'now' | 'lastPerformed' | 'zoneVolume30d'>,
  rng: Rng,
): SelectionResult {
  const targetShares = computeTargetShares(
    input.zones,
    input.preferNeglectedZones ?? false,
    context.zoneVolume30d,
  )

  const selected: Exercise[] = []
  const selectedIds = new Set<ExerciseId>()
  let pool = candidates
  let remaining = input.targetDurationS

  const pickFrom = (subPool: Exercise[]): Exercise => {
    const deficits = computeDeficits(targetShares, selected, input.targetDurationS, cost)
    const weights = subPool.map((e) =>
      weight(e, context.now, context.lastPerformed, input.zones, deficits, rng),
    )
    return weightedPick(subPool, weights, rng)
  }

  const take = (pick: Exercise): void => {
    selected.push(pick)
    selectedIds.add(pick.id)
    remaining -= cost(pick)
    pool = pool.filter((e) => e.id !== pick.id)
  }

  const unmetRequiredTypes: ExerciseType[] = []
  for (const t of input.requiredTypes ?? []) {
    const typePool = pool.filter((e) => e.type === t && cost(e) <= remaining)
    if (typePool.length === 0) {
      unmetRequiredTypes.push(t)
      continue
    }
    take(pickFrom(typePool))
  }

  for (;;) {
    const available = pool.filter((e) => cost(e) <= remaining)
    if (available.length === 0) break
    take(pickFrom(available))
  }

  return { selected, unmetRequiredTypes, remaining }
}
