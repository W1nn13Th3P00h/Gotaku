/**
 * Module pur, sans alias `@/` (voir `contracts/reminders-logic.md`) : importé
 * tel quel par `supabase/functions/send-reminders/index.ts` (Deno) et par
 * Vitest, chemin relatif dans les deux cas.
 *
 * Sépare une décision testable sans réseau (la classification) de son
 * application (l'écriture en base, qui dépend de Supabase et reste la
 * responsabilité exclusive de l'Edge Function).
 */

export type SendOutcome = { kind: 'success' } | { kind: 'failure'; httpStatus: number }

export type SubscriptionFailureAction = { action: 'delete' | 'increment' | 'reset' }

/** Abandon après ce nombre d'échecs consécutifs (FR-013). */
const MAX_CONSECUTIVE_FAILURES = 5

const GONE_STATUSES = new Set([404, 410])

/** Voir `contracts/reminders-logic.md` § nextSubscriptionState. */
export function nextSubscriptionState(
  currentFailureCount: number,
  outcome: SendOutcome,
): SubscriptionFailureAction {
  if (outcome.kind === 'success') return { action: 'reset' }

  if (GONE_STATUSES.has(outcome.httpStatus)) return { action: 'delete' }

  if (currentFailureCount + 1 >= MAX_CONSECUTIVE_FAILURES) return { action: 'delete' }

  return { action: 'increment' }
}
