import { describe, expect, it } from 'vitest'

import { nextSubscriptionState } from './failures'

/**
 * Module pur, sans alias `@/` (voir `contracts/reminders-logic.md`) : import
 * relatif, comme depuis l'Edge Function Deno.
 */

describe('nextSubscriptionState', () => {
  it('un échec 404 supprime dès le premier échec', () => {
    expect(nextSubscriptionState(0, { kind: 'failure', httpStatus: 404 })).toEqual({
      action: 'delete',
    })
  })

  it('un échec 410 supprime dès le premier échec', () => {
    expect(nextSubscriptionState(0, { kind: 'failure', httpStatus: 410 })).toEqual({
      action: 'delete',
    })
  })

  it('un échec 404/410 supprime quel que soit le compteur courant', () => {
    expect(nextSubscriptionState(3, { kind: 'failure', httpStatus: 404 })).toEqual({
      action: 'delete',
    })
  })

  it('un échec quelconque au 4ᵉ échec consécutif (currentFailureCount = 4) atteint le seuil : delete', () => {
    expect(nextSubscriptionState(4, { kind: 'failure', httpStatus: 500 })).toEqual({
      action: 'delete',
    })
  })

  it('un échec quelconque au 3ᵉ échec consécutif (currentFailureCount = 3) incrémente', () => {
    expect(nextSubscriptionState(3, { kind: 'failure', httpStatus: 500 })).toEqual({
      action: 'increment',
    })
  })

  it('un échec quelconque à zéro échec incrémente', () => {
    expect(nextSubscriptionState(0, { kind: 'failure', httpStatus: 500 })).toEqual({
      action: 'increment',
    })
  })

  it('un succès donne toujours reset, y compris à zéro échec', () => {
    expect(nextSubscriptionState(0, { kind: 'success' })).toEqual({ action: 'reset' })
  })

  it('un succès donne reset même après plusieurs échecs', () => {
    expect(nextSubscriptionState(4, { kind: 'success' })).toEqual({ action: 'reset' })
  })
})
