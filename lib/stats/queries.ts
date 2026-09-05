import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lecture pour l'écran `/stats` (issue #15) : streak et volume hebdomadaire.
 * Écran séparé de l'Historique, qui reste un historique de séances.
 */

type RawCompletedSessionRow = {
  completed_at: string
}

/**
 * Dates (`completed_at`) de toutes les séances `completed` de l'utilisateur
 * (RLS), pour alimenter `computeStreak`. Triées décroissant.
 */
export async function getCompletedSessionDays(supabase: SupabaseClient): Promise<Date[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as RawCompletedSessionRow[])
    .filter((row): row is { completed_at: string } => row.completed_at !== null)
    .map((row) => new Date(row.completed_at))
}

export type WeeklyVolume = {
  weekStart: string
  totalVolumeS: number
}

type RawWeeklyVolumeRow = {
  week_start: string
  total_volume_s: number
}

/** Volume horaire semaine par semaine (RPC `session_weekly_volume`), zero-fill inclus. */
export async function getWeeklyVolume(
  supabase: SupabaseClient,
  weeks = 12,
): Promise<WeeklyVolume[]> {
  const { data, error } = await supabase.rpc('session_weekly_volume', { weeks })

  if (error) throw error

  return ((data ?? []) as RawWeeklyVolumeRow[]).map((row) => ({
    weekStart: row.week_start,
    totalVolumeS: row.total_volume_s,
  }))
}
