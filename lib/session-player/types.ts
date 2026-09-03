/**
 * Module pur : aucune dépendance à React, Supabase, `Date.now()` ou `Math.random()`.
 * Tout instant est injecté par l'appelant (`nowMs`), sur le modèle de `lib/generator/`.
 * Voir `specs/002-session-execution-history/contracts/session-player.md`.
 */

export type PlayerPhase = 'idle' | 'running' | 'paused' | 'finished'

export type ItemStatus = 'pending' | 'done' | 'skipped'

/** Miroir de `session_items`, statut inclus. */
export type PlayerItem = {
  id: string
  exerciseId: string
  ord: number
  durationS: number
  perSide: boolean
  status: ItemStatus
}

export type PlayerSide = 'right' | 'left'

export type PlayerState = {
  phase: PlayerPhase
  items: PlayerItem[]
  currentIndex: number
  /** Côté en cours pour l'item courant s'il est `perSide`, `null` sinon. */
  currentSide: PlayerSide | null
  /** Horodatage (injecté) de début de la phase courante. */
  phaseStartedAtMs: number
  /** Temps déjà écoulé sur la phase courante avant une pause éventuelle. */
  elapsedBeforePauseMs: number
}
