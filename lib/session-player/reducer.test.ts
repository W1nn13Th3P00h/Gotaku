import { describe, expect, it } from 'vitest'

import { PREP_DURATION_S, back, init, pause, remainingMs, resume, skip, tick } from '@/lib/session-player/reducer'
import type { PlayerItem, PlayerState } from '@/lib/session-player/types'

/**
 * Machine à états pure : tous les scénarios sont vérifiés avec des horodatages
 * injectés, jamais avec un timer réel. Voir
 * `specs/002-session-execution-history/contracts/session-player.md`.
 */

function item(overrides: Partial<PlayerItem> = {}): PlayerItem {
  return {
    id: 'item-1',
    exerciseId: 'ex-1',
    ord: 0,
    durationS: 30,
    perSide: false,
    status: 'pending',
    ...overrides,
  }
}

/** Fait passer une phase `'prep'` à `'running'` par écoulement naturel du temps (via `tick`). */
function toRunning(state: PlayerState): PlayerState {
  return tick(state, state.phaseStartedAtMs + PREP_DURATION_S * 1000)
}

describe('init', () => {
  it('une séance neuve (tous pending) démarre à l’index 0, en préparation', () => {
    const items = [
      item({ id: 'a', ord: 0 }),
      item({ id: 'b', ord: 1 }),
    ]
    const state = init(items, 1000)

    expect(state.phase).toBe('prep')
    expect(state.currentIndex).toBe(0)
    expect(state.currentSide).toBeNull()
    expect(state.phaseStartedAtMs).toBe(1000)
    expect(state.elapsedBeforePauseMs).toBe(0)
    expect(state.pausedPhase).toBeNull()
  })

  it('une séance partiellement faite démarre au premier item pending, en préparation', () => {
    const items = [
      item({ id: 'a', ord: 0, status: 'done' }),
      item({ id: 'b', ord: 1, status: 'skipped' }),
      item({ id: 'c', ord: 2, status: 'pending' }),
      item({ id: 'd', ord: 3, status: 'pending' }),
    ]
    const state = init(items, 5000)

    expect(state.phase).toBe('prep')
    expect(state.currentIndex).toBe(2)
    expect(state.phaseStartedAtMs).toBe(5000)
  })

  it('une séance entièrement done/skipped retourne phase: finished', () => {
    const items = [
      item({ id: 'a', ord: 0, status: 'done' }),
      item({ id: 'b', ord: 1, status: 'skipped' }),
    ]
    const state = init(items, 2000)

    expect(state.phase).toBe('finished')
  })

  it('un item pending et perSide démarre côté droit, en préparation', () => {
    const items = [item({ id: 'a', ord: 0, perSide: true, status: 'pending' })]
    const state = init(items, 100)

    expect(state.phase).toBe('prep')
    expect(state.currentSide).toBe('right')
  })

  it('un catalogue vide retourne phase: finished', () => {
    const state = init([], 0)
    expect(state.phase).toBe('finished')
  })
})

describe('phase de préparation', () => {
  it('ne change rien tant que le temps de préparation n’est pas écoulé', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = tick(state, PREP_DURATION_S * 1000 - 1)

    expect(after.phase).toBe('prep')
    expect(remainingMs(after, PREP_DURATION_S * 1000 - 1)).toBe(1)
  })

  it('à zéro, bascule automatiquement vers running sur le même item/côté, sans statut ni avancée d’index', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = toRunning(state)

    expect(after.phase).toBe('running')
    expect(after.currentIndex).toBe(0)
    expect(after.items[0]?.status).toBe('pending')
    expect(after.phaseStartedAtMs).toBe(PREP_DURATION_S * 1000)
    expect(after.elapsedBeforePauseMs).toBe(0)
  })

  it('la durée de la phase de préparation est fixe, indépendante de la durée de l’item', () => {
    const short = init([item({ id: 'a', ord: 0, durationS: 5 })], 0)
    const long = init([item({ id: 'b', ord: 0, durationS: 300 })], 0)

    expect(remainingMs(short, 0)).toBe(PREP_DURATION_S * 1000)
    expect(remainingMs(long, 0)).toBe(PREP_DURATION_S * 1000)
  })

  it('skip pendant la préparation saute la préparation, reste sur le même item/côté, sans statut', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = skip(state, 1000)

    expect(after.phase).toBe('running')
    expect(after.currentIndex).toBe(0)
    expect(after.items[0]?.status).toBe('pending')
    expect(after.phaseStartedAtMs).toBe(1000)
  })

  it('pause pendant la préparation mémorise pausedPhase: prep, resume y repart exactement', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    let state = init(items, 0)

    state = pause(state, 4000)
    expect(state.phase).toBe('paused')
    expect(state.pausedPhase).toBe('prep')
    expect(remainingMs(state, 4000)).toBe(PREP_DURATION_S * 1000 - 4000)

    state = resume(state, 9000)
    expect(state.phase).toBe('prep')
    expect(state.pausedPhase).toBeNull()
    expect(remainingMs(state, 9000)).toBe(PREP_DURATION_S * 1000 - 4000)
  })

  it('skip pendant une pause dont la phase mémorisée est prep bascule directement en running', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    let state = init(items, 0)
    state = pause(state, 2000)
    expect(state.pausedPhase).toBe('prep')

    state = skip(state, 5000)
    expect(state.phase).toBe('running')
    expect(state.pausedPhase).toBeNull()
    expect(state.items[0]?.status).toBe('pending')
  })
})

