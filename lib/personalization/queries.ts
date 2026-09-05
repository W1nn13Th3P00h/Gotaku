import type { SupabaseClient } from '@supabase/supabase-js'

import type { MobilityFocusCode, PracticeCode, ZoneCode } from '@/lib/referentials'

/**
 * Résolution des zones associées aux réglages de personnalisation (pratique
 * sportive, déficit majeur de mobilité), pour la présélection de la séance
 * personnalisée et la catégorie « Sports »/« Zones de mobilité » des séances
 * programmées du générateur (`app/generateur/generator-screen.tsx`).
 *
 * Un simple calcul en amont : `lib/generator/` ne reçoit toujours qu'une liste
 * de zones déjà résolue, il ignore tout de ces réglages.
 */

/** Zones associées à chaque pratique, via `practice_zones`. */
export async function getPracticeZones(
  supabase: SupabaseClient,
): Promise<Record<PracticeCode, ZoneCode[]>> {
  const { data, error } = await supabase.from('practice_zones').select('practice_code, zone_code')
  if (error) throw error

  const result = {} as Record<PracticeCode, ZoneCode[]>
  for (const row of (data ?? []) as { practice_code: PracticeCode; zone_code: ZoneCode }[]) {
    ;(result[row.practice_code] ??= []).push(row.zone_code)
  }
  return result
}

/** Zones associées à chaque grande zone de mobilité, via `mobility_focus_zones`. */
export async function getMobilityFocusZones(
  supabase: SupabaseClient,
): Promise<Record<MobilityFocusCode, ZoneCode[]>> {
  const { data, error } = await supabase
    .from('mobility_focus_zones')
    .select('focus_code, zone_code')
  if (error) throw error

  const result = {} as Record<MobilityFocusCode, ZoneCode[]>
  for (const row of (data ?? []) as { focus_code: MobilityFocusCode; zone_code: ZoneCode }[]) {
    ;(result[row.focus_code] ??= []).push(row.zone_code)
  }
  return result
}

/**
 * Zones présélectionnées pour la séance personnalisée : union sans doublon des
 * zones du déficit majeur et du sport principal. `[]` si les deux réglages sont
 * absents — comportement inchangé du formulaire libre, sélection manuelle.
 */
export function resolvePersonalizedZones(params: {
  majorDeficitFocus: MobilityFocusCode | null
  mainPractice: PracticeCode | null
  mobilityFocusZones: Record<MobilityFocusCode, ZoneCode[]>
  practiceZones: Record<PracticeCode, ZoneCode[]>
}): ZoneCode[] {
  const { majorDeficitFocus, mainPractice, mobilityFocusZones, practiceZones } = params
  const zones = new Set<ZoneCode>()

  if (majorDeficitFocus !== null) {
    for (const zone of mobilityFocusZones[majorDeficitFocus] ?? []) zones.add(zone)
  }
  if (mainPractice !== null) {
    for (const zone of practiceZones[mainPractice] ?? []) zones.add(zone)
  }

  return [...zones]
}
