import { describe, expect, it } from 'vitest'

import { init } from '@/lib/session-player/reducer'
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