describe('tick / pause / resume (phase running)', () => {
  it('ne change rien tant que le temps restant de la phase courante est positif', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state) // phaseStartedAtMs = 10_000
    const after = tick(state, 15_000)

    expect(after.phase).toBe('running')
    expect(after.currentIndex).toBe(0)
    expect(remainingMs(after, 15_000)).toBe(5000)
  })

  it('à zéro, marque l’item done et avance vers la préparation du suivant', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 10 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = toRunning(state) // phaseStartedAtMs = 10_000
    const after = tick(state, 20_000)

    expect(after.items[0]?.status).toBe('done')
    expect(after.phase).toBe('prep')
    expect(after.currentIndex).toBe(1)
    expect(after.phaseStartedAtMs).toBe(20_000)
    expect(after.elapsedBeforePauseMs).toBe(0)
  })

  it('le temps restant se recalcule depuis l’horodatage de référence, pas de dérive sur des ticks irréguliers', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state) // phaseStartedAtMs = 10_000
    state = tick(state, 11_000)
    state = tick(state, 13_000)
    state = tick(state, 14_500)

    expect(state.phase).toBe('running')
    expect(state.phaseStartedAtMs).toBe(10_000)
    expect(remainingMs(state, 14_500)).toBe(5500)
  })

  it('pause fige le temps écoulé, resume repart exactement de ce point', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state) // phaseStartedAtMs = 10_000

    state = pause(state, 14_000)
    expect(state.phase).toBe('paused')
    expect(state.pausedPhase).toBe('running')
    expect(remainingMs(state, 14_000)).toBe(6000)
    // Le temps qui passe pendant la pause ne compte pas.
    expect(remainingMs(state, 19_000)).toBe(6000)

    state = resume(state, 19_000)
    expect(state.phase).toBe('running')
    expect(remainingMs(state, 19_000)).toBe(6000)
    expect(remainingMs(state, 24_000)).toBe(1000)

    state = tick(state, 25_000)
    expect(state.phase).toBe('finished')
  })

  it('pause sans effet si déjà en pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state)
    state = pause(state, 14_000)
    const again = pause(state, 16_000)
    expect(again).toEqual(state)
  })

  it('resume sans effet si pas en pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state)
    const again = resume(state, 16_000)
    expect(again).toEqual(state)
  })

  it('tick sans effet pendant une pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = toRunning(state)
    state = pause(state, 14_000)
    const again = tick(state, 30_000)
    expect(again).toEqual(state)
  })
})

