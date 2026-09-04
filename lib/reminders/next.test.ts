import { describe, expect, it } from 'vitest'

import { nextReminderLabel, type ReminderSchedule } from '@/lib/reminders/next'

const BASE: ReminderSchedule = {
  timeLocal: '07:00',
  weekdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Paris',
  active: true,
}

/** 2026-09-07 est un lundi. Toutes les dates ci-dessous sont en UTC. */
function paris(iso: string): Date {
  return new Date(iso)
}

describe('nextReminderLabel', () => {
  it('renvoie null sans aucun rappel', () => {
    expect(nextReminderLabel([], paris('2026-09-07T04:00:00Z'))).toBeNull()
  })

  it('renvoie null quand l’unique rappel est inactif', () => {
    expect(nextReminderLabel([{ ...BASE, active: false }], paris('2026-09-07T04:00:00Z'))).toBeNull()
  })

  it('renvoie null quand aucun jour n’est coché', () => {
    expect(nextReminderLabel([{ ...BASE, weekdays: [] }], paris('2026-09-07T04:00:00Z'))).toBeNull()
  })

  it('annonce aujourd’hui quand l’heure n’est pas encore passée', () => {
    // 04:00 UTC = 06:00 à Paris, avant 07:00 local, un lundi.
    expect(nextReminderLabel([BASE], paris('2026-09-07T04:00:00Z'))).toBe("aujourd'hui à 07:00")
  })

  it('bascule sur demain une fois l’heure passée', () => {
    // 08:00 UTC = 10:00 à Paris, après 07:00 local, un lundi.
    expect(nextReminderLabel([BASE], paris('2026-09-07T08:00:00Z'))).toBe('demain à 07:00')
  })

  it('traite l’heure pile comme déjà passée', () => {
    // 05:00 UTC = 07:00 pile à Paris : le rappel du jour est parti.
    expect(nextReminderLabel([BASE], paris('2026-09-07T05:00:00Z'))).toBe('demain à 07:00')
  })

  it('saute les jours non cochés et nomme le jour atteint', () => {
    // Vendredi 10:00 locale, rappel du lundi au vendredi : prochain lundi.
    expect(nextReminderLabel([BASE], paris('2026-09-11T08:00:00Z'))).toBe('lundi à 07:00')
  })

  it('nomme le jour même quand il est à plus de deux jours', () => {
    const weekend: ReminderSchedule = { ...BASE, weekdays: [6] }
    // Lundi : le prochain samedi est à cinq jours.
    expect(nextReminderLabel([weekend], paris('2026-09-07T08:00:00Z'))).toBe('samedi à 07:00')
  })

  it('boucle sur le même jour de semaine quand c’est le seul coché', () => {
    const mondayOnly: ReminderSchedule = { ...BASE, weekdays: [1] }
    expect(nextReminderLabel([mondayOnly], paris('2026-09-07T08:00:00Z'))).toBe('lundi à 07:00')
  })

  it('raisonne dans la timezone du rappel, pas dans celle du serveur', () => {
    // 23:00 UTC lundi = mardi 09:00 à Tokyo : l'heure de 07:00 y est déjà passée.
    const tokyo: ReminderSchedule = { ...BASE, timezone: 'Asia/Tokyo' }
    expect(nextReminderLabel([tokyo], paris('2026-09-07T23:00:00Z'))).toBe('demain à 07:00')
  })

  it('retient l’occurrence la plus proche parmi deux rappels', () => {
    // 04:00 UTC = 06:00 à Paris, lundi : le rappel de 07:00 est dans 1h, celui de
    // 20:00 dans 14h. Le plus proche l'emporte, quel que soit l'ordre du tableau.
    const morning: ReminderSchedule = { ...BASE, timeLocal: '07:00' }
    const evening: ReminderSchedule = { ...BASE, timeLocal: '20:00' }
    expect(nextReminderLabel([evening, morning], paris('2026-09-07T04:00:00Z'))).toBe(
      "aujourd'hui à 07:00",
    )
    expect(nextReminderLabel([morning, evening], paris('2026-09-07T04:00:00Z'))).toBe(
      "aujourd'hui à 07:00",
    )
  })

  it('ignore un rappel inactif même s’il serait le plus proche', () => {
    const soonButInactive: ReminderSchedule = { ...BASE, timeLocal: '07:00', active: false }
    const later: ReminderSchedule = { ...BASE, timeLocal: '20:00' }
    expect(nextReminderLabel([soonButInactive, later], paris('2026-09-07T04:00:00Z'))).toBe(
      "aujourd'hui à 20:00",
    )
  })

  it('à égalité stricte de minutes jusqu’à l’occurrence, retient le premier du tableau', () => {
    // Les deux tombent dans 60 minutes (04:00 UTC) mais avec des libellés
    // différents, pour vérifier lequel des deux est effectivement retenu.
    const paris_: ReminderSchedule = { ...BASE, timezone: 'Europe/Paris', timeLocal: '07:00' }
    const kolkata: ReminderSchedule = { ...BASE, timezone: 'Asia/Kolkata', timeLocal: '10:30' }
    const now = paris('2026-09-07T04:00:00Z')

    expect(nextReminderLabel([paris_, kolkata], now)).toBe("aujourd'hui à 07:00")
    expect(nextReminderLabel([kolkata, paris_], now)).toBe("aujourd'hui à 10:30")
  })

  it('choisit le plus proche entre deux rappels de timezones différentes', () => {
    // Lundi 04:00 UTC : à Paris (06:00 local) le 07:00 est dans 1h ; à Tokyo
    // (13:00 local) le 07:00 du lendemain est dans 18h. Paris gagne.
    const paris_: ReminderSchedule = { ...BASE, timezone: 'Europe/Paris', timeLocal: '07:00' }
    const tokyo: ReminderSchedule = { ...BASE, timezone: 'Asia/Tokyo', timeLocal: '07:00' }
    expect(nextReminderLabel([tokyo, paris_], paris('2026-09-07T04:00:00Z'))).toBe(
      "aujourd'hui à 07:00",
    )
  })
})
