import type { SupabaseClient } from '@supabase/supabase-js'

import type { EquipmentCode, MobilityFocusCode, PracticeCode } from '@/lib/referentials'

/**
 * Réglages globaux par utilisateur : matériel disponible, pratiques sportives,
 * sport principal, déficit majeur de mobilité. Un seul réglage par utilisateur,
 * même schéma d'upsert que `lib/push/queries.ts` (reminders).
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

/** Pratiques sportives sélectionnées, `[]` si l'utilisateur n'a jamais réglé. */
export async function getPractices(supabase: SupabaseClient): Promise<PracticeCode[]> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('practices')
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.practices as PracticeCode[] | undefined) ?? []
}

/** Sport principal, `null` si non désigné. */
export async function getMainPractice(supabase: SupabaseClient): Promise<PracticeCode | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('main_practice')
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.main_practice as PracticeCode | null | undefined) ?? null
}

/**
 * Crée ou met à jour les pratiques sportives et le sport principal en une seule
 * écriture : les deux se règlent depuis la même section de l'écran Réglages.
 * `mainPractice` doit appartenir à `practices` (ou être `null`) — validé ici,
 * pas en contrainte SQL, cohérent avec le reste du projet pour ce type de règle.
 */
export async function updatePractices(
  supabase: SupabaseClient,
  practices: PracticeCode[],
  mainPractice: PracticeCode | null,
): Promise<void> {
  if (mainPractice !== null && !practices.includes(mainPractice)) {
    throw new Error('main_practice doit appartenir aux pratiques sélectionnées')
  }

  const { data: existing, error: selectError } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  const payload = {
    practices,
    main_practice: mainPractice,
    updated_at: new Date().toISOString(),
  }

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
  if (!user) throw new Error('updatePractices appelée sans utilisateur authentifié')

  const { error } = await supabase.from('user_settings').insert({ user_id: user.id, ...payload })
  if (error) throw error
}

/** Déficit majeur de mobilité, `null` si l'utilisateur n'a jamais réglé. */
export async function getMajorDeficitFocus(
  supabase: SupabaseClient,
): Promise<MobilityFocusCode | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('major_deficit_focus')
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.major_deficit_focus as MobilityFocusCode | null | undefined) ?? null
}

/** Crée ou met à jour le déficit majeur de mobilité de l'utilisateur courant. */
export async function updateMajorDeficitFocus(
  supabase: SupabaseClient,
  majorDeficitFocus: MobilityFocusCode | null,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('user_settings')
    .select('user_id')
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  const payload = {
    major_deficit_focus: majorDeficitFocus,
    updated_at: new Date().toISOString(),
  }

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
  if (!user) throw new Error('updateMajorDeficitFocus appelée sans utilisateur authentifié')

  const { error } = await supabase.from('user_settings').insert({ user_id: user.id, ...payload })
  if (error) throw error
}
