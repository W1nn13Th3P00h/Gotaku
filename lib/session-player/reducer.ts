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
 *
 * Chaque item (et chaque côté d'un exercice asymétrique) commence par une
 * phase `'prep'` de `PREP_DURATION_S` secondes, avant sa phase `'running'` :
 * temps de lecture des instructions sans mettre en pause. Cette durée n'est
 * jamais stockée en base, elle ne fait pas partie de `session_items`.
 */

/** Durée fixe de la phase de préparation précédant chaque item/côté. */
export const PREP_DURATION_S = 10

/** Phase courante, résolue vers `pausedPhase` si l'état est `'paused'`. */
function effectivePhase(state: PlayerState): PlayerState['phase'] {
  return state.phase === 'paused' ? (state.pausedPhase ?? 'running') : state.phase
}

function phaseDurationMs(state: PlayerState, item: PlayerItem): number {
  return effectivePhase(state) === 'prep' ? PREP_DURATION_S * 1000 : item.durationS * 1000
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
  return phaseDurationMs(state, item) - elapsedMs(state, nowMs)
}

function finishedState(items: PlayerItem[]): PlayerState {
  return {
    phase: 'finished',
    items,
    currentIndex: items.length,
    currentSide: null,
    phaseStartedAtMs: 0,
    elapsedBeforePauseMs: 0,
    pausedPhase: null,
  }
}

/**
 * Positionne `currentIndex` sur le premier item `pending` (reprise naturelle
 * d'une séance déjà partiellement faite). Si tous les items sont déjà
 * `done`/`skipped` (ou s'il n'y a aucun item), retourne `phase: 'finished'`.
 * Sinon, démarre en `phase: 'prep'` : le tout premier exercice de la séance a
 * lui aussi sa préparation.
 */
export function init(items: PlayerItem[], nowMs: number): PlayerState {
  const index = items.findIndex((item) => item.status === 'pending')
  if (index === -1) return finishedState(items)

  const current = items[index]
  if (current === undefined) return finishedState(items)

  return {
    phase: 'prep',
    items,
    currentIndex: index,
    currentSide: current.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
    pausedPhase: null,
  }
}

/**
 * Fin de la phase `'running'` courante, déclenchée par le temps écoulé
 * (`tick`) ou par l'utilisateur (`skip`). Sur la première phase (droite) d'un
 * exercice asymétrique, bascule vers la préparation de la seconde phase
 * (gauche) sans poser de statut ni avancer d'item (FR-008). Sinon, pose
 * `resultingStatus` sur l'item courant et avance vers la préparation de
 * l'item suivant, ou vers `phase: 'finished'` s'il n'y en a plus.
 */
function advance(state: PlayerState, nowMs: number, resultingStatus: ItemStatus): PlayerState {
  const item = state.items[state.currentIndex]
  if (item === undefined) return state

  if (item.perSide && state.currentSide === 'right') {
    return {
      ...state,
      phase: 'prep',
      currentSide: 'left',
      phaseStartedAtMs: nowMs,
      elapsedBeforePauseMs: 0,
      pausedPhase: null,
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
    phase: 'prep',
    currentIndex: nextIndex,
    currentSide: nextItem.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
    pausedPhase: null,
  }
}

/** Bascule de `'prep'` vers `'running'`, même item, même côté, sans statut ni avancée d'index. */
function startRunning(state: PlayerState, nowMs: number): PlayerState {
  return {
    ...state,
    phase: 'running',
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
    pausedPhase: null,
  }
}

/**
 * Ne change rien tant que le temps restant de la phase courante est positif.
 * En `'prep'`, à zéro : bascule vers `'running'` sur le même item/côté. En
 * `'running'`, à zéro : avance comme `advance(..., 'done')`. Sans effet hors
 * de `phase: 'prep' | 'running'`.
 */
export function tick(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'prep' && state.phase !== 'running') return state
  if (remainingMs(state, nowMs) > 0) return state
  return state.phase === 'prep' ? startRunning(state, nowMs) : advance(state, nowMs, 'done')
}

/**
 * En phase effective `'prep'` : saute la préparation, bascule vers `'running'`
 * sur le même item/côté, sans poser de statut. En phase effective `'running'` :
 * marque l'item (ou sa phase courante, pour un exercice asymétrique) `skipped`
 * et avance immédiatement, comme `tick` à zéro mais déclenché par
 * l'utilisateur. Sans effet hors de `phase: 'prep' | 'running' | 'paused'`.
 */
export function skip(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'prep' && state.phase !== 'running' && state.phase !== 'paused') return state
  return effectivePhase(state) === 'prep' ? startRunning(state, nowMs) : advance(state, nowMs, 'skipped')
}

/** Fige le temps déjà écoulé de la phase courante. Sans effet si déjà en pause. */
export function pause(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'prep' && state.phase !== 'running') return state
  return {
    ...state,
    phase: 'paused',
    pausedPhase: state.phase,
    elapsedBeforePauseMs: elapsedMs(state, nowMs),
  }
}

/** Repart exactement du temps figé par `pause`, dans la phase mémorisée. Sans effet si pas en pause. */
export function resume(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'paused') return state
  return {
    ...state,
    phase: state.pausedPhase ?? 'running',
    pausedPhase: null,
    phaseStartedAtMs: nowMs,
  }
}

/**
 * Recule d'une phase, et atterrit toujours en `phase: 'prep'` (chaque
 * item/côté commence toujours par sa préparation, y compris en cas de retour
 * arrière). Sur la seconde phase (gauche) d'un exercice asymétrique, revient
 * à la préparation de sa première phase (droite), sans reculer d'item. Sinon,
 * remet le statut de l'item précédent à `pending` et recule `currentIndex`.
 * Sans effet sur le tout premier item, première phase (FR-006, edge case), ni
 * hors de `phase: 'prep' | 'running' | 'paused'`.
 */
export function back(state: PlayerState, nowMs: number): PlayerState {
  if (state.phase !== 'prep' && state.phase !== 'running' && state.phase !== 'paused') return state

  if (state.currentSide === 'left') {
    return {
      ...state,
      phase: 'prep',
      currentSide: 'right',
      phaseStartedAtMs: nowMs,
      elapsedBeforePauseMs: 0,
      pausedPhase: null,
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
    phase: 'prep',
    currentIndex: prevIndex,
    currentSide: prevItem.perSide ? 'right' : null,
    phaseStartedAtMs: nowMs,
    elapsedBeforePauseMs: 0,
    pausedPhase: null,
  }
}
