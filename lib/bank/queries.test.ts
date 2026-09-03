import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

import { createTestDb } from '@/lib/db/test-db'
import { ZONE_CODES } from '@/lib/referentials'

import { mapExerciseRow, type RawExerciseDetailRow, type RawExerciseRow } from '@/lib/bank/queries'

/**
 * `position` et `intensity` sont des champs internes au générateur (`CLAUDE.md`,
 * Constitution Principe III) : ils ne doivent jamais quitter `lib/bank/queries.ts`,
 * même si une ligne brute mal sélectionnée (par ex. un `select('*')` introduit par
 * erreur) les contient encore.
 */
describe('mapExerciseRow', () => {
  const rawRow: RawExerciseRow & { position: string; intensity: number } = {
    slug: 'couch-stretch',
    name: 'Couch stretch',
    type: 'passive_stretch',
    duration_target_s: 90,
    exercise_zones: [
      { zone_code: 'hip_flexors', is_primary: true },
      { zone_code: 'quads', is_primary: false },
    ],
    exercise_equipment: [{ equipment_code: 'box' }],
    position: 'quadruped',
    intensity: 3,
  }

  it('ne renvoie jamais position ni intensity, même présents sur la ligne brute', () => {
    const summary = mapExerciseRow(rawRow)
    expect(summary).not.toHaveProperty('position')
    expect(summary).not.toHaveProperty('intensity')
  })

  it('retient la zone primaire et la liste complète des zones', () => {
    const summary = mapExerciseRow(rawRow)
    expect(summary.primaryZone).toBe('hip_flexors')
    expect(summary.zones).toEqual(['hip_flexors', 'quads'])
  })

  it('même garde en mode détaillé', () => {
    const detailRow: RawExerciseDetailRow & { position: string; intensity: number } = {
      ...rawRow,
      instructions: ['Fais ça.'],
      contraindications: null,
      lastPerformedAt: null,
    }
    const detail = mapExerciseRow(detailRow, { detailed: true })
    expect(detail).not.toHaveProperty('position')
    expect(detail).not.toHaveProperty('intensity')
    expect(detail.instructions).toEqual(['Fais ça.'])
    expect(detail.lastPerformedAt).toBeNull()
  })

  it("lève une erreur si aucune zone n'est marquée primaire (corruption de données)", () => {
    const noPrimary: RawExerciseRow = {
      ...rawRow,
      exercise_zones: [{ zone_code: 'quads', is_primary: false }],
    }
    expect(() => mapExerciseRow(noPrimary)).toThrow()
  })
})

/**
 * La fonction SQL `zone_coverage()` est le seul endroit où un bug de jointure
 * (`inner join` au lieu de `left join`) serait silencieux : une zone sans exercice
 * disparaîtrait du tableau au lieu d'apparaître à zéro (FR-008). Testé contre une
 * vraie base Postgres jetable, pas relu à l'œil.
 */
describe('zone_coverage()', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('renvoie les 26 zones du référentiel, y compris celles sans exercice', async () => {
    const { rows } = await db.query<{ zone_code: string; exercise_count: number }>(
      'select * from zone_coverage()',
    )
    expect(rows).toHaveLength(ZONE_CODES.length)
    expect([...rows.map((r) => r.zone_code)].sort()).toEqual([...ZONE_CODES].sort())
  })

  it('compte zéro pour une zone sans exercice rattaché', async () => {
    const before = await db.query<{ zone_code: string; exercise_count: number }>(
      'select * from zone_coverage() where zone_code = $1',
      ['neck'],
    )
    expect(before.rows[0]?.exercise_count).toBe(0)

    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s)
      values ('probe-neck', 'Test', array['Fais ça.'], 'passive_stretch', 'seated',
              'symmetric', 1, 30, 20, 40);
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'neck', true from exercises where slug = 'probe-neck';
    `)

    const after = await db.query<{ zone_code: string; exercise_count: number }>(
      'select * from zone_coverage() where zone_code = $1',
      ['neck'],
    )
    expect(after.rows[0]?.exercise_count).toBe(1)

    await db.exec(`delete from exercises where slug = 'probe-neck';`)
  })

  it("compte une zone deux fois si deux exercices actifs la travaillent, jamais un exercice inactif", async () => {
    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s, active)
      values
        ('probe-shins-1', 'Test 1', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 30, 20, 40, true),
        ('probe-shins-2', 'Test 2', array['Fais ça.'], 'passive_stretch', 'seated', 'symmetric', 1, 30, 20, 40, false);
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'shins', true from exercises where slug in ('probe-shins-1', 'probe-shins-2');
    `)

    const before = await db.query<{ exercise_count: number }>(
      'select exercise_count from zone_coverage() where zone_code = $1',
      ['shins'],
    )

    await db.exec(`delete from exercises where slug in ('probe-shins-1', 'probe-shins-2');`)

    expect(before.rows[0]?.exercise_count).toBe(1)
  })
})
