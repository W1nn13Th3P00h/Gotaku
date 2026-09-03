import Link from 'next/link'

import { listExercises, type BankFilters } from '@/lib/bank/queries'
import { formatDurationShort } from '@/lib/format'
import {
  EQUIPMENT,
  EQUIPMENT_CODES,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  equipmentLabel,
  zoneLabel,
  zonesByRegion,
  ZONE_CODES,
} from '@/lib/referentials'
import type { EquipmentCode, ExerciseType, ZoneCode } from '@/lib/referentials'
import { createClient } from '@/lib/supabase/server'

import { AddToCompositionButton } from '@/app/bank/add-to-composition-button'

export const metadata = { title: 'Banque — Gokaku' }

type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Les référentiels sont fermés : une valeur hors liste dans l'URL (lien partagé
 * périmé, saisie manuelle) est traitée comme un filtre absent, jamais transmise
 * telle quelle à la requête.
 */
function parseFilters(raw: RawSearchParams): BankFilters {
  const search = typeof raw.search === 'string' ? raw.search.trim() : ''
  const zone = typeof raw.zone === 'string' && (ZONE_CODES as readonly string[]).includes(raw.zone)
    ? (raw.zone as ZoneCode)
    : undefined
  const type =
    typeof raw.type === 'string' && (EXERCISE_TYPES as readonly string[]).includes(raw.type)
      ? (raw.type as ExerciseType)
      : undefined
  const equipment =
    typeof raw.equipment === 'string' && (EQUIPMENT_CODES as readonly string[]).includes(raw.equipment)
      ? (raw.equipment as EquipmentCode)
      : undefined

  return { search: search || undefined, zone, type, equipment }
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const raw = await searchParams
  const filters = parseFilters(raw)
  const supabase = await createClient()
  const exercises = await listExercises(supabase, filters)

  const hasActiveFilters = Boolean(filters.search || filters.zone || filters.type || filters.equipment)

  return (
    <main className="mx-auto max-w-md p-6 pb-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Banque</h1>
        <div className="flex gap-4">
          <Link href="/compose" className="text-sm text-accent underline underline-offset-2">
            Composition
          </Link>
          <Link href="/bank/coverage" className="text-sm text-accent underline underline-offset-2">
            Couverture
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">{exercises.length} exercice(s).</p>

      <form className="mt-6 flex flex-col gap-3" action="/bank" method="get">
        <input
          type="search"
          name="search"
          defaultValue={filters.search ?? ''}
          placeholder="Rechercher un exercice"
          aria-label="Rechercher un exercice"
          className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-base outline-none focus:border-accent"
        />

        <label className="flex flex-col gap-1 text-sm">
          Zone
          <select
            name="zone"
            defaultValue={filters.zone ?? ''}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          >
            <option value="">Toutes</option>
            {zonesByRegion().map(({ region, zones }) => (
              <optgroup key={region.code} label={region.label}>
                {zones.map((zone) => (
                  <option key={zone.code} value={zone.code}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="type"
            defaultValue={filters.type ?? ''}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          >
            <option value="">Tous</option>
            {EXERCISE_TYPES.map((type) => (
              <option key={type} value={type}>
                {EXERCISE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Matériel
          <select
            name="equipment"
            defaultValue={filters.equipment ?? ''}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          >
            <option value="">Tous</option>
            {EQUIPMENT.map((equipment) => (
              <option key={equipment.code} value={equipment.code}>
                {equipment.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent py-2 text-center text-sm font-medium text-accent-foreground"
          >
            Filtrer
          </button>
          {hasActiveFilters ? (
            <Link
              href="/bank"
              className="flex-1 rounded-lg border border-border py-2 text-center text-sm font-medium"
            >
              Réinitialiser
            </Link>
          ) : null}
        </div>
      </form>

      {exercises.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Aucun exercice ne correspond à cette recherche ou à ces filtres.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
          {exercises.map((exercise) => (
            <li key={exercise.slug} className="flex items-center gap-3 p-4">
              <Link
                href={`/bank/${exercise.slug}`}
                className="flex flex-1 items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium">{exercise.name}</p>
                  <p className="text-sm text-muted">
                    {EXERCISE_TYPE_LABELS[exercise.type]} · {zoneLabel(exercise.primaryZone)}
                    {exercise.equipment.length > 0
                      ? ` · ${exercise.equipment.map(equipmentLabel).join(', ')}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted">
                  {formatDurationShort(exercise.durationTargetS)}
                </span>
              </Link>
              <AddToCompositionButton exerciseId={exercise.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
