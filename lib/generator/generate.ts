import { adjustDurations } from '@/lib/generator/adjust'
import { cost, costForDuration } from '@/lib/generator/cost'
import { computeCoverage } from '@/lib/generator/coverage'
import { computeEmptyCatalogDetail, computeServableZones } from '@/lib/generator/failures'
import { filterCandidates } from '@/lib/generator/filter'
import { orderSelected } from '@/lib/generator/order'
import { createRng } from '@/lib/generator/rng'
import { selectExercises } from '@/lib/generator/select'
import type { GeneratorContext, GeneratorInput, GeneratorResult, SessionItem } from '@/lib/generator/types'

/** Orchestrateur : les étapes 1 à 7 de `docs/generator.md`, dans l'ordre. */
export function generateSession(
  input: GeneratorInput,
  context: GeneratorContext,
): GeneratorResult {
  const rng = createRng(context.seed)
  const catalog = [...context.catalog].sort((a, b) => a.slug.localeCompare(b.slug))

  const filterOpts = {
    zones: input.zones,
    equipment: input.equipment,
    excludedTypes: input.excludedTypes,
    maxIntensity: input.maxIntensity,
  }
  const candidates = filterCandidates(catalog, filterOpts)

  if (candidates.length === 0) {
    return { ok: false, reason: 'EMPTY_CATALOG', detail: computeEmptyCatalogDetail(catalog, filterOpts) }
  }

  const minCost = Math.min(...candidates.map(cost))
  if (minCost > input.targetDurationS) {
    return {
      ok: false,
      reason: 'BUDGET_TOO_SMALL',
      detail: { reason: 'BUDGET_TOO_SMALL', minViableDurationS: minCost },
    }
  }

  const { servableCount, droppedZones } = computeServableZones(
    candidates,
    input.zones,
    input.targetDurationS,
  )
  if (droppedZones.length > 0) {
    return {
      ok: false,
      reason: 'ZONES_UNSERVABLE',
      detail: { reason: 'ZONES_UNSERVABLE', servableCount, droppedZones },
    }
  }

  const { selected, unmetRequiredTypes, remaining } = selectExercises(
    candidates,
    input,
    context,
    rng,
  )

  const adjusted = adjustDurations(selected, remaining, input.toleranceS)
  const ordered = orderSelected(adjusted)
  const coverage = computeCoverage(ordered, input.zones)

  const items: SessionItem[] = ordered.map((item, index) => ({
    exerciseId: item.exercise.id,
    ord: index,
    durationS: item.durationS,
    perSide: item.exercise.symmetry === 'asymmetric',
  }))

  const totalDurationS = ordered.reduce(
    (sum, item) => sum + costForDuration(item.durationS, item.exercise.symmetry),
    0,
  )

  return { ok: true, items, totalDurationS, coverage, unmetRequiredTypes }
}
