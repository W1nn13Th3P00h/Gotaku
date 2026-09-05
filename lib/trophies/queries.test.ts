import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

import { createTestDb } from '@/lib/db/test-db'
import { REGIONS } from '@/lib/referentials'

/**
 * `getUnlockedTrophyKeys`/`getTrophyProgress` passent par le client Supabase
 * (PostgREST/RPC), pas testables directement contre PGlite — comme
 * `lib/stats/queries.test.ts`. On vérifie donc au niveau SQL la fonction
 * `trophy_region_progress()` appelée par `getTrophyProgress` : le
 * `count(distinct session_id)` par région (deux exercices de la même région
 * dans une même séance ne comptent qu'une fois), le zero-fill des régions sans
 * séance, et le filtre `status = 'completed'`.
 */
describe('trophy_region_progress()', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()

    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('trophy-region-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    // 'abs' et 'obliques' sont tous deux dans la région `core` : un exercice
    // par zone, pour vérifier que deux items de la même région dans une même
    // séance ne comptent qu'une fois. 'quads' est dans `thigh`.
    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s)
      values
        ('probe-trophy-abs', 'Test abs', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 30, 20, 40),
        ('probe-trophy-obliques', 'Test obliques', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 30, 20, 40),
        ('probe-trophy-quads', 'Test quads', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 20, 15, 30);

      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'abs', true from exercises where slug = 'probe-trophy-abs';
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'obliques', true from exercises where slug = 'probe-trophy-obliques';
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'quads', true from exercises where slug = 'probe-trophy-quads';
    `)

    const { rows: exerciseRows } = await db.query<{ slug: string; id: string }>(
      `select slug, id from exercises where slug in
         ('probe-trophy-abs', 'probe-trophy-obliques', 'probe-trophy-quads')`,
    )
    const absId = exerciseRows.find((r) => r.slug === 'probe-trophy-abs')?.id
    const obliquesId = exerciseRows.find((r) => r.slug === 'probe-trophy-obliques')?.id
    const quadsId = exerciseRows.find((r) => r.slug === 'probe-trophy-quads')?.id
    if (!absId || !obliquesId || !quadsId) throw new Error('insertion exercices de test échouée')

    // session1 (completed) : abs + obliques, deux zones de la région `core` —
    // ne doit compter qu'une fois pour `core`.
    const { rows: session1Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values ($1, 'completed', 'manual', 600, 600, 1, '2026-08-14T10:00:00Z', '2026-08-14T10:10:00Z')
       returning id`,
      [userId],
    )
    const session1Id = session1Rows[0]?.id

    // session2 (completed) : quads, région `thigh`.
    const { rows: session2Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, actual_duration_s, seed, started_at, completed_at)
       values ($1, 'completed', 'manual', 300, 300, 2, '2026-08-15T10:00:00Z', '2026-08-15T10:05:00Z')
       returning id`,
      [userId],
    )
    const session2Id = session2Rows[0]?.id

    // session3 (in_progress, pas completed) : abs — ne doit pas compter.
    const { rows: session3Rows } = await db.query<{ id: string }>(
      `insert into sessions (user_id, status, source, target_duration_s, seed, started_at)
       values ($1, 'in_progress', 'manual', 600, 3, '2026-08-16T10:00:00Z')
       returning id`,
      [userId],
    )
    const session3Id = session3Rows[0]?.id

    await db.query(
      `insert into session_items (session_id, exercise_id, ord, duration_s, per_side)
       values
         ($1, $2, 0, 30, false),
         ($1, $3, 1, 30, false),
         ($4, $5, 0, 20, false),
         ($6, $2, 0, 30, false)`,
      [session1Id, absId, obliquesId, session2Id, quadsId, session3Id],
    )
  }, 60_000)

  afterAll(async () => {
    await db.close()
  })

  it('renvoie toutes les régions du référentiel, zero-fill incluses', async () => {
    const { rows } = await db.query('select * from trophy_region_progress()')
    expect(rows).toHaveLength(REGIONS.length)
  })

  it('compte une séance une seule fois par région, même avec deux zones de cette région', async () => {
    const { rows } = await db.query<{ region_code: string; region_session_count: number }>(
      'select * from trophy_region_progress()',
    )
    const core = rows.find((r) => r.region_code === 'core')
    expect(core?.region_session_count).toBe(1)
  })

  it('compte séparément une région différente', async () => {
    const { rows } = await db.query<{ region_code: string; region_session_count: number }>(
      'select * from trophy_region_progress()',
    )
    const thigh = rows.find((r) => r.region_code === 'thigh')
    expect(thigh?.region_session_count).toBe(1)
  })

  it('ignore les séances non completed', async () => {
    // session3 (in_progress) ajoute un item `abs`, ne doit pas gonfler `core`.
    const { rows } = await db.query<{ region_code: string; region_session_count: number }>(
      'select * from trophy_region_progress()',
    )
    const core = rows.find((r) => r.region_code === 'core')
    expect(core?.region_session_count).toBe(1)
  })

  it('renvoie une région sans séance à zéro', async () => {
    const { rows } = await db.query<{ region_code: string; region_session_count: number }>(
      'select * from trophy_region_progress()',
    )
    const arm = rows.find((r) => r.region_code === 'arm')
    expect(arm?.region_session_count).toBe(0)
  })

  it('somme le volume total completed uniquement, identique sur toutes les lignes', async () => {
    const { rows } = await db.query<{ total_volume_s: number }>(
      'select * from trophy_region_progress()',
    )
    expect(rows.every((r) => r.total_volume_s === 900)).toBe(true)
  })
})
