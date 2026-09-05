import { getReminders } from '@/lib/push/queries'
import {
  getAvailableEquipment,
  getMainPractice,
  getMajorDeficitFocus,
  getPractices,
} from '@/lib/settings/queries'
import { createClient } from '@/lib/supabase/server'

import { SettingsScreen } from '@/app/settings/settings-screen'

// Les rappels et les réglages dépendent de l'utilisateur connecté (RLS) : jamais de
// réponse mise en cache d'un précédent visiteur.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Réglages — Gokaku' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const reminders = await getReminders(supabase)
  const availableEquipment = await getAvailableEquipment(supabase)
  const practices = await getPractices(supabase)
  const mainPractice = await getMainPractice(supabase)
  const majorDeficitFocus = await getMajorDeficitFocus(supabase)

  return (
    <SettingsScreen
      reminders={reminders}
      availableEquipment={availableEquipment}
      practices={practices}
      mainPractice={mainPractice}
      majorDeficitFocus={majorDeficitFocus}
    />
  )
}
