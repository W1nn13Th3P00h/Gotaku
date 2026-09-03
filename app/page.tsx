import Link from 'next/link'

/** Accueil (`docs/spec.md`). Rappel/historique/modèles viendront avec les lots suivants. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gokaku</h1>
        <p className="mt-1 text-sm text-muted">Mobilité et étirements.</p>
      </div>

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
