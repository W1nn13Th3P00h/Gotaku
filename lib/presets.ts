import type { ZoneCode } from '@/lib/referentials'

/**
 * Presets d'interface pour l'écran de génération (`docs/spec.md`, section
 * Générateur). De simples raccourcis de saisie, pas des entités en base : à cet
 * unique endroit, jamais dans `lib/generator/` qui ignore tout de l'interface.
 */

export const DURATION_PRESETS_MIN = [5, 10, 15, 20, 30, 45] as const

/**
 * Entrée d'une tuile de séance programmée, forme commune aux trois catégories
 * (Sports, Zones de mobilité, Mood) affichées dans
 * `app/generateur/generator-screen.tsx`. Tapper une tuile pré-remplit la
 * sélection de zones du formulaire libre, ni plus ni moins.
 */
export type ProgrammedSessionEntry = { id: string; label: string; zones: ZoneCode[] }

/**
 * Catégorie « Mood » des séances programmées : mécanisme inchangé, réduit à ces
 * deux entrées (issues #17/#21). Les autres presets d'origine sont soit
 * absorbés par la catégorie « Zones de mobilité » (chaîne postérieure, cou et
 * épaules, hanches et bassin), soit retirés sans remplacement (bas du corps,
 * haut du corps, bras et avant-bras).
 */
export const MOOD_PRESETS: ProgrammedSessionEntry[] = [
  {
    id: 'after_running',
    label: 'Après course à pied',
    zones: ['calves', 'shins', 'hamstrings', 'quads', 'it_bands', 'hip_flexors', 'glutes'],
  },
  {
    id: 'sedentary_day',
    label: 'Journée assise',
    zones: ['hip_flexors', 'glutes', 'lumbar', 'thoracic', 'neck', 'traps', 'pecs'],
  },
]
