import type { ItemStatus, PlayerItem, PlayerState } from '@/lib/session-player/types'

/**
 * Machine à états pure du lecteur de séance. Aucune fonction n'accepte
 * `Date.now()` implicitement : `nowMs` est toujours un paramètre.
 * Voir `specs/002-session-execution-history/contracts/session-player.md`.
 *
 * `PlayerItem.status` ne porte qu'un seul statut par item, pas un par côté :
 * sur un exercice asymétrique, la phase droite ne pose jamais de statut à elle
 * seule (l'item reste `pending` pendant qu'elle se déroule) — seule la fin de
 * la phase gauche pose le statut final (`done` ou `skipped`), ce qui est aussi
 * le seul moment où le composant client doit écrire en base (voir la section
 * « Événements émis » du contrat).
 */

function phaseDurationMs(item: PlayerItem): number {
  return item.durationS * 1000
}

/** Temps total écoulé sur la phase courante, pause(s) comprise(s) mais pas leur durée. */
function elapsedMs(state: PlayerState, nowMs: number): number {
  if (state.phase === 'paused') return state.elapsedBeforePauseMs
  return nowMs - state.phaseStartedAtMs + state.elapsedBeforePauseMs
}

/** Temps restant de la phase courante, recalculé depuis l'horodatage de référence. */
export function remainingMs(state: PlayerState, nowMs: number): number {
  const item = state.items[state.currentIndex]
  if (item === undefined) return 0
  return phaseDurationMs(item) - elapsedMs(state, nowMs)
}

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

/**
 * Fin de la phase courante, déclenchée par le temps écoulé (`tick`) ou par
 * l'utilisateur (`skip`). Sur la première phase (droite) d'un exercice
 * asymétrique, bascule vers la seconde phase (gauche) sans poser de statut ni
 * avancer d'item (FR-008). Sinon, pose `resultingStatus` sur l'item courant et
 * avance vers l'item suivant, ou vers `phase: 'finished'` s'il n'y en a plus.
 */
function advance(state: PlayerState, nowMs: number, resultingStatus: ItemStatus): PlayerState {
  const item = state.items[state.currentIndex]
  if (item === undefined) return state

  if (item.perSide && state.currentSide === 'right') {
    return {
      ...state,
      phase: 'running',
      currentSide: 'left',
      phaseStartedAtMs: nowMs,
      elapsedBeforePauseMs: 0,
    }
  }

  const items = state.items.map((it, i) =>
    i === state.currentIndex ? { ...it, status: resultingStatus } : it,
  )
  const nextIndex = state.currentIndex + 1
  const nextItem = items[nextIndex]

  if (nextItem === undefined) {
    return finishedState(items)
  }

  return {
    ...state,
    items,
    phase: 'running',
    currentIndex: nextIndex,
    currentSide: nextItem.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
  }
}

/**
 * Ne change rien tant que le temps restant de la phase courante est positif.
 * Quand il atteint zéro, avance comme `advance(..., 'done')`. Sans effet hors
 * de `phase: 'running'`.
 */
export function tick(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'running') return state
  if (remainingMs(state, nowMs) > 0) return state
  return advance(state, nowMs, 'done')
}

/**
 * Marque l'item (ou sa phase courante, pour un exercice asymétrique) `skipped`
 * et avance immédiatement, comme `tick` à zéro mais déclenché par l'utilisateur.
 * Sans effet hors de `phase: 'running' | 'paused'`.
 */
export function skip(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'running' && state.phase !== 'paused') return state
  return advance(state, nowMs, 'skipped')
}

/** Fige le temps déjà écoulé de la phase courante. Sans effet si déjà en pause. */
export function pause(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'running') return state
  return {
    ...state,
    phase: 'paused',
    elapsedBeforePauseMs: elapsedMs(state, nowMs),
  }
}

/** Repart exactement du temps figé par `pause`. Sans effet si pas en pause. */
export function resume(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'paused') return state
  return {
    ...state,
    phase: 'running',
    phaseStartedAtMs: nowMs,
  }
}

/**
 * Recule d'une phase. Sur la seconde phase (gauche) d'un exercice asymétrique,
 * revient à sa première phase (droite), sans reculer d'item. Sinon, remet le
 * statut de l'item précédent à `pending` et recule `currentIndex`. Sans effet
 * sur le tout premier item, première phase (FR-006, edge case), ni hors de
 * `phase: 'running' | 'paused'`.
 */
export function back(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'running' && state.phase !== 'paused') return state

  if (state.currentSide === 'left') {
    return {
      ...state,
      phase: 'running',
      currentSide: 'right',
      phaseStartedAtMs: nowMs,
      elapsedBeforePauseMs: 0,
    }
  }

  if (state.currentIndex === 0) return state

  const prevIndex = state.currentIndex - 1
  const prevItem = state.items[prevIndex]
  if (prevItem === undefined) return state

  const items = state.items.map((it, i) =>
    i === prevIndex ? { ...it, status: 'pending' as const } : it,
  )

  return {
    ...state,
    items,
    phase: 'running',
    currentIndex: prevIndex,
    currentSide: prevItem.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
  }
}
