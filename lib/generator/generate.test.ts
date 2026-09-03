import { describe, expect, it } from 'vitest'

import { TOLERANCE_S } from '@/lib/generator/constants'
import { generateSession } from '@/lib/generator/generate'
import type { Exercise, GeneratorContext, GeneratorInput } from '@/lib/generator/types'
import type { BodyPosition, EquipmentCode, ExerciseType, SymmetryType, ZoneCode } from '@/lib/referentials'

/**
 * Les 11 cas obligatoires de fin de `docs/generator.md`. Fixtures construites à la
 * main plutôt que sur `data/exercises.json`, pour garder chaque cas déterministe et
 * lisible indépendamment du contenu réel de la banque.
 */

const NOW = new Date('2026-09-02T12:00:00Z')

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000)
}

let seq = 0
function makeExercise(overrides: Partial<Exercise> & { zones: ZoneCode[] }): Exercise {
  seq += 1
  const zones = overrides.zones
  const firstZone = zones[0]
  if (firstZone === undefined) throw new Error('makeExercise: zones ne peut pas être vide')
  const target = overrides.duration_target_s ?? 30
  return {
    id: overrides.id ?? `id-${seq}`,
    slug: overrides.slug ?? `ex-${seq}`,
    type: overrides.type ?? 'active_stretch',
    position: overrides.position ?? 'standing',
    symmetry: overrides.symmetry ?? 'symmetric',
    zones,
    primary_zone: overrides.primary_zone ?? firstZone,
    equipment: overrides.equipment ?? [],
    intensity: overrides.intensity ?? 1,
    duration_target_s: target,
    duration_min_s: overrides.duration_min_s ?? Math.max(10, target - 15),
    duration_max_s: overrides.duration_max_s ?? target + 30,
    active: overrides.active ?? true,
  }
}

const ZONES_POOL: ZoneCode[] = [
  'calves',
  'hamstrings',
  'quads',
  'glutes',
  'abs',
  'lumbar',
  'shoulders',
  'pecs',
  'neck',
  'hip_flexors',
]
const TYPES: ExerciseType[] = ['massage', 'active_stretch', 'passive_stretch', 'muscle_activation']
const POSITIONS: BodyPosition[] = ['standing', 'wall', 'seated', 'quadruped', 'supine', 'prone', 'side_lying']

/** Catalogue fourni : 10 zones, 6 exercices chacune, types/positions/matériel variés. */
function bigCatalog(): Exercise[] {
  const exercises: Exercise[] = []
  let n = 0
  for (const zone of ZONES_POOL) {
    for (let i = 0; i < 6; i++) {
      n += 1
      const type = TYPES[n % TYPES.length] ?? 'active_stretch'
      const position = POSITIONS[n % POSITIONS.length] ?? 'standing'
      const symmetry: SymmetryType = n % 3 === 0 ? 'asymmetric' : 'symmetric'
      const equipment: EquipmentCode[] = n % 4 === 0 ? ['band'] : []
      const intensity = ((n % 3) + 1) as 1 | 2 | 3
      const target = 20 + (n % 5) * 15
      exercises.push(
        makeExercise({
          slug: `${zone}-${i}`,
          type,
          position,
          symmetry,
          zones: [zone],
          primary_zone: zone,
          equipment,
          intensity,
          duration_target_s: target,
          duration_min_s: Math.max(10, target - 15),
          duration_max_s: target + 30,
        }),
      )
    }
  }
  return exercises
}

function makeContext(catalog: Exercise[], seed: number, overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    catalog,
    lastPerformed: new Map(),
    zoneVolume30d: new Map(),
    now: NOW,
    seed,
    ...overrides,
  }
}

