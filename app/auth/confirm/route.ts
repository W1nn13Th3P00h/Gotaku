import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Point d'atterrissage du lien magique.
 *
 * Deux formes de lien sont acceptées :
 *
 *   - `?token_hash=…&type=magiclink` : forme recommandée côté serveur. Elle suppose
 *     que le template d'email Supabase pointe sur cette route avec `{{ .TokenHash }}`.
 *     Voir la section Auth du README.
 *   - `?code=…` : flux PKCE, échangé contre une session.
 *
 * Sans l'un des deux, on renvoie sur /login : un lien expiré ne doit pas produire
 * une page cassée.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = searchParams.get('next')
  const target = new URL(next?.startsWith('/') ? next : '/', origin)

  const supabase = await createClient()

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(target)
    return redirectToLogin(origin, error.message)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(target)
    return redirectToLogin(origin, error.message)
  }

  return redirectToLogin(origin, 'Lien de connexion incomplet ou expiré.')
}

function redirectToLogin(origin: string, message: string) {
  const url = new URL('/login', origin)
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}
