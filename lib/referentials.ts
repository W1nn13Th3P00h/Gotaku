/**
 * Référentiels fermés, miroir exact de `docs/data-model.md`.
 *
 * Toute valeur absente d'ici est une erreur de saisie, pas un cas à traiter.
 * Ce fichier est l'unique source de vérité côté TypeScript : le schéma Zod de la
 * banque, les migrations SQL et l'interface s'y réfèrent. Ne jamais ajouter une
 * valeur sans l'avoir d'abord ajoutée dans `docs/data-model.md`.
 */

export const REGIONS = [
  { code: 'foot_ankle', label: 'Pieds et chevilles' },
  { code: 'lower_leg', label: 'Jambes' },
  { code: 'thigh', label: 'Cuisses' },
  { code: 'hip', label: 'Hanches' },
  { code: 'core', label: 'Tronc' },
  { code: 'back', label: 'Dos' },
  { code: 'neck', label: 'Cou' },
  { code: 'shoulder_chest', label: 'Épaules et poitrine' },
  { code: 'arm', label: 'Bras' },
] as const

export type RegionCode = (typeof REGIONS)[number]['code']

/** 26 zones. L'ordre porte le tri d'affichage et la colonne `sort` en base. */
export const ZONES = [
  { code: 'feet', label: 'Pieds', region: 'foot_ankle' },
  { code: 'ankles', label: 'Chevilles', region: 'foot_ankle' },
  { code: 'calves', label: 'Mollets', region: 'lower_leg' },
  { code: 'shins', label: 'Tibias antérieurs', region: 'lower_leg' },
  { code: 'post_shins', label: 'Tibias postérieurs', region: 'lower_leg' },
  { code: 'hamstrings', label: 'Ischio-jambiers', region: 'thigh' },
  { code: 'quads', label: 'Quadriceps', region: 'thigh' },
  { code: 'adductors', label: 'Adducteurs', region: 'thigh' },
  { code: 'it_bands', label: 'Bandelettes ilio-tibiales', region: 'thigh' },
  { code: 'glutes', label: 'Fessiers', region: 'hip' },
  { code: 'hip_flexors', label: 'Fléchisseurs de hanche', region: 'hip' },
  { code: 'hip_rotators', label: 'Rotateurs de hanche', region: 'hip' },
  { code: 'abs', label: 'Abdominaux', region: 'core' },
  { code: 'obliques', label: 'Obliques', region: 'core' },
  { code: 'lumbar', label: 'Lombaires', region: 'back' },
  { code: 'thoracic', label: 'Thoracique', region: 'back' },
  { code: 'lats', label: 'Dorsaux', region: 'back' },
  { code: 'traps', label: 'Trapèzes', region: 'back' },
  { code: 'neck', label: 'Cervicales', region: 'neck' },
  { code: 'shoulders', label: 'Épaules', region: 'shoulder_chest' },
  { code: 'shoulder_rotators', label: "Rotateurs d'épaule", region: 'shoulder_chest' },
  { code: 'pecs', label: 'Pectoraux', region: 'shoulder_chest' },
  { code: 'biceps', label: 'Biceps', region: 'arm' },
  { code: 'triceps', label: 'Triceps', region: 'arm' },
  { code: 'forearm_flexors', label: "Fléchisseurs d'avant-bras", region: 'arm' },
  { code: 'forearm_extensors', label: "Extenseurs d'avant-bras", region: 'arm' },
] as const satisfies readonly { code: string; label: string; region: RegionCode }[]

export type ZoneCode = (typeof ZONES)[number]['code']

export const ZONE_CODES = ZONES.map((z) => z.code) as readonly ZoneCode[]

/** 9 matériels. Il n'existe pas de valeur signifiant l'absence de matériel. */
export const EQUIPMENT = [
  { code: 'band', label: 'Élastique' },
  { code: 'barbell', label: 'Barre' },
  { code: 'box', label: 'Box' },
  { code: 'ball', label: 'Balle' },
  { code: 'foam_roller', label: 'Rouleau de massage' },
  { code: 'medicine_ball', label: 'Medicine ball' },
  { code: 'pipe', label: 'Bâton' },
  { code: 'weight', label: 'Poids' },
  { code: 'percussion_gun', label: 'Pistolet de massage' },
] as const

export type EquipmentCode = (typeof EQUIPMENT)[number]['code']

export const EQUIPMENT_CODES = EQUIPMENT.map((e) => e.code) as readonly EquipmentCode[]

export const EXERCISE_TYPES = [
  'active_stretch',
  'passive_stretch',
  'massage',
  'muscle_activation',
] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  active_stretch: 'Étirement actif',
  passive_stretch: 'Étirement passif',
  massage: 'Massage',
  muscle_activation: 'Activation musculaire',
}

/**
 * Champ interne. Sert uniquement au regroupement dans l'ordre de la séance pour
 * éviter de se relever entre chaque exercice. Jamais affiché, jamais filtrable.
 * `hanging` n'est utilisée par aucun exercice de la banque, la valeur reste dans
 * le référentiel sans effet.
 */
export const BODY_POSITIONS = [
  'standing',
  'wall',
  'seated',
  'quadruped',
  'supine',
  'prone',
  'side_lying',
  'hanging',
] as const

export type BodyPosition = (typeof BODY_POSITIONS)[number]

export const SYMMETRY_TYPES = ['symmetric', 'asymmetric'] as const

export type SymmetryType = (typeof SYMMETRY_TYPES)[number]

/** Bornes des durées, alignées sur les contraintes SQL de `docs/data-model.md`. */
export const DURATION_BOUNDS = { min: 10, max: 600 } as const

export function zoneLabel(code: ZoneCode): string {
  return ZONES.find((z) => z.code === code)?.label ?? code
}

export function equipmentLabel(code: EquipmentCode): string {
  return EQUIPMENT.find((e) => e.code === code)?.label ?? code
}

export function zonesByRegion(): { region: (typeof REGIONS)[number]; zones: typeof ZONES }[] {
  return REGIONS.map((region) => ({
    region,
    zones: ZONES.filter((z) => z.region === region.code) as unknown as typeof ZONES,
  }))
}
