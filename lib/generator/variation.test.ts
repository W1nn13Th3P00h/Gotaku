import { describe, expect, it } from 'vitest'

import { createRng } from '@/lib/generator/rng'
import type { Exercise, GeneratorContext } from '@/lib/generator/types'
import { pickVariationExercise, type VariationInput } from '@/lib/generator/variation'
import { ZONE_CODES } from '@/lib/referentials'
import type { ZoneCode } from '@/lib/referentials'

/**
 * `pickVariationExercise` : étape de variation (bonus) de `docs/generator.md`,
 * « Étape 2 bis ». Fixtures construites à la main, un seul zone par exercice pour
 * que la zone bonus se lise directement sur l'exercice retourné.
 */

const NOW = new Date('2026-09-05T12:00:00Z')

let seq = 0
function makeExercise(overrides: Partial<Exercise> & { zones: ZoneCode[] }): Exercise {
  seq += 1
  const target = overrides.duration_target_s ?? 30
  return {
    id: overrides.id ?? `id-${seq}`,
    slug: overrides.slug ?? `ex-${seq}`,
    type: overrides.type ?? 'active_stretch',
    position: overrides.position ?? 'standing',
    symmetry: overrides.symmetry ?? 'symmetric',
    zones: overrides.zones,
    primary_zone: overrides.primary_zone ?? overrides.zones[0] ?? 'calves',
    equipment: overrides.equipment ?? [],
    intensity: overrides.intensity ?? 1,
    duration_target_s: target,
    duration_min_s: overrides.duration_min_s ?? Math.max(10, target - 15),
    duration_max_s: overrides.duration_max_s ?? target + 30,
    active: overrides.active ?? true,
  }
}

/** Un exercice par zone du référentiel (26 zones), une seule zone chacun. */
function fullZoneCatalog(): Exercise[] {
  return ZONE_CODES.map((zone) =>
    makeExercise({ slug: `only-${zone}`, zones: [zone], duration_target_s: 30 }),
  )
}

function makeContext(
  overrides: Partial<GeneratorContext> = {},
): Pick<GeneratorContext, 'now' | 'lastPerformed' | 'zoneVolume30d'> {
  return {
    now: NOW,
    lastPerformed: new Map(),
    zoneVolume30d: new Map(),
    ...overrides,
  }
}

const REQUESTED_ZONES: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes', 'abs']

describe('pickVariationExercise', () => {
  it('déterminisme : seed et contexte identiques donnent la même décision, la même zone, le même exercice', () => {
    const catalog = fullZoneCatalog()
    const input: VariationInput = { targetDurationS: 300, zones: REQUESTED_ZONES, equipment: [] }
    const context = makeContext()

    const resultA = pickVariationExercise(catalog, input, context, createRng(5))
    const resultB = pickVariationExercise(catalog, input, context, createRng(5))

    expect(resultB?.id).toBe(resultA?.id)
  })

  it('variabilité : sur un catalogue fourni, des seeds différentes donnent parfois une décision différente', () => {
    const catalog = fullZoneCatalog()
    const input: VariationInput = { targetDurationS: 300, zones: REQUESTED_ZONES, equipment: [] }
    const context = makeContext()

    const outcomes = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const result = pickVariationExercise(catalog, input, context, createRng(seed))
      outcomes.add(result?.id ?? 'none')
    }

    expect(outcomes.size).toBeGreaterThan(1)
  })

  it("la zone bonus n'est jamais une zone de input.zones, sur plusieurs tirages", () => {
    const catalog = fullZoneCatalog()
    const input: VariationInput = { targetDurationS: 300, zones: REQUESTED_ZONES, equipment: [] }
    const context = makeContext()
    const requestedSet = new Set(REQUESTED_ZONES)

    let sawBonus = false
    for (let seed = 0; seed < 60; seed++) {
      const result = pickVariationExercise(catalog, input, context, createRng(seed))
      if (result === null) continue
      sawBonus = true
      for (const zone of result.zones) {
        expect(requestedSet.has(zone)).toBe(false)
      }
    }
    expect(sawBonus).toBe(true)
  })

  it('aucune zone exotique éligible (toutes les zones du référentiel sont demandées) : jamais de bonus', () => {
    const catalog = fullZoneCatalog()
    const input: VariationInput = { targetDurationS: 300, zones: [...ZONE_CODES], equipment: [] }
    const context = makeContext()

    for (let seed = 0; seed < 50; seed++) {
      const result = pickVariationExercise(catalog, input, context, createRng(seed))
      expect(result).toBeNull()
    }
  })

  it('slot bonus trop petit pour le moindre candidat bonus disponible : jamais de bonus', () => {
    const catalog = fullZoneCatalog()
    // Coût de chaque candidat exotique : 40s (30 + TRANSITION_S). Slot bonus =
    // VARIATION_BUDGET_SHARE (0.15) * 100 = 15s, largement sous ce coût.
    const input: VariationInput = { targetDurationS: 100, zones: REQUESTED_ZONES, equipment: [] }
    const context = makeContext()

    for (let seed = 0; seed < 100; seed++) {
      const result = pickVariationExercise(catalog, input, context, createRng(seed))
      expect(result).toBeNull()
    }
  })
})
