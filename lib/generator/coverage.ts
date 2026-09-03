import { costForDuration } from '@/lib/generator/cost'
import type { AdjustedExercise } from '@/lib/generator/adjust'
import type { ZoneCoverage } from '@/lib/generator/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * Étape 7 : pour chaque zone demandée, le nombre d'exercices retenus la touchant et
 * les secondes qui lui sont allouées (coût des exercices, transition comprise, même
 * unité que le budget des étapes 2 et 3).
 */
export function computeCoverage(
  ordered: AdjustedExercise[],
  requestedZones: ZoneCode[],
): ZoneCoverage[] {
  return requestedZones.map((zone) => {
    const touching = ordered.filter((item) => item.exercise.zones.includes(zone))
    const allocatedS = touching.reduce(
      (sum, item) => sum + costForDuration(item.durationS, item.exercise.symmetry),
      0,
    )
    return { zone, exerciseCount: touching.length, allocatedS }
  })
}
