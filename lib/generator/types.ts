import type {
  BodyPosition,
  EquipmentCode,
  ExerciseType,
  SymmetryType,
  ZoneCode,
} from '@/lib/referentials'

/**
 * Module pur : aucune dépendance à React, Supabase, `Date.now()` ou `Math.random()`.
 * Tout ce qui varie (l'instant de référence, la seed, le catalogue, l'historique)
 * est injecté par l'appelant.
 */

export type ExerciseId = string

/**
 * Vue exercice consommée par le générateur. Les noms de champs de coût et de durée
 * reprennent volontairement ceux de `docs/generator.md` (`duration_target_s`, etc.)
 * puisque les formules de l'algorithme y sont écrites telles quelles.
 */
export type Exercise = {
  id: ExerciseId
  slug: string
  type: ExerciseType
  position: BodyPosition
  symmetry: SymmetryType
  zones: ZoneCode[]
  primary_zone: ZoneCode
  equipment: EquipmentCode[]
  intensity: 1 | 2 | 3
  duration_target_s: number
  duration_min_s: number
  duration_max_s: number
  active: boolean
}

export type GeneratorInput = {
  targetDurationS: number
  zones: ZoneCode[]
  equipment: EquipmentCode[]
  excludedTypes?: ExerciseType[]
  requiredTypes?: ExerciseType[]
  maxIntensity?: 1 | 2 | 3
  preferNeglectedZones?: boolean
  /** Écart accepté sur la durée totale finale (étape 5). Défaut : `TOLERANCE_S`. */
  toleranceS?: number
}

export type GeneratorContext = {
  catalog: Exercise[]
  lastPerformed: Map<ExerciseId, Date>
  zoneVolume30d: Map<ZoneCode, number>
  now: Date
  seed: number
}

export type SessionItem = {
  exerciseId: ExerciseId
  ord: number
  durationS: number
  perSide: boolean
}

export type ZoneCoverage = {
  zone: ZoneCode
  exerciseCount: number
  allocatedS: number
}

export type FailureReason = 'EMPTY_CATALOG' | 'BUDGET_TOO_SMALL' | 'ZONES_UNSERVABLE'

export type FailureDetail =
  | {
      reason: 'EMPTY_CATALOG'
      /** Contrainte dont le relâchement, seul, ferait réapparaître des candidats. */
      dominantCause: 'equipment' | 'zones' | 'both'
      message: string
    }
  | {
      reason: 'BUDGET_TOO_SMALL'
      minViableDurationS: number
    }
  | {
      reason: 'ZONES_UNSERVABLE'
      servableCount: number
      droppedZones: ZoneCode[]
    }

export type GeneratorResult =
  | {
      ok: true
      items: SessionItem[]
      totalDurationS: number
      coverage: ZoneCoverage[]
      /**
       * Types de `requiredTypes` pour lesquels aucun candidat n'était disponible
       * dans le budget. Non bloquant : « signalé dans le résultat » (étape 4).
       */
      unmetRequiredTypes: ExerciseType[]
    }
  | {
      ok: false
      reason: FailureReason
      detail: FailureDetail
    }
