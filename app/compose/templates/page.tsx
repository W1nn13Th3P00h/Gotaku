import Link from 'next/link'

import { formatDurationShort } from '@/lib/format'
import { listTemplates } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/server'
import { buttonClasses } from '@/components/ui/button'
import { CardList, CardListItem, EmptyState } from '@/components/ui/card'
import { BackLink, Page, PageHeader } from '@/components/ui/page'

import { StartTemplateButton } from '@/app/compose/templates/start-template-button'

// Dépend de l'utilisateur connecté (RLS) : jamais de réponse mise en cache.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Modèles — Gokaku' }

export default async function TemplatesPage() {
  const supabase = await createClient()
  const templates = await listTemplates(supabase)

  return (
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader
          title="Modèles"
          subtitle={
            templates.length > 0
              ? `${templates.length} modèle${templates.length > 1 ? 's' : ''} sauvegardé${templates.length > 1 ? 's' : ''}.`
              : undefined
          }
          action={
            <Link href="/compose" className={buttonClasses({ size: 'sm' })}>
              Composition
            </Link>
          }
        />
      </div>

      <div className="mt-6">
        {templates.length === 0 ? (
          <EmptyState>
            <p>Aucun modèle sauvegardé.</p>
            <Link href="/compose" className={buttonClasses({ size: 'sm', className: 'mt-4' })}>
              Composer une séance
            </Link>
          </EmptyState>
        ) : (
          <CardList>
            {templates.map((template) => (
              <CardListItem key={template.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-muted">
                    {template.itemCount} exercice{template.itemCount > 1 ? 's' : ''} ·{' '}
                    {formatDurationShort(template.totalDurationS)}
                  </p>
                </div>
                <StartTemplateButton templateId={template.id} />
              </CardListItem>
            ))}
          </CardList>
        )}
      </div>
    </Page>
  )
}
