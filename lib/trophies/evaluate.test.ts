import { describe, expect, it } from 'vitest'

import { evaluateUnlockedTrophies } from '@/lib/trophies/evaluate'

describe('evaluateUnlockedTrophies', () => {
  it('ne débloque rien si aucun palier n\'est atteint', () => {
    const unlocked = evaluateUnlockedTrophies({
      streakDays: 0,
      regionSessionCounts: {},
      totalVolumeS: 0,
    })

    expect(unlocked).toEqual([])
  })

  it('débloque un palier streak atteint pile à la valeur seuil, pas le suivant', () => {
    const unlocked = evaluateUnlockedTrophies({
      streakDays: 7,
      regionSessionCounts: {},
      totalVolumeS: 0,
    })

    expect(unlocked).toContain('streak_7')
    expect(unlocked).not.toContain('streak_30')
  })

  it('débloque plusieurs paliers de volume franchis d\'un coup, pas au-delà', () => {
    const unlocked = evaluateUnlockedTrophies({
      streakDays: 0,
      regionSessionCounts: {},
      totalVolumeS: 350 * 3600, // 350h : franchit 100/200/300 d'un coup
    })

    expect(unlocked).toContain('volume_100')
    expect(unlocked).toContain('volume_200')
    expect(unlocked).toContain('volume_300')
    expect(unlocked).not.toContain('volume_400')
  })

  it('une région à zéro séance ne débloque rien pour elle, sans empêcher les autres régions', () => {
    const unlocked = evaluateUnlockedTrophies({
      streakDays: 0,
      regionSessionCounts: { foot_ankle: 0, thigh: 10 },
      totalVolumeS: 0,
    })

    expect(unlocked.some((key) => key.startsWith('region_foot_ankle_'))).toBe(false)
    expect(unlocked).toContain('region_thigh_10')
    expect(unlocked).not.toContain('region_thigh_50')
  })

  it('un palier région absent de regionSessionCounts est traité comme zéro', () => {
    const unlocked = evaluateUnlockedTrophies({
      streakDays: 0,
      regionSessionCounts: {},
      totalVolumeS: 0,
    })

    expect(unlocked.some((key) => key.startsWith('region_'))).toBe(false)
  })
})
