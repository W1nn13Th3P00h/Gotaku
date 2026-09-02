import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/**
 * Protection globale des routes.
 *
 * `proxy.ts` remplace `middleware.ts` depuis Next 16. Il tourne toujours sur le
 * runtime Node.js, et n'accepte pas de route segment config.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Tout, sauf les fichiers statiques et les images. Les pages publiques sont
     * filtrées dans updateSession, pas ici : le rafraîchissement de session doit
     * courir même sur /login.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
