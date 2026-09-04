import { notFound } from 'next/navigation'

import { getExerciseBySlug } from '@/lib/bank/queries'
import { formatDurationShort } from '@/lib/format'
import { EXERCISE_TYPE_LABELS, equipmentLabel, zoneLabel } from '@/lib/referentials'
import { createClient } from '@/lib/supabase/server'
import { Chip } from '@/components/ui/chip'
import { CardList, CardListItem } from '@/components/ui/card'
import { BackLink, Page, Section } from '@/components/ui/page'

import { AddToCompositionButton } from '@/app/bank/add-to-composition-button'

export const metadata = { title: 'Exercice — Gokaku' }

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const exercise = await getExerciseBySlug(supabase, slug)

  if (!exercise) notFound()

  return (
    <Page>
      <BackLink href="/bank">Banque</BackLink>

      <header className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{exercise.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {EXERCISE_TYPE_LABELS[exercise.type]} · {formatDurationShort(exercise.durationTargetS)}
          </p>
        </div>
        <AddToCompositionButton exerciseId={exercise.id} />
      </header>

      <dl className="mt-6">
        <CardList>
          <CardListItem>
            <dt className="text-sm text-muted">Zones travaillées</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {exercise.zones.map((zone) => (
                <Chip key={zone} size="md" emphasis={zone === exercise.primaryZone}>
                  {zoneLabel(zone)}
                </Chip>
              ))}
            </dd>
          </CardListItem>

          <CardListItem>
            <dt className="text-sm text-muted">Matériel</dt>
            <dd className="mt-1 text-sm font-medium">
              {exercise.equipment.length > 0
                ? exercise.equipment.map(equipmentLabel).join(', ')
                : 'Aucun'}
            </dd>
          </CardListItem>

          <CardListItem>
            <dt className="text-sm text-muted">Dernière exécution</dt>
            <dd className="mt-1 text-sm font-medium">
              {exercise.lastPerformedAt
                ? new Date(exercise.lastPerformedAt).toLocaleDateString('fr-FR')
                : 'Jamais fait'}
            </dd>
          </CardListItem>
        </CardList>
      </dl>

      <Section title="Instructions" className="mt-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {exercise.instructions.map((line, i) => (
            // L'ordre est la seule identité stable ici : les instructions n'ont pas de clé propre.
            <li key={i}>{line}</li>
          ))}
        </ol>
      </Section>

      <Section title="Contre-indications" className="mt-6">
        <p className="text-sm">{exercise.contraindications ?? 'Aucune renseignée.'}</p>
      </Section>
    </Page>
  )
}
