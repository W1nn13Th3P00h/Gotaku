import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDb } from '@/lib/db/test-db'

/**
 * Idempotence de l'envoi : la contrainte d'unicité `(reminder_id, sent_on)` de
 * `reminder_sends` rejette bien un second envoi le même jour (voir
 * `research.md` § Idempotence — réclamer avant d'envoyer, pas après). C'est le
 * cœur réel de FR-009, vérifié sur une vraie base plutôt qu'à l'œil.
 */
describe('reminder_sends', () => {
  let db: PGlite
  let reminderId: string

  beforeAll(async () => {
    db = await createTestDb()

    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('test@example.com') returning id`,
    )
    const userId = userRows[0]!.id

    const { rows: reminderRows } = await db.query<{ id: string }>(
      `insert into reminders (user_id, time_local, weekdays, timezone, active)
       values ($1, '07:30', array[1,2,3,4,5], 'Europe/Paris', true)
       returning id`,
      [userId],
    )
    reminderId = reminderRows[0]!.id
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('un premier insert on conflict do nothing réussit et retourne une ligne', async () => {
    const result = await db.query(
      `insert into reminder_sends (reminder_id, sent_on) values ($1, '2026-09-03')
       on conflict do nothing returning *`,
      [reminderId],
    )
    expect(result.rows.length).toBe(1)
  })

  it('un second insert identique le même jour ne retourne aucune ligne', async () => {
    const result = await db.query(
      `insert into reminder_sends (reminder_id, sent_on) values ($1, '2026-09-03')
       on conflict do nothing returning *`,
      [reminderId],
    )
    expect(result.rows.length).toBe(0)
  })

  it('un jour différent réclame de nouveau une ligne', async () => {
    const result = await db.query(
      `insert into reminder_sends (reminder_id, sent_on) values ($1, '2026-09-04')
       on conflict do nothing returning *`,
      [reminderId],
    )
    expect(result.rows.length).toBe(1)
  })
})
