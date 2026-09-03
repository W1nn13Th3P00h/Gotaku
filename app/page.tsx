import Link from 'next/link'

import { getResumableSessionsToday } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

// Les séances reprenables dépendent de l'utilisateur connecté (RLS) et de sa
// progression du jour : jamais de réponse mise en cache.
export const dynamic = 'force-dynamic'

/**
 * Accueil (`docs/spec.md`). Rappel/modèles viendront avec les lots suivants.
 *
 * La section « Séances en cours » ci-dessous est un emplacement provisoire
 * (Lot 3) : elle vit ici en attendant l'écran Accueil réel de `docs/spec.md`,
 * comme prévu par `tasks.md` (T020).
 */
export default async function Home() {
  const supabase = await createClient()
  const resumableSessions = await getResumableSessionsToday(supabase)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gokaku</h1>
        <p className="mt-1 text-sm text-muted">Mobilité et étirements.</p>
      </div>

      {resumableSessions.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium">Séances en cours</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {resumableSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/session/${session.id}`}
                  className="block rounded-lg border border-border p-4 text-sm font-medium"
                >
                  Reprendre la séance ({session.exerciseCount} exercice
                  {session.exerciseCount > 1 ? 's' : ''})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href="/generateur"
        className="w-full rounded-lg bg-accent py-4 text-center text-base font-medium text-accent-foreground"
      >
        Générer une séance
      </Link>

      <Link
        href="/bank"
        className="w-full rounded-lg border border-border py-3 text-center text-sm font-medium"
      >
        Banque d&apos;exercices
      </Link>

      <Link
        href="/history"
        className="w-full rounded-lg border border-border py-3 text-center text-sm font-medium"
      >
        Historique
      </Link>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded-lg border border-border py-3 text-sm font-medium"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  )
}
