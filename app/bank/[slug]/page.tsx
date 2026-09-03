import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getExerciseBySlug } from '@/lib/bank/queries'
import { formatDurationShort } from '@/lib/format'
import { EXERCISE_TYPE_LABELS, equipmentLabel, zoneLabel } from '@/lib/referentials'
import { createClient } from '@/lib/supabase/server'

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
    <main className="mx-auto max-w-md p-6 pb-16">
      <Link href="/bank" className="text-sm text-accent underline underline-offset-2">
        ← Banque
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{exercise.name}</h1>
        <AddToCompositionButton exerciseId={exercise.id} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {EXERCISE_TYPE_LABELS[exercise.type]} · {formatDurationShort(exercise.durationTargetS)}
      </p>

      <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
        <div className="p-4">
          <dt className="text-sm text-muted">Zones travaillées</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {exercise.zones.map((zone) => (
              <span
                key={zone}
                className={
                  zone === exercise.primaryZone
                    ? 'rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground'
                    : 'rounded-full border border-border px-3 py-1 text-sm'
                }
              >
                {zoneLabel(zone)}
              </span>
            ))}
          </dd>
        </div>

        <div className="p-4">
          <dt className="text-sm text-muted">Matériel</dt>
          <dd className="mt-1 text-sm font-medium">
            {exercise.equipment.length > 0
              ? exercise.equipment.map(equipmentLabel).join(', ')
              : 'Aucun'}
          </dd>
        </div>

        <div className="p-4">
          <dt className="text-sm text-muted">Dernière exécution</dt>
          <dd className="mt-1 text-sm font-medium">
            {exercise.lastPerformedAt
              ? new Date(exercise.lastPerformedAt).toLocaleDateString('fr-FR')
              : 'Jamais fait'}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted">Instructions</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {exercise.instructions.map((line, i) => (
            // L'ordre est la seule identité stable ici : les instructions n'ont pas de clé propre.
            <li key={i}>{line}</li>
          ))}
        </ol>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted">Contre-indications</h2>
        <p className="mt-2 text-sm">{exercise.contraindications ?? 'Aucune renseignée.'}</p>
      </div>
    </main>
  )
}
