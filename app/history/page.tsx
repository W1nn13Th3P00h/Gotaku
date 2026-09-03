import Link from 'next/link'

import { formatDurationShort } from '@/lib/format'
import { zoneLabel } from '@/lib/referentials'
import { getHistorySummary30d, listSessionsForHistory, type EffectiveStatus } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Historique — Gokaku' }

// Dépend de l'utilisateur connecté (RLS) et de sa progression : jamais de
// réponse mise en cache.
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<EffectiveStatus, string> = {
  completed: 'Terminée',
  in_progress: 'En cours',
  abandoned: 'Abandonnée',
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const [sessions, summary] = await Promise.all([
    listSessionsForHistory(supabase),
    getHistorySummary30d(supabase),
  ])

  return (
    <main className="mx-auto max-w-md p-6 pb-16">
      <Link href="/" className="text-sm text-accent underline underline-offset-2">
        ← Accueil
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Historique</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Synthèse 30 derniers jours</h2>

        {summary === null ? (
          <p className="mt-2 text-sm text-muted">Aucune séance terminée sur les 30 derniers jours.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {summary[0]?.sessionCount ?? 0} séance{(summary[0]?.sessionCount ?? 0) > 1 ? 's' : ''} ·{' '}
              {formatDurationShort(summary[0]?.totalVolumeS ?? 0)} au total
            </p>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {summary
                .filter((row) => row.secondsWorked > 0)
                .map((row) => (
                  <li key={row.zoneCode} className="flex items-center justify-between p-3 text-sm">
                    <span>{zoneLabel(row.zoneCode)}</span>
                    <span className="font-medium">{formatDurationShort(row.secondsWorked)}</span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">Séances</h2>

        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune séance pour le moment.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id} className="rounded-xl border border-border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {new Date(session.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span className="text-xs text-muted">{STATUS_LABELS[session.effectiveStatus]}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {session.exerciseCount} exercice{session.exerciseCount > 1 ? 's' : ''}
                  {session.actualDurationS !== null
                    ? ` · ${formatDurationShort(session.actualDurationS)}`
                    : ''}
                </p>
                {session.zonesWorked.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.zonesWorked.map((zone) => (
                      <span
                        key={zone}
                        className="rounded-full border border-border px-2 py-0.5 text-xs"
                      >
                        {zoneLabel(zone)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {session.effectiveStatus === 'in_progress' ? (
                  <Link
                    href={`/session/${session.id}`}
                    className="mt-3 block rounded-lg bg-accent py-2 text-center text-xs font-medium text-accent-foreground"
                  >
                    Reprendre
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
