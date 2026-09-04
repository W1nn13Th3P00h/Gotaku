import Link from 'next/link'

import { formatDurationShort } from '@/lib/format'
import { zoneLabel } from '@/lib/referentials'
import {
  getHistorySummary30d,
  listSessionsForHistory,
  sortHistorySummaryByVolume,
  type EffectiveStatus,
} from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardList, CardListItem, EmptyState } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'

export const metadata = { title: 'Historique — Gokaku' }

// Dépend de l'utilisateur connecté (RLS) et de sa progression : jamais de
// réponse mise en cache.
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<EffectiveStatus, string> = {
  completed: 'Terminée',
  in_progress: 'En cours',
  abandoned: 'Abandonnée',
}

const STATUS_CLASSES: Record<EffectiveStatus, string> = {
  completed: 'text-muted',
  in_progress: 'text-accent',
  abandoned: 'text-muted',
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const [sessions, summary] = await Promise.all([
    listSessionsForHistory(supabase),
    getHistorySummary30d(supabase),
  ])

  const worked = summary === null ? [] : sortHistorySummaryByVolume(summary).filter((row) => row.secondsWorked > 0)
  // Distinction utile seulement s'il y a réellement un écart de volume :
  // sinon « plus »/« moins » travaillée serait trompeur.
  const hasSpread =
    worked.length > 1 && worked[0]?.secondsWorked !== worked[worked.length - 1]?.secondsWorked
  const maxWorkedS = worked[0]?.secondsWorked ?? 0

  return (
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader title="Historique" />
      </div>

      <Section title="Synthèse 30 derniers jours" className="mt-6">
        {summary === null ? (
          <p className="text-sm text-muted">Aucune séance terminée sur les 30 derniers jours.</p>
        ) : (
          <>
            <Card className="flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {summary[0]?.sessionCount ?? 0}
              </span>
              <span className="text-sm text-muted">
                séance{(summary[0]?.sessionCount ?? 0) > 1 ? 's' : ''} ·{' '}
                {formatDurationShort(summary[0]?.totalVolumeS ?? 0)} au total
              </span>
            </Card>

            <CardList className="mt-3">
              {worked.map((row, i) => (
                <CardListItem key={row.zoneCode} className="relative p-3 text-sm">
                  {/*
                    Barre de volume relatif : l'écart entre zones se lit d'un coup
                    d'œil, là où une colonne de durées demande de comparer des
                    nombres un à un. Purement décorative, la valeur reste écrite.
                  */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-accent/10"
                    style={{
                      width: maxWorkedS > 0 ? `${(row.secondsWorked / maxWorkedS) * 100}%` : '0%',
                    }}
                  />
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      {zoneLabel(row.zoneCode)}
                      {hasSpread && i === 0 ? (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          Plus travaillée
                        </span>
                      ) : null}
                      {hasSpread && i === worked.length - 1 ? (
                        <span className="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          Moins travaillée
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatDurationShort(row.secondsWorked)}
                    </span>
                  </span>
                </CardListItem>
              ))}
            </CardList>
          </>
        )}
      </Section>

      <Section title="Séances" className="mt-8">
        {sessions.length === 0 ? (
          <EmptyState>Aucune séance pour le moment.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Card>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {new Date(session.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className={`text-xs ${STATUS_CLASSES[session.effectiveStatus]}`}>
                      {STATUS_LABELS[session.effectiveStatus]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {session.exerciseCount} exercice{session.exerciseCount > 1 ? 's' : ''}
                    {session.actualDurationS !== null
                      ? ` · ${formatDurationShort(session.actualDurationS)}`
                      : ''}
                  </p>
                  {session.zonesWorked.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {session.zonesWorked.map((zone) => (
                        <Chip key={zone}>{zoneLabel(zone)}</Chip>
                      ))}
                    </div>
                  ) : null}
                  {session.effectiveStatus === 'in_progress' ? (
                    <Link
                      href={`/session/${session.id}`}
                      className={buttonClasses({
                        variant: 'primary',
                        size: 'sm',
                        block: true,
                        className: 'mt-3',
                      })}
                    >
                      Reprendre
                    </Link>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  )
}
