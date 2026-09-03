import { describe, expect, it } from 'vitest'

import { suggestRecovery } from '@/lib/generator/failure-actions'
import type { FailureDetail, GeneratorInput } from '@/lib/generator/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * Contrat : `contracts/failure-actions.md`. `suggestRecovery` est une fonction pure,
 * testée ici sans catalogue réel ni React.
 */

const DURATION_PRESETS_MIN = [5, 10, 15, 20, 30, 45] as const

const baseInput: GeneratorInput = {
  targetDurationS: 600,
  zones: ['calves', 'hamstrings', 'quads', 'glutes', 'abs', 'lumbar', 'shoulders', 'neck'],
  equipment: ['band'],
}

describe('suggestRecovery', () => {
  it('ZONES_UNSERVABLE : retire les zones non couvrables', () => {
    const dropped: ZoneCode[] = ['shoulders', 'neck']
    const detail: FailureDetail = { reason: 'ZONES_UNSERVABLE', servableCount: 6, droppedZones: dropped }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).not.toBeNull()
    expect(result?.zones).toEqual(['calves', 'hamstrings', 'quads', 'glutes', 'abs', 'lumbar'])
    // le reste de l'input n'est pas altéré
    expect(result?.targetDurationS).toBe(baseInput.targetDurationS)
    expect(result?.equipment).toEqual(baseInput.equipment)
  })

  it('ZONES_UNSERVABLE : ne modifie jamais current en place', () => {
    const dropped: ZoneCode[] = ['neck']
    const detail: FailureDetail = { reason: 'ZONES_UNSERVABLE', servableCount: 7, droppedZones: dropped }
    const before = [...baseInput.zones]
    suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(baseInput.zones).toEqual(before)
  })

  it('ZONES_UNSERVABLE : retourne null si toutes les zones seraient retirées', () => {
    const input: GeneratorInput = { ...baseInput, zones: ['calves', 'hamstrings'] }
    const detail: FailureDetail = {
      reason: 'ZONES_UNSERVABLE',
      servableCount: 0,
      droppedZones: ['calves', 'hamstrings'],
    }
    const result = suggestRecovery(detail, input, DURATION_PRESETS_MIN)
    expect(result).toBeNull()
  })

  it('BUDGET_TOO_SMALL : retient le premier preset de durée >= la durée minimale viable', () => {
    // 400s -> le premier preset (en secondes) >= 400 est 10min = 600s
    const detail: FailureDetail = { reason: 'BUDGET_TOO_SMALL', minViableDurationS: 400 }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).not.toBeNull()
    expect(result?.targetDurationS).toBe(600)
  })

  it('BUDGET_TOO_SMALL : retient le plus grand preset si aucun ne l\'atteint', () => {
    // 45min = 2700s est le plus grand preset ; une durée minimale viable plus grande
    // qu'aucun preset ne couvre doit tout de même proposer ce plus grand preset.
    const detail: FailureDetail = { reason: 'BUDGET_TOO_SMALL', minViableDurationS: 10_000 }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).not.toBeNull()
    expect(result?.targetDurationS).toBe(45 * 60)
  })

  it("EMPTY_CATALOG cause 'equipment' vide le matériel", () => {
    const detail: FailureDetail = {
      reason: 'EMPTY_CATALOG',
      dominantCause: 'equipment',
      message: 'Aucun exercice ne correspond au matériel choisi.',
    }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).not.toBeNull()
    expect(result?.equipment).toEqual([])
    expect(result?.zones).toEqual(baseInput.zones)
  })

  it("EMPTY_CATALOG cause 'both' vide le matériel", () => {
    const detail: FailureDetail = {
      reason: 'EMPTY_CATALOG',
      dominantCause: 'both',
      message: 'Aucun exercice ne correspond au matériel et aux zones choisis.',
    }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).not.toBeNull()
    expect(result?.equipment).toEqual([])
  })

  it("EMPTY_CATALOG cause 'zones' retourne null", () => {
    const detail: FailureDetail = {
      reason: 'EMPTY_CATALOG',
      dominantCause: 'zones',
      message: 'Aucun exercice ne correspond aux zones choisies.',
    }
    const result = suggestRecovery(detail, baseInput, DURATION_PRESETS_MIN)
    expect(result).toBeNull()
  })
})
