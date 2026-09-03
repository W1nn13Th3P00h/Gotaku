import type { SupabaseClient } from '@supabase/supabase-js'

import { clampDurationS, computeTotalDurationS } from '@/lib/sessions/composition'

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

/**
 * Écritures de composition et de modèles (Lot 4) — voir
 * `specs/003-manual-session-templates/contracts/composition.md`. Une
 * composition en cours est une `sessions` `draft`/`manual` (Lot 4,
 * `getOrCreateDraftComposition`) ; tant qu'elle reste `draft`,
 * `target_duration_s` est tenu à jour par ces mutations pour refléter la
 * durée totale réellement composée (voir `syncTargetDuration`).
 */

/** Recalcule et réécrit `sessions.target_duration_s` depuis les `session_items` actuels. */
async function syncTargetDuration(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('session_items')
    .select('duration_s, per_side')
    .eq('session_id', sessionId)

  if (error) throw error

  const totalDurationS = computeTotalDurationS(
    (data ?? []).map((row) => ({ durationS: row.duration_s, perSide: row.per_side })),
  )

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ target_duration_s: totalDurationS })
    .eq('id', sessionId)

  if (updateError) throw updateError
}

/**
 * Ajoute un exercice à la composition, à la fin (`ord = max(ord) + 1`), avec sa
 * durée cible par défaut. Aucune contrainte d'unicité : un même exercice peut
 * apparaître plusieurs fois (FR-007).
 */
export async function addItemToComposition(
  supabase: SupabaseClient,
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  const { data: exercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('duration_target_s, symmetry')
    .eq('id', exerciseId)
    .single()

  if (exerciseError) throw exerciseError

  const { data: lastItem, error: lastItemError } = await supabase
    .from('session_items')
    .select('ord')
    .eq('session_id', sessionId)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastItemError) throw lastItemError

  const { error: insertError } = await supabase.from('session_items').insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    ord: (lastItem?.ord ?? -1) + 1,
    duration_s: exercise.duration_target_s,
    per_side: exercise.symmetry === 'asymmetric',
  })

  if (insertError) throw insertError

  await syncTargetDuration(supabase, sessionId)
}

/** Retire un item de la composition ; l'ordre relatif des autres items suffit, `ord` n'est pas renuméroté. */
export async function removeItemFromComposition(
  supabase: SupabaseClient,
  itemId: string,
): Promise<void> {
  const { data: item, error: fetchError } = await supabase
    .from('session_items')
    .select('session_id')
    .eq('id', itemId)
    .single()

  if (fetchError) throw fetchError

  const { error: deleteError } = await supabase.from('session_items').delete().eq('id', itemId)
  if (deleteError) throw deleteError

  await syncTargetDuration(supabase, item.session_id)
}

/**
 * Réécrit `ord` selon l'ordre fourni. Deux passes (ord temporaires négatifs
 * puis définitifs) pour ne jamais heurter la contrainte unique
 * `(session_id, ord)`, qui n'est pas déferrable en base.
 */
export async function reorderItems(
  supabase: SupabaseClient,
  sessionId: string,
  orderedItemIds: string[],
): Promise<void> {
  for (const [index, itemId] of orderedItemIds.entries()) {
    const { error } = await supabase
      .from('session_items')
      .update({ ord: -(index + 1) })
      .eq('id', itemId)
      .eq('session_id', sessionId)
    if (error) throw error
  }

  for (const [index, itemId] of orderedItemIds.entries()) {
    const { error } = await supabase
      .from('session_items')
      .update({ ord: index })
      .eq('id', itemId)
      .eq('session_id', sessionId)
    if (error) throw error
  }
}

/**
 * Ajuste la durée retenue pour un item, toujours ramenée dans la plage de son
 * exercice par `clampDurationS` (FR-005) : jamais la valeur brute demandée.
 */
