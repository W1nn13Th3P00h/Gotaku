import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env'

/**
 * Client Supabase côté serveur, adossé aux cookies de la requête.
 *
 * À recréer à chaque usage : le store de cookies est lié à la requête en cours et
 * ne se partage pas entre deux requêtes.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le rafraîchissement de session est assuré par proxy.ts, ignorer est correct.
        }
      },
    },
  })
}
