'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormMessage, inputClasses } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'

type State = { kind: 'idle' } | { kind: 'signing' } | { kind: 'error'; message: string }

/** Messages Supabase traduits. Le reste passe tel quel, plutôt que d'être masqué. */
function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Adresse ou mot de passe incorrect.'
  if (/email not confirmed/i.test(message)) return 'Adresse non confirmée côté Supabase.'
  if (/too many requests|rate limit/i.test(message)) return 'Trop de tentatives, réessaie dans une minute.'
  return message
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!email || !password) return

    setState({ kind: 'signing' })

    const { error } = await createClient().auth.signInWithPassword({ email, password })

    if (error) {
      setState({ kind: 'error', message: translate(error.message) })
      return
    }

    // replace et non push : la page de connexion n'a rien à faire dans l'historique.
    router.replace(next?.startsWith('/') ? next : '/')
    // Vide le cache du router client, sinon le premier rendu réutilise la version
    // rendue sans session.
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        required
        placeholder="Adresse"
        aria-label="Adresse"
        className={inputClasses}
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        className={inputClasses}
      />
      <Button type="submit" variant="primary" size="lg" block disabled={state.kind === 'signing'}>
        {state.kind === 'signing' ? 'Connexion…' : 'Se connecter'}
      </Button>
      {state.kind === 'error' ? <FormMessage kind="error">{state.message}</FormMessage> : null}
    </form>
  )
}
