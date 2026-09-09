import { describe, expect, it } from 'vitest'

import { capToRegions, type ZoneCode } from '@/lib/referentials'

/**
 * `capToRegions` : garde-fou de `MAX_REGIONS` pour toute source qui remplace
 * `zones` en bloc (présélection au montage, séance programmée), en dehors du
 * clic région par région de `app/generateur/generator-screen.tsx` qui applique
 * déjà sa propre limite.
 */
describe('capToRegions', () => {
  it('ne modifie rien quand la sélection couvre déjà au plus `max` régions', () => {
    // 'calves' et 'shins' -> 'lower_leg', 'hamstrings' -> 'thigh' : 2 régions.
    const zones: ZoneCode[] = ['calves', 'shins', 'hamstrings']
    expect(capToRegions(zones, 3)).toEqual(zones)
  })

  it('tronque aux 3 premières régions distinctes, dans leur ordre d’apparition', () => {
    // Régions dans l'ordre d'apparition : lower_leg (calves), thigh (hamstrings,
    // quads), hip (glutes), core (abs). 4 régions, `abs` doit disparaître.
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'quads', 'glutes', 'abs']
    expect(capToRegions(zones, 3)).toEqual(['calves', 'hamstrings', 'quads', 'glutes'])
  })

  it('préserve l’ordre des zones conservées, y compris quand une région revient plus tard', () => {
    // 'shins' (lower_leg) réapparaît après 'hamstrings' (thigh) et 'abs' (core) :
    // avec max=2, seules lower_leg et thigh sont retenues, 'abs' est retirée.
    const zones: ZoneCode[] = ['calves', 'hamstrings', 'abs', 'shins']
    expect(capToRegions(zones, 2)).toEqual(['calves', 'hamstrings', 'shins'])
  })

  it('tableau vide : renvoie un tableau vide', () => {
    expect(capToRegions([], 3)).toEqual([])
  })

  it('max supérieur au nombre de régions présentes : aucune troncature', () => {
    const zones: ZoneCode[] = ['calves', 'hamstrings']
    expect(capToRegions(zones, 10)).toEqual(zones)
  })
})
