import { TROPHY_DEFINITIONS, type TrophyDefinition } from '@/lib/trophies/definitions'

/**
 * Module pur (issue #18) : aucune IO, aucune source de temps propre — le streak
 * et le volume sont déjà calculés en amont (`lib/stats/streak.ts`,
 * `lib/trophies/queries.ts`) et injectés ici.
 */

export type TrophyProgressInput = {
  streakDays: number
  regionSessionCounts: Record<string, number>
  totalVolumeS: number
}

function isUnlocked(def: TrophyDefinition, input: TrophyProgressInput): boolean {
  switch (def.family) {
    case 'streak':
      return input.streakDays >= def.threshold
    case 'region': {
      const count = def.region ? (input.regionSessionCounts[def.region] ?? 0) : 0
      return count >= def.threshold
    }
    case 'volume':
      return input.totalVolumeS >= def.threshold
  }
}

/**
 * Toutes les clés de trophée dont le seuil est atteint ou dépassé — pas
 * seulement le dernier franchi : un saut (ex. plusieurs semaines sans connexion
 * puis un volume qui franchit deux paliers d'un coup) doit faire ressortir
 * chaque palier intermédiaire.
 */
export function evaluateUnlockedTrophies(input: TrophyProgressInput): string[] {
  return TROPHY_DEFINITIONS.filter((def) => isUnlocked(def, input)).map((def) => def.key)
}
