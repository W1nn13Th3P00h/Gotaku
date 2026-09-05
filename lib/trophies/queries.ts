import type { SupabaseClient } from '@supabase/supabase-js'

import { getCompletedSessionDays } from '@/lib/stats/queries'
import { computeStreak } from '@/lib/stats/streak'
import { evaluateUnlockedTrophies } from '@/lib/trophies/evaluate'

/**
 * IO Supabase pour les trophées (issue #18), même pattern pur/testable que
 * `lib/stats/queries.ts` : la décision (`evaluateUnlockedTrophies`) reste dans
 * `lib/trophies/evaluate.ts`, ce module ne fait que lire/écrire.
 */

type RawUserTrophyRow = { trophy_key: string }

/** Clés déjà débloquées pour l'utilisateur courant (RLS). */
export async function getUnlockedTrophyKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('user_trophies').select('trophy_key')

  if (error) throw error

  return new Set(((data ?? []) as RawUserTrophyRow[]).map((row) => row.trophy_key))
}

export type TrophyProgress = {
  regionSessionCounts: Record<string, number>
  totalVolumeS: number
}

type RawTrophyRegionProgressRow = {
  region_code: string
  region_session_count: number
  total_volume_s: number
}

/** Progression région/volume (RPC `trophy_region_progress`), régions à zéro incluses. */
export async function getTrophyProgress(supabase: SupabaseClient): Promise<TrophyProgress> {
  const { data, error } = await supabase.rpc('trophy_region_progress')

  if (error) throw error

  const rows = (data ?? []) as RawTrophyRegionProgressRow[]
  const regionSessionCounts: Record<string, number> = {}
  let totalVolumeS = 0

  for (const row of rows) {
    regionSessionCounts[row.region_code] = row.region_session_count
    totalVolumeS = row.total_volume_s
  }

  return { regionSessionCounts, totalVolumeS }
}

/**
 * Upsert idempotent — jamais d'erreur si une clé est déjà débloquée
 * (`ignoreDuplicates`), et sans effet sur `unlocked_at` dans ce cas.
 */
export async function unlockTrophies(supabase: SupabaseClient, keys: string[]): Promise<void> {
  if (keys.length === 0) return

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('unlockTrophies appelée sans utilisateur authentifié')

  const { error } = await supabase
    .from('user_trophies')
    .upsert(
      keys.map((key) => ({ user_id: user.id, trophy_key: key })),
      { onConflict: 'user_id, trophy_key', ignoreDuplicates: true },
    )

  if (error) throw error
}

/**
 * Orchestration post-séance (appelée depuis `session-player-screen.tsx` juste
 * après `completeSession`) : récupère la progression, évalue les trophées
 * atteints, et ne pousse en base que les clés pas encore débloquées.
 */
export async function evaluateAndUnlockTrophies(supabase: SupabaseClient): Promise<void> {
  const [completedDays, progress, alreadyUnlocked] = await Promise.all([
    getCompletedSessionDays(supabase),
    getTrophyProgress(supabase),
    getUnlockedTrophyKeys(supabase),
  ])

  const streakDays = computeStreak(completedDays, new Date())

  const unlocked = evaluateUnlockedTrophies({
    streakDays,
    regionSessionCounts: progress.regionSessionCounts,
    totalVolumeS: progress.totalVolumeS,
  })

  const newlyUnlocked = unlocked.filter((key) => !alreadyUnlocked.has(key))

  await unlockTrophies(supabase, newlyUnlocked)
}
