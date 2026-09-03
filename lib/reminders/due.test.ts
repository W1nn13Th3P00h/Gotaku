import { describe, expect, it } from 'vitest'

import { selectDueReminders, type DueContext, type Reminder } from './due'

/**
 * Module pur, sans alias `@/` (voir `contracts/reminders-logic.md`) : import
 * relatif, comme depuis l'Edge Function Deno.
 */

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'reminder-1',
    userId: 'user-1',
    timeLocal: '07:30',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    timezone: 'UTC',
    active: true,
    ...overrides,
  }
}

function ctx(overrides: Partial<DueContext> = {}): DueContext {
  return {
    nowUtc: new Date('2026-09-03T07:30:00Z'), // jeudi (weekday 4), 07:30 UTC
    alreadySentReminderIds: new Set(),
    completedTodayUserIds: new Set(),
    ...overrides,
  }
}

describe('selectDueReminders', () => {
  it("retient un rappel dont l'heure et le jour, en UTC, correspondent au moment présent", () => {
    const result = selectDueReminders([reminder()], ctx())
    expect(result).toEqual([reminder()])
  })

  it("ne retient jamais un rappel inactif, quels que soient l'heure/le jour", () => {
    const result = selectDueReminders([reminder({ active: false })], ctx())
    expect(result).toEqual([])
  })

  it("ne retient jamais un rappel dont le jour local n'est pas dans weekdays, même si l'heure correspond", () => {
    // 2026-09-03 est un jeudi (weekday 4) : on ne demande que le mardi (2).
    const result = selectDueReminders([reminder({ weekdays: [2] })], ctx())
    expect(result).toEqual([])
  })

  it('utilise le jour local (pas UTC) pour un rappel proche du changement de jour', () => {
    // 2026-09-04T09:03:00Z est un vendredi en UTC, mais 2026-09-03 23:03 (jeudi,
    // weekday 4) à Honolulu (UTC-10) : voir la vérification Node/Intl en tête de
    // ce fichier de test dans le rapport d'implémentation.
    const honoluluReminder = reminder({
      timeLocal: '23:00',
      weekdays: [4], // jeudi seulement : rejeté si le code utilisait le jour UTC (vendredi)
      timezone: 'Pacific/Honolulu',
    })
    const result = selectDueReminders(
      [honoluluReminder],
      ctx({ nowUtc: new Date('2026-09-04T09:03:00Z') }),
    )
    expect(result).toEqual([honoluluReminder])
  })

  it('ne retient jamais un rappel déjà dans alreadySentReminderIds', () => {
    const result = selectDueReminders(
      [reminder()],
      ctx({ alreadySentReminderIds: new Set(['reminder-1']) }),
    )
    expect(result).toEqual([])
  })

  it("ne retient jamais un rappel dont l'utilisateur est dans completedTodayUserIds", () => {
    const result = selectDueReminders(
      [reminder()],
      ctx({ completedTodayUserIds: new Set(['user-1']) }),
    )
    expect(result).toEqual([])
  })

  it('respecte la fenêtre de cinq minutes, bornée à gauche', () => {
    const target = reminder({ timeLocal: '07:30' })

    const before = selectDueReminders([target], ctx({ nowUtc: new Date('2026-09-03T07:29:00Z') }))
    expect(before).toEqual([])

    const atStart = selectDueReminders([target], ctx({ nowUtc: new Date('2026-09-03T07:30:00Z') }))
    expect(atStart).toEqual([target])

    const justBeforeEnd = selectDueReminders(
      [target],
      ctx({ nowUtc: new Date('2026-09-03T07:34:00Z') }),
    )
    expect(justBeforeEnd).toEqual([target])

    const atEnd = selectDueReminders([target], ctx({ nowUtc: new Date('2026-09-03T07:35:00Z') }))
    expect(atEnd).toEqual([])
  })

  it('retourne la liste des rappels retenus dans l’ordre reçu', () => {
    const a = reminder({ id: 'a', userId: 'user-a' })
    const b = reminder({ id: 'b', userId: 'user-b', active: false })
    const c = reminder({ id: 'c', userId: 'user-c' })
    const result = selectDueReminders([a, b, c], ctx())
    expect(result).toEqual([a, c])
  })

  it('catalogue vide donne une liste vide', () => {
    expect(selectDueReminders([], ctx())).toEqual([])
  })
})
