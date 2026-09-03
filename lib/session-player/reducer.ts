import type { PlayerItem, PlayerState } from '@/lib/session-player/types'

/**
 * Machine à états pure du lecteur de séance. Aucune fonction n'accepte
 * `Date.now()` implicitement : `nowMs` est toujours un paramètre.
 * Voir `specs/002-session-execution-history/contracts/session-player.md`.
 */

function finishedState(items: PlayerItem[]): PlayerState {
  return {
    phase: 'finished',
    items,
    currentIndex: items.length,
    currentSide: null,
    phaseStartedAtMs: 0,
    elapsedBeforePauseMs: 0,
  }
}

/**
 * Positionne `currentIndex` sur le premier item `pending` (reprise naturelle
 * d'une séance déjà partiellement faite). Si tous les items sont déjà
 * `done`/`skipped` (ou s'il n'y a aucun item), retourne `phase: 'finished'`.
 */
export function init(items: PlayerItem[], nowMs: number): PlayerState {
  const index = items.findIndex((item) => item.status === 'pending')
  if (index === -1) return finishedState(items)

  const current = items[index]
  if (current === undefined) return finishedState(items)

  return {
    phase: 'running',
    items,
    currentIndex: index,
    currentSide: current.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
  }
}
