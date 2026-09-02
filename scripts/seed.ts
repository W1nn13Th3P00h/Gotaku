/**
 * Pousse `data/exercises.json` en base.
 *
 *   npm run seed          valide puis écrit
 *   npm run seed:check    valide seulement, n'écrit rien
 *
 * Deux garanties, dans cet ordre :
 *
 *   1. Validation Zod complète avant tout contact avec la base. Une seule erreur
 *      arrête le script, aucune requête n'est envoyée.
 *   2. Écriture en un seul appel RPC. Un appel PostgREST est une transaction : il
 *      n'existe pas d'état intermédiaire où la moitié de la banque serait à jour.
 *
 * Idempotent sur le slug. Relancer sans avoir touché au JSON ne change rien.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

import { bankSchema, formatBankIssues } from '@/lib/bank/schema'
import { ZONE_CODES, zoneLabel, type ZoneCode } from '@/lib/referentials'

loadEnv({ path: resolve(process.cwd(), '.env.local'), quiet: true })

const BANK_PATH = resolve(process.cwd(), 'data/exercises.json')
const CHECK_ONLY = process.argv.includes('--check')

type SeedReport = {
  incoming: number
  inserted: number
  updated: number
  deactivated: number
  zone_links: number
  equipment_links: number
}

function fail(message: string, details: string[] = []): never {
  console.error(`\n✗ ${message}`)
  for (const line of details) console.error(`  ${line}`)
  console.error('')
  process.exit(1)
}

function readBank() {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(BANK_PATH, 'utf8'))
  } catch (error) {
    fail(`data/exercises.json illisible : ${(error as Error).message}`)
  }

  const result = bankSchema.safeParse(raw)
  if (!result.success) {
    const issues = formatBankIssues(result.error, raw)
    fail(
      `${issues.length} erreur${issues.length > 1 ? 's' : ''} de validation, rien n'a été écrit`,
      issues.slice(0, 40).concat(issues.length > 40 ? [`… et ${issues.length - 40} de plus`] : []),
    )
  }
  return result.data
}

function coverage(bank: ReturnType<typeof readBank>) {
  const counts = new Map<ZoneCode, number>(ZONE_CODES.map((code) => [code, 0]))
  for (const ex of bank) {
    for (const zone of ex.zones) counts.set(zone, (counts.get(zone) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => a[1] - b[1])
}

async function main() {
  const bank = readBank()
  console.log(`✓ ${bank.length} exercices conformes au schéma`)

  const thin = coverage(bank).filter(([, n]) => n < 8)
  if (thin.length > 0) {
    console.log(
      `  zones minces : ${thin.map(([code, n]) => `${zoneLabel(code)} ${n}`).join(', ')}`,
    )
  }

  if (CHECK_ONLY) {
    console.log('\nMode --check, aucune écriture.\n')
    return
  }

  // Import tardif : sans clé de service en environnement, --check reste utilisable.
  const { supabaseSecretKey, supabaseUrl } = await import('@/lib/supabase/env')

  const supabase = createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.rpc('seed_exercises', { payload: bank })

  if (error) {
    fail(`écriture refusée par la base : ${error.message}`, [
      error.hint ?? '',
      error.details ?? '',
    ].filter(Boolean))
  }

  const report = data as SeedReport

  console.log(
    [
      '',
      `✓ banque à jour`,
      `  ${report.inserted} créés, ${report.updated} mis à jour, ${report.deactivated} désactivés`,
      `  ${report.zone_links} rattachements de zone, ${report.equipment_links} de matériel`,
      '',
    ].join('\n'),
  )

  // Relecture indépendante : on ne se contente pas du rapport de la fonction.
  const { count, error: countError } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  if (countError) fail(`relecture impossible : ${countError.message}`)
  if (count !== bank.length) {
    fail(`incohérence : ${count} exercices actifs en base pour ${bank.length} dans le JSON`)
  }

  console.log(`✓ relecture : ${count} exercices actifs en base\n`)
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error))
})