export async function updateItemDuration(
  supabase: SupabaseClient,
  itemId: string,
  requestedS: number,
): Promise<void> {
  const { data: item, error: fetchError } = await supabase
    .from('session_items')
    .select('session_id, exercises ( duration_min_s, duration_max_s )')
    .eq('id', itemId)
    .single()

  if (fetchError) throw fetchError

  const exercise = item.exercises as unknown as {
    duration_min_s: number
    duration_max_s: number
  } | null
  if (!exercise) throw new Error(`item ${itemId} sans exercice rattaché`)

  const clamped = clampDurationS(
    { durationMinS: exercise.duration_min_s, durationMaxS: exercise.duration_max_s },
    requestedS,
  )

  const { error: updateError } = await supabase
    .from('session_items')
    .update({ duration_s: clamped })
    .eq('id', itemId)

  if (updateError) throw updateError

  await syncTargetDuration(supabase, item.session_id)
}

export type SaveAsTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; reason: 'EMPTY_NAME' | 'EMPTY_COMPOSITION' }

/**
 * Copie les `session_items` actuels de la composition vers un nouveau modèle
 * nommé (`session_templates`/`template_items`) — une copie, pas une référence
 * (US2 #4, `research.md` § Sauvegarde comme modèle). Refuse un nom vide/espaces
 * (FR-011) ou une composition vide (FR-009).
 */
export async function saveAsTemplate(
  supabase: SupabaseClient,
  sessionId: string,
  name: string,
): Promise<SaveAsTemplateResult> {
  const trimmedName = name.trim()
  if (!trimmedName) return { ok: false, reason: 'EMPTY_NAME' }

  const { data: items, error: itemsError } = await supabase
    .from('session_items')
    .select('exercise_id, ord, duration_s, per_side')
    .eq('session_id', sessionId)
    .order('ord', { ascending: true })

  if (itemsError) throw itemsError
  if (!items || items.length === 0) return { ok: false, reason: 'EMPTY_COMPOSITION' }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('saveAsTemplate appelée sans utilisateur authentifié')

  const { data: template, error: insertError } = await supabase
    .from('session_templates')
    .insert({ user_id: user.id, name: trimmedName })
    .select('id')
    .single()

  if (insertError) throw insertError

  const { error: templateItemsError } = await supabase.from('template_items').insert(
    items.map((item) => ({
      template_id: template.id,
      exercise_id: item.exercise_id,
      ord: item.ord,
      duration_s: item.duration_s,
      per_side: item.per_side,
    })),
  )

  if (templateItemsError) throw templateItemsError

  return { ok: true, templateId: template.id }
}

/**
 * Crée une nouvelle séance (`source: 'template'`) à partir d'un modèle : copie
 * les `template_items` en `session_items` (nouvel instantané, indépendant
 * d'une modification ultérieure du modèle, FR-014/US3 #3), puis démarre
 * l'exécution (`startSession`, Lot 3).
 */
export async function startSessionFromTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<{ sessionId: string }> {
  const { data: templateItems, error: templateItemsError } = await supabase
    .from('template_items')
    .select('exercise_id, ord, duration_s, per_side')
    .eq('template_id', templateId)
    .order('ord', { ascending: true })

  if (templateItemsError) throw templateItemsError
  if (!templateItems || templateItems.length === 0) {
    throw new Error(`modèle ${templateId} vide ou introuvable`)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('startSessionFromTemplate appelée sans utilisateur authentifié')

  const totalDurationS = computeTotalDurationS(
    templateItems.map((item) => ({ durationS: item.duration_s, perSide: item.per_side })),
  )

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      status: 'draft',
      source: 'template',
      target_duration_s: totalDurationS,
      seed: 0,
    })
    .select('id')
    .single()

  if (sessionError) throw sessionError

  const { error: itemsInsertError } = await supabase.from('session_items').insert(
    templateItems.map((item) => ({
      session_id: session.id,
      exercise_id: item.exercise_id,
      ord: item.ord,
      duration_s: item.duration_s,
      per_side: item.per_side,
    })),
  )

  if (itemsInsertError) throw itemsInsertError

  await startSession(supabase, session.id)

  return { sessionId: session.id }
}
