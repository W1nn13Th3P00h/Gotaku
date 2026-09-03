import { describe, expect, it } from 'vitest'

import { clampDurationS, computeTotalDurationS } from '@/lib/sessions/composition'

describe('computeTotalDurationS', () => {
  it('additionne les durées des exercices symétriques', () => {
    const total = computeTotalDurationS([
      { durationS: 30, perSide: false },
      { durationS: 45, perSide: false },
    ])
    expect(total).toBe(75)
  })

  it('compte double la durée des exercices asymétriques (perSide)', () => {
    const total = computeTotalDurationS([
      { durationS: 30, perSide: false },
      { durationS: 20, perSide: true },
    ])
    // 30 (symétrique) + 20 * 2 (un côté puis l'autre)
    expect(total).toBe(70)
  })

  it('renvoie zéro pour une composition vide', () => {
    expect(computeTotalDurationS([])).toBe(0)
  })
})

describe('clampDurationS', () => {
  const exercise = { durationMinS: 20, durationMaxS: 60 }

  it('conserve une valeur déjà dans la plage', () => {
    expect(clampDurationS(exercise, 40)).toBe(40)
  })

  it('ramène à la borne basse une valeur sous la plage', () => {
    expect(clampDurationS(exercise, 5)).toBe(20)
  })

  it('ramène à la borne haute une valeur au-dessus de la plage', () => {
    expect(clampDurationS(exercise, 200)).toBe(60)
  })

  it('ramène à la borne basse une valeur négative', () => {
    expect(clampDurationS(exercise, -10)).toBe(20)
  })

  it('arrondit une valeur non entière avant de la clamper', () => {
    expect(clampDurationS(exercise, 40.6)).toBe(41)
    expect(clampDurationS(exercise, 19.4)).toBe(20)
  })
})
