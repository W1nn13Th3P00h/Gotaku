import Link from 'next/link'

import { getZoneCoverage } from '@/lib/bank/queries'
import { REGIONS } from '@/lib/referentials'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Couverture — Gokaku' }

export default async function BankCoveragePage() {
  const supabase = await createClient()
  const rows = await getZoneCoverage(supabase)

  return (
    <main className="mx-auto max-w-md p-6 pb-16">
      <Link href="/bank" className="text-sm text-accent underline underline-offset-2">
        ← Banque
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Couverture par zone</h1>
      <p className="mt-1 text-sm text-muted">
        Nombre d&apos;exercices actifs par zone. Les zones en rouge sont sous-alimentées.
      </p>

      <div className="mt-6 space-y-6">
        {REGIONS.map((region) => {
          const regionRows = rows.filter((row) => row.regionCode === region.code)
          if (regionRows.length === 0) return null

          return (
            <div key={region.code}>
              <h2 className="text-sm font-medium text-muted">{region.label}</h2>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {regionRows.map((row) => (
                  <li key={row.zoneCode} className="flex items-center justify-between p-3 text-sm">
                    <span>{row.zoneLabel}</span>
                    <span
                      className={
                        row.isLowCoverage
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'font-medium'
                      }
                    >
                      {row.exerciseCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </main>
  )
}
