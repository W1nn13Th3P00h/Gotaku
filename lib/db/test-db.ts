import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { PGlite } from '@electric-sql/pglite'

/**
 * Base Postgres jetable, en mémoire, pour rejouer les migrations dans les tests.
 *
 * PGlite est Postgres compilé en WebAssembly : pas de Docker, pas de serveur, une
 * vraie base par test. Ce qui permet de vérifier le schéma et la fonction de seed
 * sans jamais toucher au projet Supabase.
 *
 * Ce que PGlite n'a pas et que les migrations attendent : le schéma `auth` de
 * Supabase, `auth.uid()`, et les rôles `anon`, `authenticated`, `service_role`.
 * Le shim ci-dessous les crée, et rien de plus. Il ne simule pas le comportement
 * de la RLS Supabase, il permet seulement aux migrations de s'appliquer.
 */
const SUPABASE_SHIM = `
  create schema if not exists auth;

  create table auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text unique
  );

  create or replace function auth.uid() returns uuid
    language sql stable
    as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;

  do $do$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end
  $do$;
`

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/**
 * Migrations qui ne configurent que l'infrastructure du projet Supabase hébergé
 * (extensions `pg_cron`/`pg_net`, indisponibles sous PGlite) et ne touchent à
 * aucun schéma applicatif : rejouées sur l'hébergé, jamais ici.
 */
const HOSTED_ONLY_MIGRATIONS = new Set(['20260903120000_reminders_cron.sql'])

/** Applique le shim puis toutes les migrations, dans l'ordre des noms de fichiers. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_SHIM)

  for (const file of migrationFiles()) {
    if (HOSTED_ONLY_MIGRATIONS.has(file)) continue

    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`migration ${file} : ${(error as Error).message}`)
    }
  }

  return db
}
