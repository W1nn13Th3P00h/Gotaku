import { describe, expect, it } from 'vitest'

import { formatDurationShort } from '@/lib/format'

describe('formatDurationShort', () => {
  it('moins d’une minute : en secondes', () => {
    expect(formatDurationShort(45)).toBe('45 s')
  })

  it('minutes rondes : sans secondes', () => {
    expect(formatDurationShort(600)).toBe('10 min')
  })

  it('minutes et secondes', () => {
    expect(formatDurationShort(90)).toBe('1 min 30')
  })
})
