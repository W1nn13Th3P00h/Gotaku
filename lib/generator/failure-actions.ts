import type { FailureDetail, GeneratorInput } from '@/lib/generator/types'

/**
 * Module pur, même règle que le reste de `lib/generator/` : aucune dépendance à
 * React, Supabase, `Date.now()` ou `Math.random()`. Contrat :
 * `specs/005-generator-comfort/contracts/failure-actions.md`.
 *
 * Ne relance jamais la génération elle-même : c'est à l'appelant d'utiliser
 * l'input retourné pour appeler `generateSession`. Ne modifie jamais `current` en
 * place.
 */
export function suggestRecovery(
  detail: FailureDetail,
  current: GeneratorInput,
  durationPresetsMin: readonly number[],
): GeneratorInput | null {
  switch (detail.reason) {
    case 'ZONES_UNSERVABLE': {
      const dropped = new Set(detail.droppedZones)
      const zones = current.zones.filter((z) => !dropped.has(z))
      if (zones.length === 0) return null
      return { ...current, zones }
    }
    case 'BUDGET_TOO_SMALL': {
      const sortedMin = [...durationPresetsMin].sort((a, b) => a - b)
      const minViableS = detail.minViableDurationS
      const next = sortedMin.find((min) => min * 60 >= minViableS)
      const chosenMin = next ?? sortedMin[sortedMin.length - 1]
      if (chosenMin === undefined) return null
      return { ...current, targetDurationS: chosenMin * 60 }
    }
    case 'EMPTY_CATALOG': {
      if (detail.dominantCause === 'zones') return null
      return { ...current, equipment: [] }
    }
  }
}
