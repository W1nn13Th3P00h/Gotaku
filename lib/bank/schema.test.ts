import { describe, expect, it } from 'vitest'

import { bankSchema, exerciseInputSchema } from '@/lib/bank/schema'

const valid = {
  slug: 'couch-stretch',
  name: 'Couch stretch',
  type: 'passive_stretch',
  position: 'quadruped',
  symmetry: 'asymmetric',
  zones: ['hip_flexors', 'quads'],
  primary_zone: 'hip_flexors',
  equipment: ['box'],
  intensity: 3,
  duration_target_s: 90,
  duration_min_s: 60,
  duration_max_s: 150,
  instructions: ['Genou arrière au sol contre le mur.'],
} as const

const withOverride = (patch: Record<string, unknown>) => ({ ...valid, ...patch })

describe('exerciseInputSchema', () => {
  it('accepte un exercice conforme', () => {
    const parsed = exerciseInputSchema.parse(valid)
    expect(parsed.slug).toBe('couch-stretch')
    expect(parsed.equipment).toEqual(['box'])
  })

  it('accepte une liste de matériel absente et la remplace par un tableau vide', () => {
    const { equipment: _equipment, ...withoutEquipment } = valid
    const parsed = exerciseInputSchema.parse(withoutEquipment)
    expect(parsed.equipment).toEqual([])
  })

  it('refuse une clé inconnue', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ difficulty: 2 })).success).toBe(false)
  })

  it.each([
    ['un slug avec majuscule', { slug: 'Couch-Stretch' }],
    ['un slug avec espace', { slug: 'couch stretch' }],
    ['un slug avec underscore', { slug: 'couch_stretch' }],
    ['un slug accentué', { slug: 'étirement' }],
  ])('refuse %s', (_label, patch) => {
    expect(exerciseInputSchema.safeParse(withOverride(patch)).success).toBe(false)
  })

  it('refuse une zone hors référentiel', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ zones: ['psoas'] })).success).toBe(false)
  })

  it('refuse une zone en doublon', () => {
    const result = exerciseInputSchema.safeParse(
      withOverride({ zones: ['quads', 'quads'], primary_zone: 'quads' }),
    )
    expect(result.success).toBe(false)
  })

  it('refuse une liste de zones vide', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ zones: [] })).success).toBe(false)
  })

  it('refuse une primary_zone absente de zones', () => {
    const result = exerciseInputSchema.safeParse(withOverride({ primary_zone: 'glutes' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['primary_zone'])
  })

  it('refuse un matériel hors référentiel', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ equipment: ['kettlebell'] })).success).toBe(
      false,
    )
  })

  it('refuse un matériel en doublon', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ equipment: ['box', 'box'] })).success).toBe(
      false,
    )
  })

  it('refuse une durée minimale supérieure à la cible', () => {
    const result = exerciseInputSchema.safeParse(
      withOverride({ duration_min_s: 120, duration_target_s: 90 }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['duration_min_s'])
  })

  it('refuse une durée maximale inférieure à la cible', () => {
    const result = exerciseInputSchema.safeParse(withOverride({ duration_max_s: 60 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['duration_max_s'])
  })

  it('refuse une durée minimale sous le plancher de 10 secondes', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ duration_min_s: 5 })).success).toBe(false)
  })

  it('refuse une durée cible au-delà de 600 secondes', () => {
    const result = exerciseInputSchema.safeParse(
      withOverride({ duration_target_s: 900, duration_max_s: 900 }),
    )
    expect(result.success).toBe(false)
  })

  it('refuse une durée non entière', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ duration_target_s: 90.5 })).success).toBe(
      false,
    )
  })

  it('refuse une intensité hors de la plage 1 à 3', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ intensity: 4 })).success).toBe(false)
    expect(exerciseInputSchema.safeParse(withOverride({ intensity: 0 })).success).toBe(false)
  })

  it('refuse une position hors référentiel', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ position: 'kneeling' })).success).toBe(false)
  })

  it('accepte la position hanging, morte dans la banque mais valide au référentiel', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ position: 'hanging' })).success).toBe(true)
  })

  it('refuse zéro instruction', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ instructions: [] })).success).toBe(false)
  })

  it('refuse plus de six instructions', () => {
    expect(
      exerciseInputSchema.safeParse(withOverride({ instructions: Array(7).fill('Fais ça.') }))
        .success,
    ).toBe(false)
  })

  it('refuse une instruction vide ou blanche', () => {
    expect(exerciseInputSchema.safeParse(withOverride({ instructions: ['   '] })).success).toBe(
      false,
    )
  })

  it('refuse un massage sans matériel ni notes', () => {
    const result = exerciseInputSchema.safeParse(
      withOverride({ type: 'massage', equipment: [] }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['equipment'])
  })

  it('accepte un massage sans matériel si notes le justifie', () => {
    const result = exerciseInputSchema.safeParse(
      withOverride({ type: 'massage', equipment: [], notes: 'Réalisable à la main.' }),
    )
    expect(result.success).toBe(true)
  })
})

describe('bankSchema', () => {
  it('accepte deux exercices de slugs distincts', () => {
    const result = bankSchema.safeParse([valid, { ...valid, slug: 'pigeon-pose' }])
    expect(result.success).toBe(true)
  })

  it('refuse un slug en doublon et pointe le second', () => {
    const result = bankSchema.safeParse([valid, valid])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([1, 'slug'])
  })

  it('refuse une banque vide', () => {
    expect(bankSchema.safeParse([]).success).toBe(false)
  })
})
