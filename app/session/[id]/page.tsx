import { notFound } from 'next/navigation'

import { getSessionForExecution } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

import { SessionPlayerScreen } from '@/app/session/[id]/session-player-screen'

// La séance dépend de l'utilisateur connecté (RLS) et de sa progression en
// base : jamais de réponse mise en cache d'une précédente visite.
export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const session = await getSessionForExecution(supabase, id)

  if (!session) notFound()

  return <SessionPlayerScreen session={session} />
}
