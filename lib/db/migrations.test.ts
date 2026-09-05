import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bankSchema } from '@/lib/bank/schema'
import { createTestDb, migrationFiles } from '@/lib/db/test-db'
import {
  EQUIPMENT_CODES,
  MOBILITY_FOCUS_CODES,
  PRACTICE_CODES,
  ZONE_CODES,
} from '@/lib/referentials'

/**
 * Le schéma SQL et la fonction de seed sont testés sur une vraie base Postgres
 * jetable, pas relus à l'œil. Une erreur de syntaxe ou une contrainte oubliée casse
 * ici, avant d'atteindre le projet Supabase.
 */

const bank = bankSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), 'data/exercises.json'), 'utf8')),
)

async function one<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.query<T>(sql, params)
  const row = result.rows[0]
  if (row === undefined) throw new Error(`aucune ligne pour : ${sql}`)
  return row
}

describe('migrations', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it("s'appliquent toutes dans l'ordre", () => {
    expect(migrationFiles().length).toBeGreaterThan(0)
  })

  it('créent les 26 zones du référentiel', async () => {
    const { count } = await one<{ count: number }>(db, 'select count(*)::int as count from zones')
    expect(count).toBe(ZONE_CODES.length)

    const { codes } = await one<{ codes: string[] }>(
      db,
      'select array_agg(code order by sort) as codes from zones',
    )
    expect([...codes].sort()).toEqual([...ZONE_CODES].sort())
  })

  it('créent les 9 matériels du référentiel', async () => {
    const { codes } = await one<{ codes: string[] }>(
      db,
      'select array_agg(code order by sort) as codes from equipment',
    )
    expect([...codes].sort()).toEqual([...EQUIPMENT_CODES].sort())
  })

  it('créent les 4 grandes zones de mobilité du référentiel', async () => {
    const { codes } = await one<{ codes: string[] }>(
      db,
      'select array_agg(code order by sort) as codes from mobility_focuses',
    )
    expect([...codes].sort()).toEqual([...MOBILITY_FOCUS_CODES].sort())
  })

  it('créent les 7 pratiques du référentiel', async () => {
    const { codes } = await one<{ codes: string[] }>(
      db,
      'select array_agg(code order by sort) as codes from practices',
    )
    expect([...codes].sort()).toEqual([...PRACTICE_CODES].sort())
  })

  it('rattachent chaque grande zone de mobilité à des zones existantes', async () => {
    const { orphans } = await one<{ orphans: number }>(
      db,
      `select count(*)::int as orphans from mobility_focus_zones mfz
       left join zones z on z.code = mfz.zone_code
       where z.code is null`,
    )
    expect(orphans).toBe(0)
  })

  it('rattachent chaque pratique à des zones existantes', async () => {
    const { orphans } = await one<{ orphans: number }>(
      db,
      `select count(*)::int as orphans from practice_zones pz
       left join zones z on z.code = pz.zone_code
       where z.code is null`,
    )
    expect(orphans).toBe(0)
  })

  it('refusent un main_practice hors référentiel', async () => {
    const { rows: userRows } = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('migration-practice-test@example.com') returning id`,
    )
    const userId = userRows[0]?.id
    if (!userId) throw new Error('insertion utilisateur de test échouée')

    await expect(
      db.query(
        `insert into user_settings (user_id, main_practice) values ($1, 'unknown_practice')`,
        [userId],
      ),
    ).rejects.toThrow()
  })

  it('refusent une durée minimale supérieure à la cible', async () => {
    await expect(
      db.exec(`
        insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                               duration_target_s, duration_min_s, duration_max_s)
        values ('bad-durations', 'Test', array['Fais ça.'], 'passive_stretch', 'seated',
                'symmetric', 1, 30, 60, 90);
      `),
    ).rejects.toThrow()
  })

  it('refusent plus de six instructions', async () => {
    await expect(
      db.exec(`
        insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                               duration_target_s, duration_min_s, duration_max_s)
        values ('too-many', 'Test', array['a','b','c','d','e','f','g'], 'passive_stretch',
                'seated', 'symmetric', 1, 30, 20, 40);
      `),
    ).rejects.toThrow()
  })

  it('refusent une intensité hors de la plage 1 à 3', async () => {
    await expect(
      db.exec(`
        insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                               duration_target_s, duration_min_s, duration_max_s)
        values ('bad-intensity', 'Test', array['Fais ça.'], 'passive_stretch', 'seated',
                'symmetric', 5, 30, 20, 40);
      `),
    ).rejects.toThrow()
  })

  it('refusent deux zones primaires sur un même exercice', async () => {
    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s)
      values ('two-primaries', 'Test', array['Fais ça.'], 'passive_stretch', 'seated',
              'symmetric', 1, 30, 20, 40);
      insert into exercise_zones (exercise_id, zone_code, is_primary)
      select id, 'quads', true from exercises where slug = 'two-primaries';
    `)

    await expect(
      db.exec(`
        insert into exercise_zones (exercise_id, zone_code, is_primary)
        select id, 'glutes', true from exercises where slug = 'two-primaries';
      `),
    ).rejects.toThrow()

    await db.exec(`delete from exercises where slug = 'two-primaries';`)
  })

  it('refusent une zone hors référentiel', async () => {
    await db.exec(`
      insert into exercises (slug, name, instructions, type, position, symmetry, intensity,
                             duration_target_s, duration_min_s, duration_max_s)
      values ('bad-zone', 'Test', array['Fais ça.'], 'passive_stretch', 'seated',
              'symmetric', 1, 30, 20, 40);
    `)

    await expect(
      db.exec(`
        insert into exercise_zones (exercise_id, zone_code, is_primary)
        select id, 'psoas', true from exercises where slug = 'bad-zone';
      `),
    ).rejects.toThrow()

    await db.exec(`delete from exercises where slug = 'bad-zone';`)
  })

  it('activent la RLS sur toutes les tables attendues', async () => {
    const { rows } = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables
       where schemaname = 'public' order by tablename`,
    )
    const unprotected = rows.filter((r) => !r.rowsecurity).map((r) => r.tablename)
    expect(unprotected).toEqual([])
  })

  it("n'exposent aucune policy d'écriture sur la banque et les référentiels", async () => {
    const { rows } = await db.query<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies
       where schemaname = 'public'
         and tablename in (
           'zones', 'equipment', 'mobility_focuses', 'mobility_focus_zones',
           'practices', 'practice_zones', 'exercises', 'exercise_zones', 'exercise_equipment'
         )`,
    )
    expect(rows.every((r) => r.cmd === 'SELECT')).toBe(true)
  })

  it('réservent seed_exercises au rôle de service', async () => {
    const { ok } = await one<{ ok: boolean }>(
      db,
      `select not has_function_privilege('authenticated', 'public.seed_exercises(jsonb)', 'execute')
              and has_function_privilege('service_role', 'public.seed_exercises(jsonb)', 'execute')
              as ok`,
    )
    expect(ok).toBe(true)
  })
})

