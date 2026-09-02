import { cost } from '@/lib/generator/cost'
import { filterCandidates, type FilterOptions } from '@/lib/generator/filter'
import type { Exercise, FailureDetail } from '@/lib/generator/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * `EMPTY_CATALOG` : recalcule le filtrage en relâchant tour à tour le matériel et
 * les zones pour désigner la contrainte dont le relâchement seul fait réapparaître
 * des candidats.
 */
export function computeEmptyCatalogDetail(
  catalog: Exercise[],
  opts: FilterOptions,
): FailureDetail & { reason: 'EMPTY_CATALOG' } {
  const withoutEquipment = filterCandidates(catalog, { ...opts, skipEquipment: true }).length
  const withoutZones = filterCandidates(catalog, { ...opts, skipZones: true }).length

  if (withoutEquipment > 0 && withoutZones === 0) {
    return {
      reason: 'EMPTY_CATALOG',
      dominantCause: 'equipment',
      message: 'Aucun candidat avec ce matériel : relâche le matériel disponible.',
    }
  }
  if (withoutZones > 0 && withoutEquipment === 0) {
    return {
      reason: 'EMPTY_CATALOG',
      dominantCause: 'zones',
      message: 'Aucun candidat sur ces zones : élargis les zones demandées.',
    }
  }
  if (withoutEquipment > 0 && withoutZones > 0) {
    const dominant = withoutEquipment >= withoutZones ? 'equipment' : 'zones'
    return {
      reason: 'EMPTY_CATALOG',
      dominantCause: dominant,
      message:
        dominant === 'equipment'
          ? 'Relâcher le matériel disponible ramène le plus de candidats.'
          : 'Élargir les zones demandées ramène le plus de candidats.',
    }
  }
  return {
    reason: 'EMPTY_CATALOG',
    dominantCause: 'both',
    message:
      'Ni le matériel ni les zones ne suffisent seuls : vérifie aussi le type exclu et l\'intensité maximale.',
  }
}

export type ServableZonesResult = {
  servableCount: number
  droppedZones: ZoneCode[]
}

/**
 * `ZONES_UNSERVABLE` : heuristique gloutonne (choix validé le 2026-09-02). Trie les
 * zones demandées par coût du candidat le moins cher qui les touche, cumule ces
 * coûts sans tenir compte du partage entre zones, jusqu'à dépasser le budget. Peut
 * sous-estimer légèrement la couverture réelle quand un exercice couvre plusieurs
 * zones ; c'est acceptable pour un avertissement non bloquant.
 */
export function computeServableZones(
  candidates: Exercise[],
  requestedZones: ZoneCode[],
  targetDurationS: number,
): ServableZonesResult {
  const minCostByZone = new Map<ZoneCode, number>()
  for (const zone of requestedZones) {
    const costs = candidates.filter((e) => e.zones.includes(zone)).map(cost)
    minCostByZone.set(zone, costs.length > 0 ? Math.min(...costs) : Number.POSITIVE_INFINITY)
  }

  const byCostAsc = [...requestedZones].sort(
    (a, b) => (minCostByZone.get(a) ?? Infinity) - (minCostByZone.get(b) ?? Infinity),
  )

  let cumulative = 0
  const servable = new Set<ZoneCode>()
  for (const zone of byCostAsc) {
    const zoneCost = minCostByZone.get(zone) ?? Infinity
    if (!Number.isFinite(zoneCost)) break
    if (cumulative + zoneCost > targetDurationS) break
    cumulative += zoneCost
    servable.add(zone)
  }

  return {
    servableCount: servable.size,
    droppedZones: requestedZones.filter((z) => !servable.has(z)),
  }
}
