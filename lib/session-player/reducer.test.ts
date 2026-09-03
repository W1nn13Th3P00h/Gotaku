import { describe, expect, it } from 'vitest'

import { back, init, pause, remainingMs, resume, skip, tick } from '@/lib/session-player/reducer'
import type { PlayerItem } from '@/lib/session-player/types'

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

describe('init', () => {
  it('une séance neuve (tous pending) démarre à l’index 0, en running', () => {
    const items = [
      item({ id: 'a', ord: 0 }),
      item({ id: 'b', ord: 1 }),
    ]
    const state = init(items, 1000)

    expect(state.phase).toBe('running')
    expect(state.currentIndex).toBe(0)
    expect(state.currentSide).toBeNull()
    expect(state.phaseStartedAtMs).toBe(1000)
    expect(state.elapsedBeforePauseMs).toBe(0)
  })

  it('une séance partiellement faite démarre au premier item pending', () => {
    const items = [
      item({ id: 'a', ord: 0, status: 'done' }),
      item({ id: 'b', ord: 1, status: 'skipped' }),
      item({ id: 'c', ord: 2, status: 'pending' }),
      item({ id: 'd', ord: 3, status: 'pending' }),
    ]
    const state = init(items, 5000)

    expect(state.phase).toBe('running')
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

  it('un item pending et perSide démarre côté droit', () => {
    const items = [item({ id: 'a', ord: 0, perSide: true, status: 'pending' })]
    const state = init(items, 100)

    expect(state.currentSide).toBe('right')
  })

  it('un catalogue vide retourne phase: finished', () => {
    const state = init([], 0)
    expect(state.phase).toBe('finished')
  })
})

describe('tick / pause / resume', () => {
  it('ne change rien tant que le temps restant de la phase courante est positif', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    const state = init(items, 0)
    const after = tick(state, 5000)

    expect(after.phase).toBe('running')
    expect(after.currentIndex).toBe(0)
    expect(remainingMs(after, 5000)).toBe(5000)
  })

  it('à zéro, marque l’item done et avance vers le suivant', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 10 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    const state = init(items, 0)
    const after = tick(state, 10_000)

    expect(after.items[0]?.status).toBe('done')
    expect(after.currentIndex).toBe(1)
    expect(after.phaseStartedAtMs).toBe(10_000)
    expect(after.elapsedBeforePauseMs).toBe(0)
  })

  it('le temps restant se recalcule depuis l’horodatage de référence, pas de dérive sur des ticks irréguliers', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = tick(state, 1000)
    state = tick(state, 3000)
    state = tick(state, 4500)

    expect(state.phase).toBe('running')
    expect(state.phaseStartedAtMs).toBe(0)
    expect(remainingMs(state, 4500)).toBe(5500)
  })

  it('pause fige le temps écoulé, resume repart exactement de ce point', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)

    state = pause(state, 4000)
    expect(state.phase).toBe('paused')
    expect(remainingMs(state, 4000)).toBe(6000)
    // Le temps qui passe pendant la pause ne compte pas.
    expect(remainingMs(state, 9000)).toBe(6000)

    state = resume(state, 9000)
    expect(state.phase).toBe('running')
    expect(remainingMs(state, 9000)).toBe(6000)
    expect(remainingMs(state, 14_000)).toBe(1000)

    state = tick(state, 15_000)
    expect(state.phase).toBe('finished')
  })

  it('pause sans effet si déjà en pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = pause(state, 4000)
    const again = pause(state, 6000)
    expect(again).toEqual(state)
  })

  it('resume sans effet si pas en pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    const state = init(items, 0)
    const again = resume(state, 6000)
    expect(again).toEqual(state)
  })

  it('tick sans effet pendant une pause', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 10 })]
    let state = init(items, 0)
    state = pause(state, 4000)
    const again = tick(state, 20_000)
    expect(again).toEqual(state)
  })
})

describe('skip / back', () => {
  it('skip marque l’item skipped et avance immédiatement', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    const state = init(items, 0)
    const after = skip(state, 1000)

    expect(after.items[0]?.status).toBe('skipped')
    expect(after.currentIndex).toBe(1)
    expect(after.phaseStartedAtMs).toBe(1000)
  })

  it('skip sur le dernier item termine la séance', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = skip(state, 1000)

    expect(after.items[0]?.status).toBe('skipped')
    expect(after.phase).toBe('finished')
  })

  it('back remet l’item précédent à pending et recule currentIndex', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = skip(state, 1000) // item a -> skipped, currentIndex 1
    state = back(state, 2000)

    expect(state.currentIndex).toBe(0)
    expect(state.items[0]?.status).toBe('pending')
    expect(state.phaseStartedAtMs).toBe(2000)
    expect(state.elapsedBeforePauseMs).toBe(0)
  })

  it('back sur le tout premier item est sans effet', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 30 })]
    const state = init(items, 0)
    const after = back(state, 5000)
    expect(after).toEqual(state)
  })

  it('back fonctionne aussi depuis une pause et relance la phase', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 30 }),
      item({ id: 'b', ord: 1, durationS: 20 }),
    ]
    let state = init(items, 0)
    state = skip(state, 1000)
    state = pause(state, 1500)
    state = back(state, 3000)

    expect(state.phase).toBe('running')
    expect(state.currentIndex).toBe(0)
  })
})

describe('exercice asymétrique et fin de séance', () => {
  it('la phase droite puis la phase gauche sont traitées comme deux exercices à part entière', () => {
    const items = [item({ id: 'a', ord: 0, durationS: 15, perSide: true })]
    let state = init(items, 0)
    expect(state.currentSide).toBe('right')

    state = tick(state, 15_000)
    expect(state.currentSide).toBe('left')
    expect(state.currentIndex).toBe(0)
    expect(state.items[0]?.status).toBe('pending')
    expect(state.phaseStartedAtMs).toBe(15_000)

    state = tick(state, 30_000)
    expect(state.items[0]?.status).toBe('done')
    expect(state.phase).toBe('finished')
  })

  it('skip sur la phase droite enchaîne sur la phase gauche, pas sur l’exercice suivant', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 15, perSide: true }),
      item({ id: 'b', ord: 1, durationS: 10 }),
    ]
    let state = init(items, 0)
    state = skip(state, 1000)

    expect(state.currentIndex).toBe(0)
    expect(state.currentSide).toBe('left')
    expect(state.items[0]?.status).toBe('pending')

    state = skip(state, 2000)
    expect(state.items[0]?.status).toBe('skipped')
    expect(state.currentIndex).toBe(1)
    expect(state.currentSide).toBeNull()
  })

  it('le dernier item traité (réalisé ou passé) fait passer phase à finished', () => {
    const items = [
      item({ id: 'a', ord: 0, durationS: 10 }),
      item({ id: 'b', ord: 1, durationS: 10, perSide: true }),
    ]
    let state = init(items, 0)
    state = tick(state, 10_000) // item a done
    state = skip(state, 11_000) // item b, côté droit -> côté gauche
    expect(state.phase).toBe('running')
    state = skip(state, 12_000) // item b, côté gauche -> fin
    expect(state.items[1]?.status).toBe('skipped')
    expect(state.phase).toBe('finished')
  })
})
