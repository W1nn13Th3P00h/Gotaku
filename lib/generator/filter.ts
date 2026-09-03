import type { EquipmentCode, ExerciseType, ZoneCode } from '@/lib/referentials'
import type { Exercise } from '@/lib/generator/types'

export type FilterOptions = {
  zones: ZoneCode[]
  equipment: EquipmentCode[]
  excludedTypes?: ExerciseType[]
  maxIntensity?: 1 | 2 | 3
  /** Ignore la contrainte de matériel, pour diagnostiquer un `EMPTY_CATALOG`. */
  skipEquipment?: boolean
  /** Ignore la contrainte de zones, pour diagnostiquer un `EMPTY_CATALOG`. */
  skipZones?: boolean
}

/** Étape 1 : filtrage. */
export function filterCandidates(catalog: Exercise[], opts: FilterOptions): Exercise[] {
  const equipmentSet = new Set(opts.equipment)
  const zoneSet = new Set(opts.zones)
  const excludedSet = new Set(opts.excludedTypes ?? [])

  return catalog.filter((e) => {
    if (!e.active) return false
    if (!opts.skipEquipment && !e.equipment.every((eq) => equipmentSet.has(eq))) return false
    if (!opts.skipZones && !e.zones.some((z) => zoneSet.has(z))) return false
    if (excludedSet.has(e.type)) return false
    if (opts.maxIntensity !== undefined && e.intensity > opts.maxIntensity) return false
    return true
  })
}
