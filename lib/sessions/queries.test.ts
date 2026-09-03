import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

import { createTestDb } from '@/lib/db/test-db'
import { ZONE_CODES } from '@/lib/referentials'

/**
 * La fonction SQL `session_history_summary()` est le seul endroit où un bug
 * silencieux (mauvaise borne de fenêtre, zone omise, oubli du doublement
 * `per_side`) passerait inaperçu. Testée contre une vraie base Postgres
 * jetable, sur le même principe que `zone_coverage()` (Lot 1).
 */
describe('session_history_summary()', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()

    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('history-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s)
      values
        ('probe-history-abs', 'Test abs', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 30, 20, 40),
        ('probe-history-quads', 'Test quads', array['Fais ça.'], 'passive_stretch', 'seated', 'asymmetric', 1, 20, 15, 30);

      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'abs', true from exercises where slug = 'probe-history-abs';
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'quads', true from exercises where slug = 'probe-history-quads';
    `)

    const { rows: exerciseRows } = await db.query<{ slug: string; id: string }>(
      `select slug, id from exercises where slug in ('probe-history-abs', 'probe-history-quads')`,
    )
    const absId = exerciseRows.find((r) => r.slug === 'probe-history-abs')?.id
    const quadsId = exerciseRows.find((r) => r.slug === 'probe-history-quads')?.id
    if (!absId || !quadsId) throw new Error('insertion exercices de test échouée')

    // Séance completed dans la fenêtre : doit compter, alimente les deux zones,
    // exercice per_side doublé.
    const { rows: session1Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values ($1, 'completed', 'manual', 600, 600, 1, '2026-08-14T10:00:00Z', '2026-08-15T10:00:00Z')
       returning id`,
      [userId],
    )
    const session1Id = session1Rows[0]?.id
    await db.query(
      `insert into session_items (session_id, exercise_id, ord, duration_s, per_side, status)
       values ($1, $2, 0, 30, false, 'done'), ($1, $3, 1, 20, true, 'done')`,
      [session1Id, absId, quadsId],
    )

    // Séance completed hors fenêtre (avant `since`) : ne doit compter nulle part.
    const { rows: session2Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values ($1, 'completed', 'manual', 300, 300, 2, '2026-06-30T10:00:00Z', '2026-07-01T10:00:00Z')
       returning id`,
      [userId],
    )
    const session2Id = session2Rows[0]?.id
    await db.query(
      `insert into session_items (session_id, exercise_id, ord, duration_s, per_side, status)
       values ($1, $2, 0, 30, false, 'done')`,
      [session2Id, absId],
    )

    // Séance non completed, dans la fenêtre par sa date : ne doit jamais compter.
    const { rows: session3Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, seed, started_at)
       values ($1, 'in_progress', 'manual', 300, 3, '2026-08-16T10:00:00Z')
       returning id`,
      [userId],
    )
    await db.query(
      `insert into session_items (session_id, exercise_id, ord, duration_s, per_side, status)
       values ($1, $2, 0, 20, true, 'done')`,
      [session3Rows[0]?.id, quadsId],
    )
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('renvoie les 26 zones du référentiel, y compris à zéro', async () => {
    const { rows } = await db.query('select * from session_history_summary($1)', [
      '2026-08-01T00:00:00Z',
    ])
    expect(rows).toHaveLength(ZONE_CODES.length)
  })

  it('agrège dans la fenêtre, double le temps per_side, ignore les séances non completed', async () => {
    const { rows } = await db.query<{
      zone_code: string
      seconds_worked: number
      session_count: number
      total_volume_s: number
    }>('select * from session_history_summary($1)', ['2026-08-01T00:00:00Z'])

    const abs = rows.find((r) => r.zone_code === 'abs')
    const quads = rows.find((r) => r.zone_code === 'quads')
    const neck = rows.find((r) => r.zone_code === 'neck')

    // Seule session1 est dans la fenêtre (session2 avant `since`, session3 non completed).
    expect(abs?.seconds_worked).toBe(30)
    expect(quads?.seconds_worked).toBe(40) // 20 s × 2 côtés
    expect(neck?.seconds_worked).toBe(0)

    expect(abs?.session_count).toBe(1)
    expect(abs?.total_volume_s).toBe(600)
    // `session_count`/`total_volume_s` identiques sur toutes les lignes.
    expect(quads?.session_count).toBe(1)
    expect(quads?.total_volume_s).toBe(600)
  })

  it('inclut session2 dès que `since` la couvre', async () => {
    const { rows } = await db.query<{ zone_code: string; seconds_worked: number; session_count: number }>(
      'select * from session_history_summary($1)',
      ['2026-06-01T00:00:00Z'],
    )
    const abs = rows.find((r) => r.zone_code === 'abs')
    expect(abs?.seconds_worked).toBe(60) // session1 (30) + session2 (30)
    expect(abs?.session_count).toBe(2)
  })

  it('aucune séance sur la fenêtre : zéro partout, session_count à zéro', async () => {
    const { rows } = await db.query<{ seconds_worked: number; session_count: number; total_volume_s: number }>(
      'select * from session_history_summary($1)',
      ['2027-01-01T00:00:00Z'],
    )
    expect(rows.every((r) => r.seconds_worked === 0)).toBe(true)
    expect(rows[0]?.session_count).toBe(0)
    expect(rows[0]?.total_volume_s).toBe(0)
  })
})
