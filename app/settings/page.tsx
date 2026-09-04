import { getReminders } from '@/lib/push/queries'
import { getAvailableEquipment } from '@/lib/settings/queries'
import { createClient } from '@/lib/supabase/server'

import { SettingsScreen } from '@/app/settings/settings-screen'

// Les rappels et le matériel dépendent de l'utilisateur connecté (RLS) : jamais de
// réponse mise en cache d'un précédent visiteur.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Réglages — Gokaku' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const reminders = await getReminders(supabase)
  const availableEquipment = await getAvailableEquipment(supabase)

  return <SettingsScreen reminders={reminders} availableEquipment={availableEquipment} />
}
