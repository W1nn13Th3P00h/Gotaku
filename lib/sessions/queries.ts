import type { ItemStatus } from '@/lib/session-player/types'
import type { ZoneCode } from '@/lib/referentials'

/**
 * Lecture pour l'exécution (Lot 3) : une séance déjà créée par ailleurs (Lot 2/4),
 * chargée avec ses items et les champs d'affichage de leur exercice.
 * Voir `specs/002-session-execution-history/contracts/sessions-queries.md`.
 */

export type SessionExecutionItem = {
  id: string
  exerciseId: string
  ord: number
  durationS: number
  perSide: boolean
  status: ItemStatus
  exercise: {
    name: string
    instructions: string[]
    primaryZone: ZoneCode
    zones: ZoneCode[]
  }
}

export type SessionForExecution = {
  id: string
  targetDurationS: number
  startedAt: string | null
  items: SessionExecutionItem[]
}

/** Statut effectif, calculé (jamais stocké) — voir `data-model.md` § Statut effectif. */
export type EffectiveStatus = 'completed' | 'in_progress' | 'abandoned'

export type HistorySessionRow = {
  id: string
  /** `completed_at` si la séance est terminée, `started_at` sinon. */
  date: string
  actualDurationS: number | null
  exerciseCount: number
  zonesWorked: ZoneCode[]
  effectiveStatus: EffectiveStatus
}

/** Une ligne par zone du référentiel — voir `getHistorySummary30d` (Phase 5). */
export type HistorySummary30d = {
  zoneCode: ZoneCode
  secondsWorked: number
  sessionCount: number
  totalVolumeS: number
}