describe('generateSession', () => {
  it('déterminisme : seed et contexte identiques donnent le même résultat exact', () => {
    const catalog = bigCatalog()
    const input: GeneratorInput = { targetDurationS: 300, zones: ZONES_POOL.slice(0, 4), equipment: ['band'] }
    const resultA = generateSession(input, makeContext(catalog, 42))
    const resultB = generateSession(input, makeContext(catalog, 42))
    expect(resultB).toEqual(resultA)
  })

  it('variabilité : deux seeds différentes donnent des sélections différentes', () => {
    const catalog = bigCatalog()
    const input: GeneratorInput = { targetDurationS: 300, zones: ZONES_POOL.slice(0, 4), equipment: ['band'] }
    const resultA = generateSession(input, makeContext(catalog, 1))
    const resultB = generateSession(input, makeContext(catalog, 2))
    expect(resultA.ok).toBe(true)
    expect(resultB.ok).toBe(true)
    if (!resultA.ok || !resultB.ok) return
    const idsA = resultA.items.map((i) => i.exerciseId).sort()
    const idsB = resultB.items.map((i) => i.exerciseId).sort()
    expect(idsA).not.toEqual(idsB)
  })

  it('respect du budget : durée totale dans la tolérance, sur 200 générations', () => {
    const catalog = bigCatalog()
    const input: GeneratorInput = { targetDurationS: 300, zones: ZONES_POOL.slice(0, 4), equipment: ['band'] }
    for (let seed = 0; seed < 200; seed++) {
      const result = generateSession(input, makeContext(catalog, seed))
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(Math.abs(result.totalDurationS - input.targetDurationS)).toBeLessThanOrEqual(TOLERANCE_S)
    }
  })

  it('matériel : aucun exercice retenu ne réclame un matériel absent, sur 200 générations', () => {
    const catalog = bigCatalog()
    const catalogById = new Map(catalog.map((e) => [e.id, e]))
    const input: GeneratorInput = { targetDurationS: 300, zones: ZONES_POOL.slice(0, 4), equipment: [] }
    for (let seed = 0; seed < 200; seed++) {
      const result = generateSession(input, makeContext(catalog, seed))
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      for (const item of result.items) {
        const exercise = catalogById.get(item.exerciseId)
        expect(exercise?.equipment ?? []).toEqual([])
      }
    }
  })

  it('fraîcheur : un exercice réalisé hier est retenu significativement moins souvent, sur 500 tirages', () => {
    const recentlyDone = makeExercise({
      slug: 'recent',
      zones: ['calves'],
      duration_target_s: 30,
      duration_min_s: 20,
      duration_max_s: 40,
    })
    const longAgoDone = makeExercise({
      slug: 'long-ago',
      zones: ['calves'],
      duration_target_s: 30,
      duration_min_s: 20,
      duration_max_s: 40,
    })
    const catalog = [recentlyDone, longAgoDone]
    const lastPerformed = new Map([
      [recentlyDone.id, daysAgo(1)],
      [longAgoDone.id, daysAgo(30)],
    ])
    // Coût de chaque exercice 40s (30 + TRANSITION_S) : le budget ne permet d'en
    // retenir qu'un seul, ce qui isole le seul facteur qui les distingue, la fraîcheur.
    const input: GeneratorInput = { targetDurationS: 45, zones: ['calves'], equipment: [] }

    let recentCount = 0
    let longAgoCount = 0
    for (let seed = 0; seed < 500; seed++) {
      const result = generateSession(input, makeContext(catalog, seed, { lastPerformed }))
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const picked = result.items[0]?.exerciseId
      if (picked === recentlyDone.id) recentCount++
      if (picked === longAgoDone.id) longAgoCount++
    }

    expect(recentCount + longAgoCount).toBe(500)
    expect(longAgoCount).toBeGreaterThan(recentCount * 3)
  })

  it('couverture : huit zones demandées avec un budget large donnent au moins un exercice par zone', () => {
    const catalog = bigCatalog()
    const zones = ZONES_POOL.slice(0, 8)
    // Budget très supérieur au coût cumulé des 48 candidats (3695s) : la boucle de
    // sélection épuise tout le pool quelle que soit la seed, la couverture ne dépend
    // donc plus du tirage pondéré.
    const input: GeneratorInput = { targetDurationS: 4000, zones, equipment: ['band'] }
    const result = generateSession(input, makeContext(catalog, 7))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const c of result.coverage) {
      expect(c.exerciseCount).toBeGreaterThanOrEqual(1)
    }
  })

  it('ZONES_UNSERVABLE déclenché par huit zones sur dix minutes', () => {
    const zones = ZONES_POOL.slice(0, 8)
    const catalog = zones.map((zone) =>
      makeExercise({
        slug: `only-${zone}`,
        zones: [zone],
        duration_target_s: 140,
        duration_min_s: 100,
        duration_max_s: 160,
      }),
    )
    // Chaque exercice coûte 150s (140 + TRANSITION_S) ; 8 zones exigeraient 1200s,
    // le budget de 600s (dix minutes) ne peut en couvrir que 4.
    const input: GeneratorInput = { targetDurationS: 600, zones, equipment: [] }
    const result = generateSession(input, makeContext(catalog, 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('ZONES_UNSERVABLE')
    if (result.detail.reason !== 'ZONES_UNSERVABLE') return
    expect(result.detail.servableCount).toBe(4)
    expect(result.detail.droppedZones).toHaveLength(4)
  })

  it('BUDGET_TOO_SMALL déclenché par une minute demandée', () => {
    const catalog = [
      makeExercise({
        slug: 'too-long',
        zones: ['calves'],
        duration_target_s: 100,
        duration_min_s: 80,
        duration_max_s: 120,
      }),
    ]
    // Coût 110s (100 + TRANSITION_S), au-delà du budget d'une minute.
    const input: GeneratorInput = { targetDurationS: 60, zones: ['calves'], equipment: [] }
    const result = generateSession(input, makeContext(catalog, 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('BUDGET_TOO_SMALL')
    if (result.detail.reason !== 'BUDGET_TOO_SMALL') return
    expect(result.detail.minViableDurationS).toBe(110)
  })

  it('EMPTY_CATALOG déclenché par une zone sans exercice disponible, avec le bon motif dominant', () => {
    const catalog = [makeExercise({ slug: 'calves-only', zones: ['calves'] })]
    const input: GeneratorInput = { targetDurationS: 300, zones: ['neck'], equipment: [] }
    const result = generateSession(input, makeContext(catalog, 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('EMPTY_CATALOG')
    if (result.detail.reason !== 'EMPTY_CATALOG') return
    expect(result.detail.dominantCause).toBe('zones')
  })

  it("ordonnancement : le premier exercice est d'intensité minimale, l'ordre relatif des suivants est conservé", () => {
    const massage = makeExercise({
      slug: 'bbb-massage',
      zones: ['calves'],
      type: 'massage',
      intensity: 3,
      duration_target_s: 20,
      duration_min_s: 10,
      duration_max_s: 25,
    })
    const activeMinA = makeExercise({
      slug: 'aaa-active',
      zones: ['calves'],
      type: 'active_stretch',
      intensity: 1,
      duration_target_s: 20,
      duration_min_s: 10,
      duration_max_s: 25,
    })
    const passiveMinB = makeExercise({
      slug: 'bbb-passive',
      zones: ['calves'],
      type: 'passive_stretch',
      intensity: 1,
      duration_target_s: 20,
      duration_min_s: 10,
      duration_max_s: 25,
    })
    const activation = makeExercise({
      slug: 'ccc-activation',
      zones: ['calves'],
      type: 'muscle_activation',
      intensity: 2,
      duration_target_s: 20,
      duration_min_s: 10,
      duration_max_s: 25,
    })
    const catalog = [massage, activeMinA, passiveMinB, activation]
    // Coût de chacun 30s (20 + TRANSITION_S), 4 * 30 = 120 : le budget de 125s permet
    // de tous les retenir, quel que soit l'ordre de tirage.
    const input: GeneratorInput = { targetDurationS: 125, zones: ['calves'], equipment: [] }
    const result = generateSession(input, makeContext(catalog, 3))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(4)

    // Tri composite avant promotion : massage, active_stretch, passive_stretch,
    // muscle_activation. « aaa-active » l'emporte sur « bbb-passive » à égalité
    // d'intensité minimale (1), au slug.
    expect(result.items[0]?.exerciseId).toBe(activeMinA.id)
    const rest = result.items.slice(1).map((i) => i.exerciseId)
    expect(rest).toEqual([massage.id, passiveMinB.id, activation.id])
  })

  it('ajustement : la durée totale reste dans la tolérance et aucune durée ne sort de sa plage', () => {
    const exercise = makeExercise({
      slug: 'flexible',
      zones: ['calves'],
      duration_target_s: 30,
      duration_min_s: 20,
      duration_max_s: 200,
    })
    const catalog = [exercise]
    // Coût 40s ; un seul candidat existe, donc `remaining` après sélection vaut 60s,
    // bien au-delà de TOLERANCE_S, et l'ajustement doit l'absorber via le flex.
    const input: GeneratorInput = { targetDurationS: 100, zones: ['calves'], equipment: [] }
    const result = generateSession(input, makeContext(catalog, 1))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.abs(result.totalDurationS - input.targetDurationS)).toBeLessThanOrEqual(TOLERANCE_S)
    for (const item of result.items) {
      expect(item.durationS).toBeGreaterThanOrEqual(exercise.duration_target_s)
      expect(item.durationS).toBeLessThanOrEqual(exercise.duration_max_s)
    }
  })
})
