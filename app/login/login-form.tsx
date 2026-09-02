'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = new FormData(event.currentTarget).get('email')
    if (typeof email !== 'string' || !email.trim()) return

    setState({ kind: 'sending' })

    const redirect = new URL('/auth/confirm', window.location.origin)
    if (next) redirect.searchParams.set('next', next)

    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirect.toString(),
        // Application mono-utilisateur : personne ne s'inscrit après le premier compte.
        shouldCreateUser: false,
      },
    })

    setState(error ? { kind: 'error', message: error.message } : { kind: 'sent' })
  }

  if (state.kind === 'sent') {
    return (
      <p className="rounded-xl border border-border p-4 text-sm">
        Lien envoyé. Ouvre-le depuis ce téléphone, sinon la session s&apos;ouvrira sur le
        mauvais appareil.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="adresse@exemple.fr"
        className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={state.kind === 'sending'}
        className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {state.kind === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
      </button>
      {state.kind === 'error' ? (
        <p className="text-sm text-muted" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
