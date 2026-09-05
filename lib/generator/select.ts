import { cost } from '@/lib/generator/cost'
import type { Rng } from '@/lib/generator/rng'
import type { Exercise, ExerciseId, GeneratorContext, GeneratorInput } from '@/lib/generator/types'
import { computeDeficits, computeTargetShares, weight } from '@/lib/generator/weighting'
import type { ExerciseType } from '@/lib/referentials'

/**
 * Roue de la fortune sur la somme des poids, sans remise. Générique : réutilisée
 * telle quelle pour tirer un exercice, et pour tirer une zone bonus (étape de
 * variation, `variation.ts`).
 */
export function weightedPick<T>(pool: T[], weights: number[], rng: Rng): T {
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

/**
 * Étape 4 : sélection, `requiredTypes` en priorité puis remplissage du budget.
 *
 * `preSelected` porte l'exercice bonus de l'étape de variation (le cas échéant,
 * cf. `variation.ts`) : déjà retenu, son coût est déduit du budget de départ, et
 * `candidates` est censé ne plus le contenir (retiré par l'appelant). Il compte
 * dans `selected` dès le départ, donc dans le calcul des déficits de zone comme
 * n'importe quel autre exercice retenu.
 */
export function selectExercises(
  candidates: Exercise[],
  input: GeneratorInput,
  context: Pick<GeneratorContext, 'now' | 'lastPerformed' | 'zoneVolume30d'>,
  rng: Rng,
  preSelected: Exercise[] = [],
): SelectionResult {
  const targetShares = computeTargetShares(
    input.zones,
    input.preferNeglectedZones ?? false,
    context.zoneVolume30d,
  )

  const selected: Exercise[] = [...preSelected]
  const selectedIds = new Set<ExerciseId>(preSelected.map((e) => e.id))
  let pool = candidates
  let remaining = input.targetDurationS - preSelected.reduce((sum, e) => sum + cost(e), 0)

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
