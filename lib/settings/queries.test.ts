import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

import { createTestDb } from '@/lib/db/test-db'

/**
 * `getAvailableEquipment`/`updateAvailableEquipment` passent par le client Supabase,
 * pas testables directement contre PGlite (pas de PostgREST ici). On vérifie donc la
 * table et la contrainte d'unicité par `user_id` au niveau SQL, comme
 * `session_history_summary.test.ts` le fait pour sa fonction.
 */
describe('user_settings', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    await db.close()
  })

  it('démarre vide et accepte un upsert par user_id', async () => {
    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('settings-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    const { rows: before } = await db.query(
      `select available_equipment from user_settings where user_id = $1`,
      [userId],
    )
    expect(before).toHaveLength(0)

    await db.query(
      `insert into user_settings (user_id, available_equipment) values ($1, $2)`,
      [userId, ['band', 'box']],
    )

    const { rows: afterInsert } = await db.query<{ available_equipment: string[] }>(
      `select available_equipment from user_settings where user_id = $1`,
      [userId],
    )
    expect(afterInsert[0]?.available_equipment).toEqual(['band', 'box'])

    await db.query(`update user_settings set available_equipment = $2 where user_id = $1`, [
      userId,
      ['ball'],
    ])

    const { rows: afterUpdate } = await db.query<{ available_equipment: string[] }>(
      `select available_equipment from user_settings where user_id = $1`,
      [userId],
    )
    expect(afterUpdate[0]?.available_equipment).toEqual(['ball'])
  })

  it('refuse un doublon de user_id', async () => {
    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('settings-test-2@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    await db.query(`insert into user_settings (user_id, available_equipment) values ($1, $2)`, [
      userId,
      [],
    ])

    await expect(
      db.query(`insert into user_settings (user_id, available_equipment) values ($1, $2)`, [
        userId,
        ['band'],
      ]),
    ).rejects.toThrow()
  })
})
