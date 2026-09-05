import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

import { createTestDb } from '@/lib/db/test-db'

/**
 * `getCompletedSessionDays`/`getWeeklyVolume` passent par le client Supabase
 * (PostgREST/RPC), pas testables directement contre PGlite — comme
 * `lib/settings/queries.test.ts`. On vérifie donc au niveau SQL : le filtre
 * `status = 'completed'` que `getCompletedSessionDays` reproduit tel quel, et
 * la fonction `session_weekly_volume()` appelée par `getWeeklyVolume`.
 */
describe('sessions completed pour le streak', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()
  }, 60_000)

  afterAll(async () => {
    await db.close()
  })

  it('ne renvoie que les séances completed, pas in_progress/abandoned/draft', async () => {
    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('stats-streak-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    await db.query(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values
         ($1, 'completed', 'manual', 600, 600, 1, '2026-08-14T10:00:00Z', '2026-08-14T10:10:00Z'),
         ($1, 'in_progress', 'manual', 600, null, 2, '2026-08-15T10:00:00Z', null),
         ($1, 'draft', 'manual', 0, null, 3, null, null),
         ($1, 'abandoned', 'manual', 600, null, 4, '2026-08-01T10:00:00Z', null)`,
      [userId],
    )

    const { rows } = await db.query<{ completed_at: Date }>(
      `select completed_at from sessions where status = 'completed' order by completed_at desc`,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.completed_at.toISOString()).toContain('2026-08-14')
  })
})

describe('session_weekly_volume()', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()

    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('stats-weekly-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    // Semaine courante : une séance.
    // Semaine -1 (entre les deux) : aucune séance, doit ressortir à zéro.
    // Semaine -2 : deux séances, doivent se sommer.
    await db.query(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values
         ($1, 'completed', 'manual', 300, 300, 1,
            date_trunc('week', now()) + interval '1 day',
            date_trunc('week', now()) + interval '1 day'),
         ($1, 'completed', 'manual', 200, 200, 2,
            date_trunc('week', now()) - interval '14 days',
            date_trunc('week', now()) - interval '14 days'),
         ($1, 'completed', 'manual', 250, 250, 3,
            date_trunc('week', now()) - interval '11 days',
            date_trunc('week', now()) - interval '11 days')`,
      [userId],
    )
  }, 60_000)

  afterAll(async () => {
    await db.close()
  })

  it('zero-fill la semaine sans séance entre deux semaines avec séance, et somme la même semaine', async () => {
    const { rows } = await db.query<{ week_start: string; total_volume_s: number }>(
      'select * from session_weekly_volume($1)',
      [3],
    )

    expect(rows).toHaveLength(3)

    const [weekMinus2, weekMinus1, weekCurrent] = rows
    expect(weekMinus2?.total_volume_s).toBe(450) // 200 + 250, même semaine
    expect(weekMinus1?.total_volume_s).toBe(0) // zero-fill
    expect(weekCurrent?.total_volume_s).toBe(300)
  })

  it('renvoie les semaines dans l\'ordre chronologique', async () => {
    const { rows } = await db.query<{ week_start: string }>(
      'select * from session_weekly_volume($1)',
      [3],
    )
    const starts = rows.map((r) => r.week_start)
    expect([...starts].sort()).toEqual(starts)
  })
})
