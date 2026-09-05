import { describe, expect, it } from 'vitest'

import { computeStreak } from '@/lib/stats/streak'

const NOW = new Date('2026-09-05T18:00:00')

function daysAgo(n: number): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return d
}

describe('computeStreak()', () => {
  it('aucune séance jamais : 0', () => {
    expect(computeStreak([], NOW)).toBe(0)
  })

  it('séance aujourd\'hui seulement : 1', () => {
    expect(computeStreak([daysAgo(0)], NOW)).toBe(1)
  })

  it('séance hier et aujourd\'hui : 2', () => {
    expect(computeStreak([daysAgo(1), daysAgo(0)], NOW)).toBe(2)
  })

  it('séance il y a 2 jours seulement (rien hier ni aujourd\'hui) : 0', () => {
    expect(computeStreak([daysAgo(2)], NOW)).toBe(0)
  })

  it('séance hier mais pas aujourd\'hui : 1 (streak pas encore cassé)', () => {
    expect(computeStreak([daysAgo(1)], NOW)).toBe(1)
  })

  it('série avec un trou au milieu : coupe au trou', () => {
    // Aujourd'hui, hier, puis un trou à J-2, puis une séance à J-3 : le streak
    // s'arrête au premier jour manquant (J-2), la séance de J-3 ne compte pas.
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(3)], NOW)).toBe(2)
  })

  it('doublons le même jour : comptés une fois', () => {
    expect(computeStreak([daysAgo(0), daysAgo(0), daysAgo(1)], NOW)).toBe(2)
  })

  it('ordre d\'entrée non trié : résultat identique', () => {
    const sorted = [daysAgo(0), daysAgo(1), daysAgo(2)]
    const shuffled = [daysAgo(2), daysAgo(0), daysAgo(1)]
    expect(computeStreak(shuffled, NOW)).toBe(computeStreak(sorted, NOW))
    expect(computeStreak(shuffled, NOW)).toBe(3)
  })
})
