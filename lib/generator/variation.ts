import {
  NOISE_MAX,
  NOISE_MIN,
  VARIATION_BUDGET_SHARE,
  VARIATION_PROBABILITY,
  VARIATION_ZONE_EPSILON,
} from '@/lib/generator/constants'
import { cost } from '@/lib/generator/cost'
import { filterCandidates, type FilterOptions } from '@/lib/generator/filter'
import type { Rng } from '@/lib/generator/rng'
import { weightedPick } from '@/lib/generator/select'
import type { Exercise, GeneratorContext, GeneratorInput } from '@/lib/generator/types'
import { freshness } from '@/lib/generator/weighting'
import { ZONE_CODES } from '@/lib/referentials'

export type VariationInput = Pick<
  GeneratorInput,
  'targetDurationS' | 'zones' | 'equipment' | 'excludedTypes' | 'maxIntensity'
>

/**
 * Étape de variation (docs/generator.md, « Étape 2 bis »), insérée entre l'étape 2
 * (coût) et l'étape 3 (pondération normale). Retourne l'exercice bonus retenu, ou
 * `null` si le bonus n'est pas activé ou s'annule silencieusement (aucune zone
 * exotique éligible, ou aucun candidat dans le budget du slot bonus).
 *
 * Le rng est consommé pour le tirage d'activation même quand le bonus s'annule
 * ensuite : jamais de retour en arrière sur sa consommation, condition du
 * déterminisme.
 */
export function pickVariationExercise(
  catalog: Exercise[],
  input: VariationInput,
  context: Pick<GeneratorContext, 'now' | 'lastPerformed' | 'zoneVolume30d'>,
  rng: Rng,
): Exercise | null {
  const activated = rng.uniform(0, 1) < VARIATION_PROBABILITY
  if (!activated) return null

  const baseFilterOpts: Omit<FilterOptions, 'zones'> = {
    equipment: input.equipment,
    excludedTypes: input.excludedTypes,
    maxIntensity: input.maxIntensity,
  }

  const requestedZones = new Set(input.zones)
  const exoticZones = ZONE_CODES.filter((z) => !requestedZones.has(z))
  const eligibleZones = exoticZones.filter(
    (zone) => filterCandidates(catalog, { ...baseFilterOpts, zones: [zone] }).length > 0,
  )
  if (eligibleZones.length === 0) return null

  const zoneWeights = eligibleZones.map(
    (zone) => 1 / ((context.zoneVolume30d.get(zone) ?? 0) + VARIATION_ZONE_EPSILON),
  )
  const bonusZone = weightedPick(eligibleZones, zoneWeights, rng)

  const bonusCandidates = filterCandidates(catalog, { ...baseFilterOpts, zones: [bonusZone] })

  // Budget du slot bonus : part du budget total intact à ce stade (avant toute
  // sélection), jamais plus que ce budget total lui-même.
  const slot = Math.min(VARIATION_BUDGET_SHARE * input.targetDurationS, input.targetDurationS)
  const affordable = bonusCandidates.filter((e) => cost(e) <= slot)
  if (affordable.length === 0) return null

  // Poids : fraîcheur * bruit uniquement. `zoneNeed` n'est pas pertinent hors des
  // zones demandées par l'utilisateur, équivalent à le fixer à 1.
  const weights = affordable.map(
    (e) => freshness(e.id, context.now, context.lastPerformed) * rng.uniform(NOISE_MIN, NOISE_MAX),
  )
  return weightedPick(affordable, weights, rng)
}
