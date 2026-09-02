import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { bankSchema, formatBankIssues } from '@/lib/bank/schema'
import { ZONE_CODES } from '@/lib/referentials'

/**
 * La banque réelle est validée par les tests, pas seulement par le seed.
 * Un exercice non conforme casse la suite avant de casser une séance.
 */
const raw: unknown = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/exercises.json'), 'utf8'),
)

describe('data/exercises.json', () => {
  it('est conforme au schéma de banque', () => {
    const result = bankSchema.safeParse(raw)
    if (!result.success) {
      throw new Error(
        `${result.error.issues.length} problèmes :\n${formatBankIssues(result.error, raw).slice(0, 20).join('\n')}`,
      )
    }
    expect(result.success).toBe(true)
  })

  it('couvre chaque zone du référentiel par au moins un exercice', () => {
    const bank = bankSchema.parse(raw)
    const covered = new Set(bank.flatMap((ex) => ex.zones))
    const uncovered = ZONE_CODES.filter((code) => !covered.has(code))
    expect(uncovered).toEqual([])
  })

  it('ne contient aucun nom en doublon', () => {
    const bank = bankSchema.parse(raw)
    const counts = new Map<string, string[]>()
    for (const ex of bank) {
      counts.set(ex.name, [...(counts.get(ex.name) ?? []), ex.slug])
    }
    const duplicates = [...counts].filter(([, slugs]) => slugs.length > 1)
    expect(duplicates).toEqual([])
  })
})
