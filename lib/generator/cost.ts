import { TRANSITION_S } from '@/lib/generator/constants'
import type { Exercise } from '@/lib/generator/types'

/** Étape 2 : coût temps d'un exercice, transition de fin de séance comprise. */
export function cost(e: Pick<Exercise, 'duration_target_s' | 'symmetry'>): number {
  return e.duration_target_s * (e.symmetry === 'asymmetric' ? 2 : 1) + TRANSITION_S
}

/** Même formule sur une durée choisie (post-ajustement) plutôt que la cible. */
export function costForDuration(
  durationS: number,
  symmetry: Exercise['symmetry'],
): number {
  return durationS * (symmetry === 'asymmetric' ? 2 : 1) + TRANSITION_S
}
