import { z } from 'zod'

import {
  BODY_POSITIONS,
  DURATION_BOUNDS,
  EQUIPMENT_CODES,
  EXERCISE_TYPES,
  SYMMETRY_TYPES,
  ZONE_CODES,
} from '@/lib/referentials'

/**
 * Schéma du format de `data/exercises.json`, source de vérité de la banque.
 *
 * Toutes les règles de `docs/data-model.md` sont bloquantes. Une seule erreur
 * annule le seed entier, sans écriture partielle. Les objets sont stricts :
 * une clé inconnue est une faute de frappe, pas une extension.
 */

const enumOf = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]])

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const nonEmptyLine = z
  .string()
  .trim()
  .min(1, 'ne peut pas être vide')

export const exerciseInputSchema = z
  .strictObject({
    slug: z
      .string()
      .regex(SLUG_RE, 'doit être en minuscules et tirets, sans espace ni accent'),

    name: nonEmptyLine,

    type: enumOf(EXERCISE_TYPES),

    /** Champ interne, consommé par le générateur pour l'ordonnancement. */
    position: enumOf(BODY_POSITIONS),

    symmetry: enumOf(SYMMETRY_TYPES),

    zones: z
      .array(enumOf(ZONE_CODES))
      .min(1, 'au moins une zone')
      .refine((zones) => new Set(zones).size === zones.length, 'zone en doublon'),

    primary_zone: enumOf(ZONE_CODES),

    equipment: z
      .array(enumOf(EQUIPMENT_CODES))
      .refine((eq) => new Set(eq).size === eq.length, 'matériel en doublon')
      .default([]),

    /** Champ interne, consommé par le générateur pour l'ordonnancement. */
    intensity: z.number().int().min(1).max(3),

    duration_target_s: z
      .number()
      .int()
      .min(DURATION_BOUNDS.min)
      .max(DURATION_BOUNDS.max),

    /** Sur un exercice asymétrique, la durée est celle d'un seul côté. */
    duration_min_s: z.number().int().min(DURATION_BOUNDS.min),

    duration_max_s: z.number().int().max(DURATION_BOUNDS.max),

    instructions: z
      .array(nonEmptyLine)
      .min(1, 'au moins une instruction')
      .max(6, 'six instructions au maximum'),

    contraindications: nonEmptyLine.optional(),
    notes: nonEmptyLine.optional(),
    media_url: z.string().url().optional(),
  })
  .superRefine((ex, ctx) => {
    if (!ex.zones.includes(ex.primary_zone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['primary_zone'],
        message: `« ${ex.primary_zone} » doit figurer dans zones [${ex.zones.join(', ')}]`,
      })
    }

    if (ex.duration_min_s > ex.duration_target_s) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_min_s'],
        message: `${ex.duration_min_s} s doit être inférieure ou égale à duration_target_s (${ex.duration_target_s} s)`,
      })
    }

    if (ex.duration_target_s > ex.duration_max_s) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_max_s'],
        message: `${ex.duration_max_s} s doit être supérieure ou égale à duration_target_s (${ex.duration_target_s} s)`,
      })
    }

    // Un massage suppose un accessoire. S'il se fait à la main, `notes` doit le dire.
    if (ex.type === 'massage' && ex.equipment.length === 0 && !ex.notes) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipment'],
        message:
          'un exercice de type massage doit déclarer au moins un matériel, ou préciser dans notes qu\'il est réalisable à la main',
      })
    }
  })

export type ExerciseInput = z.infer<typeof exerciseInputSchema>

/** La banque entière. Le slug est la clé d'idempotence du seed, il est unique. */
export const bankSchema = z
  .array(exerciseInputSchema)
  .min(1, 'la banque ne peut pas être vide')
  .superRefine((exercises, ctx) => {
    const seen = new Map<string, number>()
    exercises.forEach((ex, index) => {
      const first = seen.get(ex.slug)
      if (first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'slug'],
          message: `slug « ${ex.slug} » déjà utilisé à l'index ${first}`,
        })
        return
      }
      seen.set(ex.slug, index)
    })
  })

export type Bank = z.infer<typeof bankSchema>

/** Rend les erreurs Zod lisibles dans un terminal, une ligne par problème. */
export function formatBankIssues(error: z.ZodError, exercises?: unknown): string[] {
  const list = Array.isArray(exercises) ? exercises : []
  return error.issues.map((issue) => {
    const [head, ...rest] = issue.path
    const index = typeof head === 'number' ? head : undefined
    const entry = index !== undefined ? list[index] : undefined
    const slug =
      entry && typeof entry === 'object' && 'slug' in entry
        ? String((entry as { slug: unknown }).slug)
        : undefined
    const where =
      index === undefined
        ? issue.path.join('.')
        : `[${index}]${slug ? ` ${slug}` : ''}${rest.length ? `.${rest.join('.')}` : ''}`
    return `${where} : ${issue.message}`
  })
}
