import type { BodyPosition, ExerciseType } from '@/lib/referentials'

/** Constantes de `docs/generator.md`, à cet unique endroit. */

export const TRANSITION_S = 10
export const FRESHNESS_WINDOW_D = 14
export const FRESHNESS_FLOOR = 0.1
export const NEVER_DONE_BONUS = 1.2
export const NOISE_MIN = 0.85
export const NOISE_MAX = 1.15
export const ZONE_NEED_FLOOR = 0.05
export const TOLERANCE_S = 15

/**
 * Ajoutée au volume 30 jours avant inversion (`preferNeglectedZones`), pour qu'une
 * zone jamais travaillée (volume nul) obtienne un poids élevé mais fini plutôt
 * qu'une division par zéro. Choix validé le 2026-09-02.
 */
export const ZONE_VOLUME_EPSILON_S = 60

/** Ouverture au massage, clôture à l'activation : séance qui précède un entraînement. */
export const TYPE_ORDER: readonly ExerciseType[] = [
  'massage',
  'active_stretch',
  'passive_stretch',
  'muscle_activation',
]

export const POSITION_ORDER: readonly BodyPosition[] = [
  'standing',
  'wall',
  'hanging',
  'seated',
  'quadruped',
  'side_lying',
  'supine',
  'prone',
]
