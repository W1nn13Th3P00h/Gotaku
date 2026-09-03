/**
 * Fonctions pures de composition et de modèles (Lot 4). Comme
 * `lib/generator/` (Constitution Principe I), ce module ne connaît ni
 * Supabase ni `Date.now()`/`Math.random()` : tout ce dont il a besoin lui est
 * passé en argument. Voir `specs/003-manual-session-templates/contracts/composition.md`.
 */

export type DurationItem = {
  durationS: number
  perSide: boolean
}

/**
 * Durée totale d'une composition ou d'un modèle, chaque item comptant double
 * s'il est `perSide` (la durée stockée est celle d'un seul côté, CLAUDE.md).
 */
export function computeTotalDurationS(items: DurationItem[]): number {
  return items.reduce((total, item) => total + (item.perSide ? item.durationS * 2 : item.durationS), 0)
}

export type ExerciseDurationBounds = {
  durationMinS: number
  durationMaxS: number
}

/**
 * Ramène `requestedS` dans `[durationMinS, durationMaxS]` de l'exercice
 * concerné. Toute valeur non entière est arrondie avant clampage ; jamais de
 * valeur hors plage en sortie (FR-005/SC-004).
 */
export function clampDurationS(exercise: ExerciseDurationBounds, requestedS: number): number {
  const rounded = Math.round(requestedS)
  return Math.min(exercise.durationMaxS, Math.max(exercise.durationMinS, rounded))
}
