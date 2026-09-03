import { POSITION_ORDER, TYPE_ORDER } from '@/lib/generator/constants'
import type { AdjustedExercise } from '@/lib/generator/adjust'

const typeRank = new Map(TYPE_ORDER.map((t, i) => [t, i]))
const positionRank = new Map(POSITION_ORDER.map((p, i) => [p, i]))

/**
 * Étape 6 : tri par rang de type, puis rang de position, puis intensité croissante,
 * puis slug pour la stabilité ; puis promotion de l'exercice d'intensité minimale en
 * première position, le reste conservant son ordre relatif.
 */
export function orderSelected(selected: AdjustedExercise[]): AdjustedExercise[] {
  const sorted = [...selected].sort((a, b) => {
    const byType = (typeRank.get(a.exercise.type) ?? 0) - (typeRank.get(b.exercise.type) ?? 0)
    if (byType !== 0) return byType
    const byPosition =
      (positionRank.get(a.exercise.position) ?? 0) - (positionRank.get(b.exercise.position) ?? 0)
    if (byPosition !== 0) return byPosition
    const byIntensity = a.exercise.intensity - b.exercise.intensity
    if (byIntensity !== 0) return byIntensity
    return a.exercise.slug.localeCompare(b.exercise.slug)
  })

  if (sorted.length <= 1) return sorted

  let minIndex = 0
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const min = sorted[minIndex]
    if (current === undefined || min === undefined) continue
    const lowerIntensity = current.exercise.intensity < min.exercise.intensity
    const tieBySlug =
      current.exercise.intensity === min.exercise.intensity &&
      current.exercise.slug < min.exercise.slug
    if (lowerIntensity || tieBySlug) minIndex = i
  }

  const promoted = sorted[minIndex]
  if (promoted === undefined || minIndex === 0) return sorted
  const rest = sorted.filter((_, i) => i !== minIndex)
  return [promoted, ...rest]
}