describe('seed_exercises', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDb()
  }, 60_000)

  afterAll(async () => {
    await db?.close()
  })

  it('insère la banque entière au premier passage', async () => {
    const report = await one<{
      incoming: number
      inserted: number
      updated: number
      deactivated: number
      zone_links: number
      equipment_links: number
    }>(db, 'select * from jsonb_to_record(seed_exercises($1)) as x(' +
      'incoming int, inserted int, updated int, deactivated int, ' +
      'zone_links int, equipment_links int)', [JSON.stringify(bank)])

    expect(report.incoming).toBe(bank.length)
    expect(report.inserted).toBe(bank.length)
    expect(report.updated).toBe(0)
    expect(report.deactivated).toBe(0)
    expect(report.zone_links).toBe(bank.reduce((n, ex) => n + ex.zones.length, 0))
    expect(report.equipment_links).toBe(bank.reduce((n, ex) => n + ex.equipment.length, 0))
  })

  it('donne exactement une zone primaire par exercice', async () => {
    const { bad } = await one<{ bad: number }>(
      db,
      `select count(*)::int as bad from (
         select exercise_id, count(*) filter (where is_primary) as primaries
         from exercise_zones group by exercise_id
       ) t where primaries <> 1`,
    )
    expect(bad).toBe(0)
  })

  it('reporte fidèlement la zone primaire du JSON', async () => {
    const sample = bank[0]!
    const { zone_code } = await one<{ zone_code: string }>(
      db,
      `select z.zone_code from exercise_zones z
       join exercises x on x.id = z.exercise_id
       where x.slug = $1 and z.is_primary`,
      [sample.slug],
    )
    expect(zone_code).toBe(sample.primary_zone)
  })

  it('est idempotent : un second passage identique ne crée rien', async () => {
    const report = await one<{ inserted: number; updated: number; deactivated: number }>(
      db,
      'select * from jsonb_to_record(seed_exercises($1)) as x(' +
        'inserted int, updated int, deactivated int)',
      [JSON.stringify(bank)],
    )
    expect(report.inserted).toBe(0)
    expect(report.updated).toBe(bank.length)
    expect(report.deactivated).toBe(0)

    const { count } = await one<{ count: number }>(
      db,
      'select count(*)::int as count from exercises',
    )
    expect(count).toBe(bank.length)
  })

  it('remplace les rattachements au lieu de les cumuler', async () => {
    const { count } = await one<{ count: number }>(
      db,
      'select count(*)::int as count from exercise_zones',
    )
    expect(count).toBe(bank.reduce((n, ex) => n + ex.zones.length, 0))
  })

  it('désactive sans supprimer un slug disparu du JSON', async () => {
    const dropped = bank[0]!
    const report = await one<{ deactivated: number }>(
      db,
      'select * from jsonb_to_record(seed_exercises($1)) as x(deactivated int)',
      [JSON.stringify(bank.slice(1))],
    )
    expect(report.deactivated).toBe(1)

    const { active } = await one<{ active: boolean }>(
      db,
      'select active from exercises where slug = $1',
      [dropped.slug],
    )
    expect(active).toBe(false)
  })

  it('réactive un slug de retour dans le JSON', async () => {
    await db.query('select seed_exercises($1)', [JSON.stringify(bank)])
    const { count } = await one<{ count: number }>(
      db,
      'select count(*)::int as count from exercises where active',
    )
    expect(count).toBe(bank.length)
  })

  it('refuse un payload vide', async () => {
    await expect(db.query('select seed_exercises($1)', ['[]'])).rejects.toThrow()
  })

  it("refuse un payload qui n'est pas un tableau", async () => {
    await expect(db.query('select seed_exercises($1)', ['{"slug":"x"}'])).rejects.toThrow()
  })

  it("n'écrit rien quand un exercice est invalide, même en fin de tableau", async () => {
    const before = await one<{ count: number }>(
      db,
      'select count(*)::int as count from exercises',
    )

    const poisoned = [
      ...bank.slice(0, 3).map((ex, i) => ({ ...ex, slug: `probe-${i}` })),
      { ...bank[0]!, slug: 'probe-bad', intensity: 9 },
    ]

    await expect(
      db.query('select seed_exercises($1)', [JSON.stringify(poisoned)]),
    ).rejects.toThrow()

    const after = await one<{ count: number }>(db, 'select count(*)::int as count from exercises')
    expect(after.count).toBe(before.count)

    const { probes } = await one<{ probes: number }>(
      db,
      `select count(*)::int as probes from exercises where slug like 'probe-%'`,
    )
    expect(probes).toBe(0)
  })
})
