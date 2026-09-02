import { Suspense } from 'react'

import { LoginForm } from '@/app/login/login-form'

export const metadata = { title: 'Connexion — Gokaku' }

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gokaku</h1>
        <p className="mt-1 text-sm text-muted">
          Un lien de connexion arrive par mail. Pas de mot de passe.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
