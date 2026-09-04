import type { SupabaseClient } from '@supabase/supabase-js'

import type { EquipmentCode } from '@/lib/referentials'

/**
 * Réglages globaux par utilisateur (v1 : matériel disponible uniquement). Un seul
 * réglage par utilisateur, même schéma d'upsert que `lib/push/queries.ts` (reminders).
 */

/** Matériel disponible par défaut, `[]` si l'utilisateur n'a jamais réglé. */
export async function getAvailableEquipment(supabase: SupabaseClient): Promise<EquipmentCode[]> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('available_equipment')
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.available_equipment as EquipmentCode[] | undefined) ?? []
}

/** Crée ou met à jour le réglage matériel de l'utilisateur courant. */
export async function updateAvailableEquipment(
  supabase: SupabaseClient,
  equipment: EquipmentCode[],
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  const payload = { available_equipment: equipment, updated_at: new Date().toISOString() }

  if (existing) {
    const { error } = await supabase
      .from('user_settings')
      .update(payload)
      .eq('user_id', existing.user_id)
    if (error) throw error
    return
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('updateAvailableEquipment appelée sans utilisateur authentifié')

  const { error } = await supabase.from('user_settings').insert({ user_id: user.id, ...payload })
  if (error) throw error
}
