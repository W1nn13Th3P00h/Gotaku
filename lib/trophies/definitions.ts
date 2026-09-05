import { REGIONS, type RegionCode } from '@/lib/referentials'

/**
 * Référentiel fermé des trophées (issue #18), miroir exact de
 * `docs/data-model.md` § Trophées. Module pur, aucune IO : `lib/trophies/queries.ts`
 * lit/écrit en base à partir de ces clés, `lib/trophies/evaluate.ts` décide
 * lesquelles sont débloquées.
 *
 * `threshold` est dans l'unité de la famille : jours pour `streak`, séances
 * pour `region`, secondes pour `volume` (aligné sur `actual_duration_s`).
 */

export type TrophyFamily = 'streak' | 'region' | 'volume'

export type TrophyDefinition = {
  key: string
  family: TrophyFamily
  threshold: number
  label?: string
  region?: RegionCode
}

type Tier = { threshold: number; label: string }

/** Six paliers bronze → maître, communs aux familles streak et région. */
const TIER_LABELS = ['bronze', 'argent', 'or', 'platine', 'diamant', 'maître'] as const

const STREAK_TIERS: Tier[] = [7, 30, 100, 200, 500, 1000].map((threshold, i) => ({
  threshold,
  label: TIER_LABELS[i] as string,
}))

const REGION_TIERS: Tier[] = [10, 50, 100, 200, 500, 1000].map((threshold, i) => ({
  threshold,
  label: TIER_LABELS[i] as string,
}))

/** Volume horaire total : 100h à 1000h par pas de 100h, pas de label. */
const VOLUME_TIERS_HOURS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

const streakDefinitions: TrophyDefinition[] = STREAK_TIERS.map((tier) => ({
  key: `streak_${tier.threshold}`,
  family: 'streak',
  threshold: tier.threshold,
  label: tier.label,
}))

const regionDefinitions: TrophyDefinition[] = REGIONS.flatMap((region) =>
  REGION_TIERS.map((tier) => ({
    key: `region_${region.code}_${tier.threshold}`,
    family: 'region' as const,
    threshold: tier.threshold,
    label: tier.label,
    region: region.code,
  })),
)

const volumeDefinitions: TrophyDefinition[] = VOLUME_TIERS_HOURS.map((hours) => ({
  key: `volume_${hours}`,
  family: 'volume',
  threshold: hours * 3600,
}))

/** Liste figée, générée une fois ici — jamais recalculée ailleurs. 6 + 54 + 10 = 70 trophées. */
export const TROPHY_DEFINITIONS: TrophyDefinition[] = [
  ...streakDefinitions,
  ...regionDefinitions,
  ...volumeDefinitions,
]
