import { describe, expect, it } from 'vitest'

import { formatCountdown, formatDurationShort } from '@/lib/format'

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

describe('formatCountdown', () => {
  it('formate en m:ss, secondes complétées à gauche par un zéro', () => {
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(8)).toBe('0:08')
  })

  it('jamais négatif : plancher à 0:00', () => {
    expect(formatCountdown(-3)).toBe('0:00')
  })
})
