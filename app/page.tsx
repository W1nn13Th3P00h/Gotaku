import { createClient } from '@/lib/supabase/server'

/**
 * Écran de socle du lot 0. Pas un écran métier : il ne sert qu'à prouver que la
 * session est établie et que la banque est bien en base. L'accueil décrit par
 * docs/spec.md le remplace au lot 2.
 */
export default async function Home() {
  const supabase = await createClient()

  const [{ data: user }, exercises, zones] = await Promise.all([
    supabase.auth.getUser().then((r) => ({ data: r.data.user })),
    supabase.from('exercises').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('zones').select('code', { count: 'exact', head: true }),
  ])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gokaku</h1>
        <p className="mt-1 text-sm text-muted">Socle en place. Lot 0 terminé.</p>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border">
        <div className="flex items-baseline justify-between p-4">
          <dt className="text-sm text-muted">Session</dt>
          <dd className="text-sm font-medium">{user?.email ?? '—'}</dd>
        </div>
        <div className="flex items-baseline justify-between p-4">
          <dt className="text-sm text-muted">Exercices actifs</dt>
          <dd className="text-sm font-medium">{exercises.count ?? '—'}</dd>
        </div>
        <div className="flex items-baseline justify-between p-4">
          <dt className="text-sm text-muted">Zones au référentiel</dt>
          <dd className="text-sm font-medium">{zones.count ?? '—'}</dd>
        </div>
      </dl>

      {exercises.count === 0 || exercises.count === null ? (
        <p className="text-sm text-muted">
          Banque vide. Lance <code className="font-mono">npm run seed</code>.
        </p>
      ) : null}

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
