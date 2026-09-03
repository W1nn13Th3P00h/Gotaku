import type { ZoneCode } from '@/lib/referentials'

/**
 * Presets d'interface pour l'écran de génération (`docs/spec.md`, section
 * Générateur). De simples raccourcis de saisie, pas des entités en base : à cet
 * unique endroit, jamais dans `lib/generator/` qui ignore tout de l'interface.
 */

export const DURATION_PRESETS_MIN = [5, 10, 15, 20, 30, 45] as const

export type ZonePreset = { label: string; zones: ZoneCode[] }

export const ZONE_PRESETS: ZonePreset[] = [
  {
    label: 'Bas du corps',
    zones: [
      'feet',
      'ankles',
      'calves',
      'shins',
      'post_shins',
      'hamstrings',
      'quads',
      'adductors',
      'it_bands',
      'glutes',
      'hip_flexors',
      'hip_rotators',
    ],
  },
  {
    label: 'Haut du corps',
    zones: [
      'neck',
      'shoulders',
      'shoulder_rotators',
      'pecs',
      'biceps',
      'triceps',
      'forearm_flexors',
      'forearm_extensors',
      'traps',
      'lats',
    ],
  },
  {
    label: 'Chaîne postérieure',
    zones: ['calves', 'hamstrings', 'glutes', 'lumbar', 'lats'],
  },
  {
    label: 'Après course à pied',
    zones: ['calves', 'shins', 'hamstrings', 'quads', 'it_bands', 'hip_flexors', 'glutes'],
  },
  {
    label: 'Journée assise',
    zones: ['hip_flexors', 'glutes', 'lumbar', 'thoracic', 'neck', 'traps', 'pecs'],
  },
]
