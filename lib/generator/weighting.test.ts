import { describe, expect, it } from 'vitest'

import { ZONE_VOLUME_EPSILON_S } from '@/lib/generator/constants'
import { computeTargetShares } from '@/lib/generator/weighting'
import type { ZoneCode } from '@/lib/referentials'

/**
 * `computeTargetShares` : étape 3 de `docs/generator.md`, calcul de `targetShare`.
 * Priorité de région (issue #30) : voir la section « Calcul de targetShare, priorité
 * de région » du document.
 */

function sumShares(shares: Map<ZoneCode, number>, zones: ZoneCode[]): number {
  return zones.reduce((sum, z) => sum + (shares.get(z) ?? 0), 0)
}

describe('computeTargetShares', () => {
  it('sans priorityZones : parts égales entre toutes les zones, comportement inchangé', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes']
    const shares = computeTargetShares(zones, false, new Map())
    for (const z of zones) expect(shares.get(z)).toBeCloseTo(0.25)
  })

  it('priorityZones vide : identique à undefined, aucune régression', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes']
    const withUndefined = computeTargetShares(zones, false, new Map())
    const withEmpty = computeTargetShares(zones, false, new Map(), [])
    expect(withEmpty).toEqual(withUndefined)
  })

  it('priorityZones couvrant toutes les zones demandées : pas de groupe secondaire, comportement inchangé', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings']
    const shares = computeTargetShares(zones, false, new Map(), zones)
    expect(shares.get('calves')).toBeCloseTo(0.5)
    expect(shares.get('hamstrings')).toBeCloseTo(0.5)
  })

  it('une région prioritaire et une région secondaire : 50 % / 50 %, réparti également au sein de chaque groupe', () => {
    // Une zone prioritaire, trois zones secondaires.
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes']
    const shares = computeTargetShares(zones, false, new Map(), ['calves'])
    expect(shares.get('calves')).toBeCloseTo(0.5)
    expect(shares.get('hamstrings')).toBeCloseTo(0.5 / 3)
    expect(shares.get('quads')).toBeCloseTo(0.5 / 3)
    expect(shares.get('glutes')).toBeCloseTo(0.5 / 3)
    expect(sumShares(shares, zones)).toBeCloseTo(1)
  })

  it('deux zones prioritaires et deux secondaires : chaque groupe se partage sa moitié également', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes']
    const shares = computeTargetShares(zones, false, new Map(), ['calves', 'hamstrings'])
    expect(shares.get('calves')).toBeCloseTo(0.25)
    expect(shares.get('hamstrings')).toBeCloseTo(0.25)
    expect(shares.get('quads')).toBeCloseTo(0.25)
    expect(shares.get('glutes')).toBeCloseTo(0.25)
    expect(sumShares(shares, zones)).toBeCloseTo(1)
  })

  it('priorité + preferNeglectedZones : pondération par le volume normalisée au sein de chaque groupe, pas globalement', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads']
    // 'calves' priorité seule ; 'hamstrings' et 'quads' secondaires, volumes différents.
    const zoneVolume30d = new Map<ZoneCode, number>([
      ['hamstrings', 0],
      ['quads', 2 * ZONE_VOLUME_EPSILON_S],
    ])
    const shares = computeTargetShares(zones, true, zoneVolume30d, ['calves'])
    // Groupe prioritaire à une seule zone : reçoit toute l'enveloppe de 0.5.
    expect(shares.get('calves')).toBeCloseTo(0.5)
    // Groupe secondaire : poids 1/(volume + epsilon) ; 'hamstrings' (volume nul,
    // poids 1/epsilon) pondéré 3x plus que 'quads' (volume 2*epsilon, poids 1/(3*epsilon)).
    const hamstringsShare = shares.get('hamstrings') ?? 0
    const quadsShare = shares.get('quads') ?? 0
    expect(hamstringsShare).toBeCloseTo(quadsShare * 3)
    expect(hamstringsShare + quadsShare).toBeCloseTo(0.5)
    expect(sumShares(shares, zones)).toBeCloseTo(1)
  })

  it('zone de priorityZones absente de zones demandées : ignorée, retombe sur un groupe unique si plus aucune zone prioritaire effective', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings']
    // 'quads' n'est pas dans `zones` : aucune zone prioritaire effective.
    const shares = computeTargetShares(zones, false, new Map(), ['quads'])
    expect(shares.get('calves')).toBeCloseTo(0.5)
    expect(shares.get('hamstrings')).toBeCloseTo(0.5)
  })
})
