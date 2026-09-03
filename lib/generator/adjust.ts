import { TOLERANCE_S } from '@/lib/generator/constants'
import type { Exercise } from '@/lib/generator/types'

export type AdjustedExercise = {
  exercise: Exercise
  /** Durée finale, par côté sur un exercice asymétrique. */
  durationS: number
}

const sideFactor = (e: Exercise): number => (e.symmetry === 'asymmetric' ? 2 : 1)
const flexPerSideMaxS = (e: Exercise): number => e.duration_max_s - e.duration_target_s
/** Poids de l'étape 5 : le flex pèse double sur un exercice asymétrique. */
const flexBudget = (e: Exercise): number => flexPerSideMaxS(e) * sideFactor(e)
/** Plafond par côté, arrondi à 5s vers le bas pour ne jamais dépasser `duration_max_s`. */
const capPerSideS = (e: Exercise): number => Math.floor(flexPerSideMaxS(e) / 5) * 5

/**
 * Étape 5 : ajustement fin. Le seul cas géré ici est celui de la sortie normale de
 * la boucle de sélection, où `remaining` est positif et inférieur au coût du plus
 * petit candidat restant — jamais négatif, la sélection ne dépasse jamais le budget.
 */
export function adjustDurations(
  selected: Exercise[],
  remaining: number,
  toleranceS: number = TOLERANCE_S,
): AdjustedExercise[] {
  const atTarget = (): AdjustedExercise[] =>
    selected.map((exercise) => ({ exercise, durationS: exercise.duration_target_s }))

  if (remaining <= toleranceS) return atTarget()

  const totalFlexBudget = selected.reduce((sum, e) => sum + flexBudget(e), 0)
  if (totalFlexBudget <= 0) return atTarget()

  const toDistributeBudget = Math.min(remaining, totalFlexBudget)

  const raws = selected.map((e) => {
    const shareBudget = toDistributeBudget * (flexBudget(e) / totalFlexBudget)
    return shareBudget / sideFactor(e)
  })

  const bases = selected.map((e, i) => {
    const cap = capPerSideS(e)
    const base = Math.floor((raws[i] ?? 0) / 5) * 5
    return Math.min(base, cap)
  })

  const spentBudget = selected.reduce((sum, e, i) => sum + (bases[i] ?? 0) * sideFactor(e), 0)
  let leftoverBudget = toDistributeBudget - spentBudget

  // Reliquat de l'arrondi distribué par tranches de 5s, au plus gros reste fractionnaire.
  const order = selected
    .map((_, i) => i)
    .sort((a, b) => (raws[b] ?? 0) - (bases[b] ?? 0) - ((raws[a] ?? 0) - (bases[a] ?? 0)))

  let progressed = true
  while (leftoverBudget >= 5 && progressed) {
    progressed = false
    for (const i of order) {
      const e = selected[i]
      if (e === undefined) continue
      const increment = 5 * sideFactor(e)
      if (increment > leftoverBudget) continue
      const cap = capPerSideS(e)
      const currentBase = bases[i] ?? 0
      if (currentBase + 5 > cap) continue
      bases[i] = currentBase + 5
      leftoverBudget -= increment
      progressed = true
      if (leftoverBudget < 5) break
    }
  }

  return selected.map((exercise, i) => ({
    exercise,
    durationS: exercise.duration_target_s + (bases[i] ?? 0),
  }))
}
