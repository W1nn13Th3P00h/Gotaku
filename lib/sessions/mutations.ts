import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Écritures de progression pour l'exécution (Lot 3), au fil de l'eau (voir
 * `research.md` § Persistance de la progression). Aucune fonction ici n'écrit
 * jamais `status: 'abandoned'` (voir `research.md`), ni ne modifie
 * `session_items.duration_s`/`per_side`/`ord`/`exercise_id` (snapshots posés à
 * la création de la séance, Lot 2, Constitution Principe IV).
 * Voir `specs/002-session-execution-history/contracts/sessions-queries.md`.
 */

/** Écrit `status: 'in_progress'`, `started_at: now()` si absent. Sans effet si déjà démarrée. */
export async function startSession(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('started_at', null)

  if (error) throw error
}

export async function markItemDone(supabase: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await supabase.from('session_items').update({ status: 'done' }).eq('id', itemId)
  if (error) throw error
}

export async function markItemSkipped(supabase: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('session_items')
    .update({ status: 'skipped' })
    .eq('id', itemId)

  if (error) throw error
}

/** Utilisé par l'action « revenir » (voir `contracts/session-player.md`). */
export async function revertItemToPending(supabase: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('session_items')
    .update({ status: 'pending' })
    .eq('id', itemId)

  if (error) throw error
}

export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string,
  { actualDurationS }: { actualDurationS: number },
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_duration_s: actualDurationS,
    })
    .eq('id', sessionId)

  if (error) throw error
}
