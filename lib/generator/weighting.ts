import {
  FRESHNESS_FLOOR,
  FRESHNESS_WINDOW_D,
  NEVER_DONE_BONUS,
  NOISE_MAX,
  NOISE_MIN,
  ZONE_NEED_FLOOR,
  ZONE_VOLUME_EPSILON_S,
} from '@/lib/generator/constants'
import type { Rng } from '@/lib/generator/rng'
import type { Exercise, ExerciseId } from '@/lib/generator/types'
import type { ZoneCode } from '@/lib/referentials'

const MS_PER_DAY = 86_400_000

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Fraîcheur, qui casse la routine. */
export function freshness(
  exerciseId: ExerciseId,
  now: Date,
  lastPerformed: Map<ExerciseId, Date>,
): number {
  const last = lastPerformed.get(exerciseId)
  if (last === undefined) return NEVER_DONE_BONUS
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY
  return clamp(daysSince / FRESHNESS_WINDOW_D, FRESHNESS_FLOOR, 1)
}

/**
 * Part de budget visée par zone demandée. Égale par défaut ; pondérée par l'inverse
 * du volume 30 jours (avec un plancher pour éviter la division par zéro) si
 * `preferNeglectedZones` est vrai.
 */
export function computeTargetShares(
  zones: ZoneCode[],
  preferNeglectedZones: boolean,
  zoneVolume30d: Map<ZoneCode, number>,
): Map<ZoneCode, number> {
  if (!preferNeglectedZones) {
    const share = 1 / zones.length
    return new Map(zones.map((z) => [z, share]))
  }

  const weights = zones.map((z) => 1 / ((zoneVolume30d.get(z) ?? 0) + ZONE_VOLUME_EPSILON_S))
  const total = weights.reduce((sum, w) => sum + w, 0)
  return new Map(zones.map((z, i) => [z, (weights[i] ?? 0) / total]))
}

/** Budget déjà attribué à une zone par les exercices retenus, en part du budget cible. */
export function allocatedShare(
  zone: ZoneCode,
  selected: Exercise[],
  targetDurationS: number,
  costFn: (e: Exercise) => number,
): number {
  const allocatedS = selected
    .filter((e) => e.zones.includes(zone))
    .reduce((sum, e) => sum + costFn(e), 0)
  return allocatedS / targetDurationS
}

export function computeDeficits(
  targetShares: Map<ZoneCode, number>,
  selected: Exercise[],
  targetDurationS: number,
  costFn: (e: Exercise) => number,
): Map<ZoneCode, number> {
  const deficits = new Map<ZoneCode, number>()
  for (const [zone, target] of targetShares) {
    const allocated = allocatedShare(zone, selected, targetDurationS, costFn)
    deficits.set(zone, Math.max(target - allocated, 0))
  }
  return deficits
}

/** Besoin de zone : le déficit maximal parmi les zones demandées touchées par `e`. */
export function zoneNeed(
  e: Exercise,
  requestedZones: ZoneCode[],
  deficits: Map<ZoneCode, number>,
): number {
  const requestedSet = new Set(requestedZones)
  const relevantDeficits = e.zones
    .filter((z) => requestedSet.has(z))
    .map((z) => deficits.get(z) ?? 0)
  const maxDeficit = relevantDeficits.length > 0 ? Math.max(...relevantDeficits) : 0
  return Math.max(maxDeficit, ZONE_NEED_FLOOR)
}

/** Poids final : produit des trois facteurs multiplicatifs de l'étape 3. */
export function weight(
  e: Exercise,
  now: Date,
  lastPerformed: Map<ExerciseId, Date>,
  requestedZones: ZoneCode[],
  deficits: Map<ZoneCode, number>,
  rng: Rng,
): number {
  return (
    freshness(e.id, now, lastPerformed) *
    zoneNeed(e, requestedZones, deficits) *
    rng.uniform(NOISE_MIN, NOISE_MAX)
  )
}