describe('skip / back', () => {
  it('skip marque l’item skipped et avance immédiatement vers la préparation du suivant', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = toRunning(state) // phaseStartedAtMs = 10_000
    const after = skip(state, 11_000)

    expect(after.items[0]?.status).toBe('skipped')
    expect(after.phase).toBe('prep')
    expect(after.currentIndex).toBe(1)
    expect(after.phaseStartedAtMs).toBe(11_000)
  })

  it('skip sur le dernier item (running) termine la séance', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    let state = init(items, 0)
    state = toRunning(state)
    const after = skip(state, 11_000)

    expect(after.items[0]?.status).toBe('skipped')
    expect(after.phase).toBe('finished')
  })

  it('back remet l’item précédent à pending, recule currentIndex et atterrit en préparation', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = toRunning(state) // running item a
    state = skip(state, 11_000) // item a -> skipped, prep item b
    state = back(state, 12_000)

    expect(state.phase).toBe('prep')
    expect(state.currentIndex).toBe(0)
    expect(state.items[0]?.status).toBe('pending')
    expect(state.phaseStartedAtMs).toBe(12_000)
    expect(state.elapsedBeforePauseMs).toBe(0)
  })

  it('back sur le tout premier item, en préparation, est sans effet', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = back(state, 5000)
    expect(after).toEqual(state)
  })

  it('back sur le tout premier item, en running, est sans effet', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    let state = init(items, 0)
    state = toRunning(state)
    const after = back(state, 15_000)
    expect(after).toEqual(state)
  })

  it('back fonctionne aussi depuis une pause et relance en préparation', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = toRunning(state)
    state = skip(state, 11_000) // prep item b
    state = pause(state, 11_500)
    state = back(state, 13_000)

    expect(state.phase).toBe('prep')
    expect(state.pausedPhase).toBeNull()
    expect(state.currentIndex).toBe(0)
  })
})

describe('exercice asymétrique et fin de séance', () => {
  it('chaque côté a sa propre préparation puis son propre décompte, comme deux exercices à part entière', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 15, perSide: true })]
    let state = init(items, 0)
    expect(state.phase).toBe('prep')
    expect(state.currentSide).toBe('right')

    state = toRunning(state) // running, côté droit
    expect(state.currentSide).toBe('right')

    state = tick(state, state.phaseStartedAtMs + 15_000)
    expect(state.phase).toBe('prep')
    expect(state.currentSide).toBe('left')
    expect(state.currentIndex).toBe(0)
    expect(state.items[0]?.status).toBe('pending')

    state = toRunning(state) // running, côté gauche
    state = tick(state, state.phaseStartedAtMs + 15_000)
    expect(state.items[0]?.status).toBe('done')
    expect(state.phase).toBe('finished')
  })

  it('skip pendant le running d’un côté enchaîne sur la préparation de l’autre côté, pas sur l’exercice suivant', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 15, perSide: true }),
      item({ id: 'b', ord: 1, durationS: 10 }),
    ]
    let state = init(items, 0)
    state = toRunning(state) // running, côté droit, phaseStartedAtMs = 10_000
    state = skip(state, 11_000)

    expect(state.phase).toBe('prep')
    expect(state.currentIndex).toBe(0)
    expect(state.currentSide).toBe('left')
    expect(state.items[0]?.status).toBe('pending')

    // Skip pendant cette préparation ne saute que la préparation, pas le côté gauche lui-même.
    state = skip(state, 12_000)
    expect(state.phase).toBe('running')
    expect(state.currentSide).toBe('left')
    expect(state.items[0]?.status).toBe('pending')

    state = skip(state, 13_000)
    expect(state.items[0]?.status).toBe('skipped')
    expect(state.phase).toBe('prep')
    expect(state.currentIndex).toBe(1)
    expect(state.currentSide).toBeNull()
  })

  it('le dernier item traité (réalisé ou passé) fait passer phase à finished', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 10 }),
      item({ id: 'b', ord: 1, durationS: 10, perSide: true }),
    ]
    let state = init(items, 0)
    state = toRunning(state) // running item a, phaseStartedAtMs = 10_000
    state = tick(state, 20_000) // item a done, prep item b côté droit
    expect(state.phase).toBe('prep')
    expect(state.items[0]?.status).toBe('done')

    state = toRunning(state) // running item b, côté droit
    state = skip(state, state.phaseStartedAtMs + 1000) // côté droit -> prep côté gauche
    expect(state.phase).toBe('prep')
    expect(state.currentSide).toBe('left')

    state = toRunning(state) // running item b, côté gauche
    state = skip(state, state.phaseStartedAtMs + 1000) // côté gauche -> fin
    expect(state.items[1]?.status).toBe('skipped')
    expect(state.phase).toBe('finished')
  })
})
