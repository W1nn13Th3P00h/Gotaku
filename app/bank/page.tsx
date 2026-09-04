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

import { buttonClasses } from '@/components/ui/button'
import { CardList, CardListItem, EmptyState } from '@/components/ui/card'
import { Field, inputClasses, selectClasses } from '@/components/ui/field'
import { BackLink, Page, PageHeader } from '@/components/ui/page'

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

  const activeFilterLabels = [
    filters.zone ? zoneLabel(filters.zone) : null,
    filters.type ? EXERCISE_TYPE_LABELS[filters.type] : null,
    filters.equipment ? equipmentLabel(filters.equipment) : null,
  ].filter((label): label is string => label !== null)

  return (
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader
          title="Banque"
          subtitle={`${exercises.length} exercice${exercises.length > 1 ? 's' : ''}.`}
          action={
            <div className="flex gap-2">
              <Link href="/compose" className={buttonClasses({ size: 'sm' })}>
                Composition
              </Link>
              <Link href="/bank/coverage" className={buttonClasses({ size: 'sm' })}>
                Couverture
              </Link>
            </div>
          }
        />
      </div>

      <form className="mt-6 flex flex-col gap-3" action="/bank" method="get">
        <div className="flex gap-2">
          <input
            type="search"
            name="search"
            defaultValue={filters.search ?? ''}
            placeholder="Rechercher un exercice"
            aria-label="Rechercher un exercice"
            className={inputClasses}
          />
          <button type="submit" className={buttonClasses({ variant: 'primary', className: 'shrink-0' })}>
            Filtrer
          </button>
        </div>

        {/*
          Trois listes déroulantes toujours dépliées poussaient la liste des
          exercices sous la ligne de flottaison à chaque visite, alors que le
          cas courant est une recherche par le nom. Repliées, mais ouvertes
          d'office dès qu'un filtre est actif, pour qu'un résultat restreint ne
          reste jamais inexpliqué.
        */}
        <details open={hasActiveFilters} className="rounded-xl border border-border">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-medium">
            <span>Filtres</span>
            {activeFilterLabels.length > 0 ? (
              <span className="text-xs font-normal text-muted">
                {activeFilterLabels.join(' · ')}
              </span>
            ) : null}
          </summary>

          <div className="flex flex-col gap-3 border-t border-border p-4">
            <Field label="Zone">
              <select name="zone" defaultValue={filters.zone ?? ''} className={selectClasses}>
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
            </Field>

            <Field label="Type">
              <select name="type" defaultValue={filters.type ?? ''} className={selectClasses}>
                <option value="">Tous</option>
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXERCISE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Matériel">
              <select name="equipment" defaultValue={filters.equipment ?? ''} className={selectClasses}>
                <option value="">Tous</option>
                {EQUIPMENT.map((equipment) => (
                  <option key={equipment.code} value={equipment.code}>
                    {equipment.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex gap-2">
              <button type="submit" className={buttonClasses({ variant: 'primary', block: true })}>
                Appliquer
              </button>
              {hasActiveFilters ? (
                <Link href="/bank" className={buttonClasses({ block: true })}>
                  Réinitialiser
                </Link>
              ) : null}
            </div>
          </div>
        </details>
      </form>

      <div className="mt-6">
        {exercises.length === 0 ? (
          <EmptyState>
            <p>Aucun exercice ne correspond à cette recherche ou à ces filtres.</p>
            {hasActiveFilters ? (
              <Link href="/bank" className={buttonClasses({ size: 'sm', className: 'mt-4' })}>
                Réinitialiser
              </Link>
            ) : null}
          </EmptyState>
        ) : (
          <CardList>
            {exercises.map((exercise) => (
              <CardListItem key={exercise.slug} className="flex items-center gap-3 p-4">
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
                  <span className="shrink-0 text-sm text-muted tabular-nums">
                    {formatDurationShort(exercise.durationTargetS)}
                  </span>
                </Link>
                <AddToCompositionButton exerciseId={exercise.id} />
              </CardListItem>
            ))}
          </CardList>
        )}
      </div>
    </Page>
  )
}
