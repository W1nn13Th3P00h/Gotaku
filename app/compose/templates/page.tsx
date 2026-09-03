import Link from 'next/link'

import { formatDurationShort } from '@/lib/format'
import { listTemplates } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'

import { StartTemplateButton } from '@/app/compose/templates/start-template-button'

// Dépend de l'utilisateur connecté (RLS) : jamais de réponse mise en cache.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Modèles — Gokaku' }

export default async function TemplatesPage() {
  const supabase = await createClient()
  const templates = await listTemplates(supabase)

  return (
    <main className="mx-auto max-w-md p-6 pb-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Modèles</h1>
        <Link href="/compose" className="text-sm text-accent underline underline-offset-2">
          Composition
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Aucun modèle sauvegardé. Composez une séance depuis{' '}
          <Link href="/compose" className="text-accent underline underline-offset-2">
            /compose
          </Link>{' '}
          puis sauvegardez-la.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-sm text-muted">
                  {template.itemCount} exercice{template.itemCount > 1 ? 's' : ''} ·{' '}
                  {formatDurationShort(template.totalDurationS)}
                </p>
              </div>
              <StartTemplateButton templateId={template.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
