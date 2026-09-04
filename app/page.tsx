import Link from 'next/link'

import { buttonClasses } from '@/components/ui/button'
import { Card, CardList, CardListItem } from '@/components/ui/card'
import { Page, PageHeader } from '@/components/ui/page'
import { formatDurationShort } from '@/lib/format'
import { getReminder } from '@/lib/push/queries'
import { nextReminderLabel } from '@/lib/reminders/next'
import { getLastCompletedSession, getResumableSessionsToday } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

// Séances reprenables, dernière séance et rappel dépendent de l'utilisateur
// connecté (RLS) et de sa progression du jour : jamais de réponse mise en cache.
export const dynamic = 'force-dynamic'

/** Accès secondaires, dans l'ordre imposé par `docs/spec.md` § Accueil. */
const LINKS = [
  { href: '/compose/templates', label: 'Modèles', hint: 'Séances sauvegardées' },
  { href: '/bank', label: 'Banque', hint: 'Consulter et composer' },
  { href: '/history', label: 'Historique', hint: 'Séances et synthèse 30 jours' },
  { href: '/settings', label: 'Réglages', hint: 'Rappel et notifications' },
] as const

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

/**
 * Accueil (`docs/spec.md` § Accueil) : un bouton de génération dominant, le
 * prochain rappel, la dernière séance, puis les accès modèles / banque /
 * historique. Rien d'autre — la déconnexion vit dans les réglages.
 *
 * La reprise d'une séance du jour passe devant le reste : c'est le seul cas où
 * l'utilisateur n'est pas venu pour générer (`docs/spec.md` § Exécution).
 */
export default async function Home() {
  const supabase = await createClient()
  const [resumableSessions, lastSession, reminder] = await Promise.all([
    getResumableSessionsToday(supabase),
    getLastCompletedSession(supabase),
    getReminder(supabase),
  ])

  const nextReminder = nextReminderLabel(reminder, new Date())

  return (
    <Page className="flex min-h-dvh flex-col gap-8">
      <PageHeader title="Gokaku" subtitle="Mobilité et étirements." />

      {resumableSessions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Séance en cours</h2>
          {resumableSessions.map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-accent p-4 transition-transform duration-150 active:scale-[0.99]"
            >
              <span className="text-sm font-medium">
                Reprendre · {session.exerciseCount} exercice
                {session.exerciseCount > 1 ? 's' : ''}
              </span>
              <span aria-hidden="true" className="text-accent">
                →
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      <Link
        href="/generateur"
        className={buttonClasses({
          variant: 'primary',
          size: 'lg',
          block: true,
          className: 'min-h-20 text-lg',
        })}
      >
        Générer une séance
      </Link>

      {/*
        Deux repères, pas un tableau de bord : ce qui vient (le rappel) et ce
        qui précède (la dernière séance).
      */}
      <Card className="flex flex-col gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted">Prochain rappel</span>
          {nextReminder ? (
            <span className="text-right font-medium">{nextReminder}</span>
          ) : (
            <Link href="/settings" className="font-medium text-accent">
              À régler
            </Link>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted">Dernière séance</span>
          <span className="text-right font-medium">
            {lastSession
              ? `${formatSessionDate(lastSession.date)}${
                  lastSession.actualDurationS !== null
                    ? ` · ${formatDurationShort(lastSession.actualDurationS)}`
                    : ''
                }`
              : 'Aucune'}
          </span>
        </div>
      </Card>

      <nav className="mt-auto">
        <CardList>
          {LINKS.map((link) => (
            <CardListItem key={link.href} className="p-0">
              <Link
                href={link.href}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 active:bg-subtle"
              >
                <span>
                  <span className="block text-sm font-medium">{link.label}</span>
                  <span className="block text-xs text-muted">{link.hint}</span>
                </span>
                <span aria-hidden="true" className="text-muted">
                  →
                </span>
              </Link>
            </CardListItem>
          ))}
        </CardList>
      </nav>
    </Page>
  )
}
