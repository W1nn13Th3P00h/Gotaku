import { getZoneCoverage } from '@/lib/bank/queries'
import { REGIONS } from '@/lib/referentials'
import { createClient } from '@/lib/supabase/server'
import { CardList, CardListItem } from '@/components/ui/card'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'

export const metadata = { title: 'Couverture — Gokaku' }

export default async function BankCoveragePage() {
  const supabase = await createClient()
  const rows = await getZoneCoverage(supabase)

  return (
    <Page>
      <BackLink href="/bank">Banque</BackLink>

      <div className="mt-2">
        <PageHeader
          title="Couverture par zone"
          subtitle="Nombre d'exercices actifs par zone. Les zones en rouge sont sous-alimentées."
        />
      </div>

      <div className="mt-6 space-y-6">
        {REGIONS.map((region) => {
          const regionRows = rows.filter((row) => row.regionCode === region.code)
          if (regionRows.length === 0) return null

          return (
            <Section key={region.code} title={region.label}>
              <CardList>
                {regionRows.map((row) => (
                  <CardListItem
                    key={row.zoneCode}
                    className="flex min-h-11 items-center justify-between p-3 text-sm"
                  >
                    <span>{row.zoneLabel}</span>
                    <span
                      className={
                        row.isLowCoverage ? 'font-medium tabular-nums text-danger' : 'font-medium tabular-nums'
                      }
                    >
                      {row.exerciseCount}
                    </span>
                  </CardListItem>
                ))}
              </CardList>
            </Section>
          )
        })}
      </div>
    </Page>
  )
}
