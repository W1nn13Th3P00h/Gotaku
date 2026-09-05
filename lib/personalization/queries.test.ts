import { describe, expect, it } from 'vitest'

import { resolvePersonalizedZones } from '@/lib/personalization/queries'
import type { MobilityFocusCode, PracticeCode, ZoneCode } from '@/lib/referentials'

describe('resolvePersonalizedZones', () => {
  const mobilityFocusZones: Record<MobilityFocusCode, ZoneCode[]> = {
    posterior_chain: ['calves', 'hamstrings', 'glutes', 'lumbar', 'lats'],
    shoulders: ['neck', 'shoulders', 'shoulder_rotators', 'traps', 'pecs'],
    overhead: ['shoulders', 'shoulder_rotators', 'lats', 'thoracic', 'triceps'],
    hips_pelvis: ['hip_flexors', 'hip_rotators', 'glutes', 'adductors'],
  }

  const practiceZones: Record<PracticeCode, ZoneCode[]> = {
    trail: ['calves', 'shins', 'post_shins', 'ankles', 'hamstrings', 'quads', 'it_bands', 'glutes', 'hip_flexors'],
    running: ['calves', 'shins', 'hamstrings', 'quads', 'it_bands', 'hip_flexors', 'glutes'],
    cycling: ['quads', 'hip_flexors', 'lumbar', 'neck', 'shoulders', 'hamstrings'],
    mtb: ['quads', 'hip_flexors', 'lumbar', 'neck', 'shoulders', 'forearm_flexors', 'forearm_extensors'],
    racquet_sports: [
      'shoulders',
      'shoulder_rotators',
      'pecs',
      'forearm_flexors',
      'forearm_extensors',
      'obliques',
      'hip_rotators',
    ],
    yoga: ['hip_flexors', 'hip_rotators', 'hamstrings', 'shoulders', 'thoracic', 'lumbar'],
    dance: ['hip_rotators', 'adductors', 'calves', 'ankles', 'thoracic', 'obliques'],
  }

  it('renvoie un tableau vide quand les deux réglages sont absents', () => {
    expect(
      resolvePersonalizedZones({
        majorDeficitFocus: null,
        mainPractice: null,
        mobilityFocusZones,
        practiceZones,
      }),
    ).toEqual([])
  })

  it("renvoie les zones du déficit majeur seul quand aucun sport n'est réglé", () => {
    const result = resolvePersonalizedZones({
      majorDeficitFocus: 'hips_pelvis',
      mainPractice: null,
      mobilityFocusZones,
      practiceZones,
    })
    expect([...result].sort()).toEqual([...mobilityFocusZones.hips_pelvis].sort())
  })

  it('renvoie les zones du sport principal seul quand aucun déficit majeur n\'est réglé', () => {
    const result = resolvePersonalizedZones({
      majorDeficitFocus: null,
      mainPractice: 'running',
      mobilityFocusZones,
      practiceZones,
    })
    expect([...result].sort()).toEqual([...practiceZones.running].sort())
  })

  it('fusionne les deux réglages sans doublon quand leurs zones se recoupent', () => {
    // hips_pelvis inclut 'glutes' et 'hip_flexors', running aussi : le recoupement
    // ne doit apparaître qu'une fois dans le résultat.
    const result = resolvePersonalizedZones({
      majorDeficitFocus: 'hips_pelvis',
      mainPractice: 'running',
      mobilityFocusZones,
      practiceZones,
    })

    const expected = new Set([...mobilityFocusZones.hips_pelvis, ...practiceZones.running])
    expect(result).toHaveLength(expected.size)
    expect(new Set(result)).toEqual(expected)
  })
})
