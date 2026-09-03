import { getReminder } from '@/lib/push/queries'
import { createClient } from '@/lib/supabase/server'

import { SettingsScreen } from '@/app/settings/settings-screen'

// Le rappel dépend de l'utilisateur connecté (RLS) : jamais de réponse mise en
// cache d'un précédent visiteur.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Réglages — Gokaku' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const reminder = await getReminder(supabase)

  return <SettingsScreen reminder={reminder} />
}
