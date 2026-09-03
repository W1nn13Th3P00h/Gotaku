import { getOrCreateDraftComposition } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

import { ComposeScreen } from '@/app/compose/compose-screen'

// La composition dépend de l'utilisateur connecté (RLS) et de sa progression
// en base : jamais de réponse mise en cache d'une précédente visite.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Composition — Gokaku' }

export default async function ComposePage() {
  const supabase = await createClient()
  const composition = await getOrCreateDraftComposition(supabase)

  return <ComposeScreen composition={composition} />
}
