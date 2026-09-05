import { REGIONS } from '@/lib/referentials'
import { TROPHY_DEFINITIONS, type TrophyDefinition } from '@/lib/trophies/definitions'
import { getUnlockedTrophyKeys } from '@/lib/trophies/queries'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'

export const metadata = { title: 'Trophées — Gokaku' }

// Progression et déblocages dépendent de l'utilisateur connecté (RLS) : jamais
// de réponse mise en cache.
export const dynamic = 'force-dynamic'

const STREAK_DEFS = TROPHY_DEFINITIONS.filter((def) => def.family === 'streak')
const VOLUME_DEFS = TROPHY_DEFINITIONS.filter((def) => def.family === 'volume')

function regionLabel(code: string): string {
  return REGIONS.find((r) => r.code === code)?.label ?? code
}

function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Case de trophée : verrouillée grisée avec un libellé générique (le seuil
 * exact n'est pas exposé), débloquée avec le libellé propre à la famille — pas
 * de barre de progression (v1 issue #18).
 */
function TrophyBadge({ def, unlocked }: { def: TrophyDefinition; unlocked: boolean }) {
  const detail =
    def.family === 'volume'
      ? `${def.threshold / 3600}h`
      : def.family === 'region'
        ? `${capitalize(def.label ?? '')} · ${regionLabel(def.region ?? '')}`
        : capitalize(def.label ?? '')

  return (
    <div
      className={[
        'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border p-2 text-center',
        unlocked ? 'border-accent bg-accent/10' : 'border-dashed border-border opacity-50',
      ].join(' ')}
    >
      {unlocked ? (
        <span className="text-xs font-medium leading-tight">{detail}</span>
      ) : (
        <span className="text-xs text-muted">À débloquer</span>
      )}
    </div>
  )
}

export default async function TrophiesPage() {
  const supabase = await createClient()
  const unlockedKeys = await getUnlockedTrophyKeys(supabase)

  return (
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader title="Trophées" />
      </div>

      <Section title="Série" className="mt-6">
        <Card>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STREAK_DEFS.map((def) => (
              <TrophyBadge key={def.key} def={def} unlocked={unlockedKeys.has(def.key)} />
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Régions" className="mt-8">
        <div className="flex flex-col gap-4">
          {REGIONS.map((region) => {
            const defs = TROPHY_DEFINITIONS.filter(
              (def) => def.family === 'region' && def.region === region.code,
            )
            return (
              <Card key={region.code}>
                <h3 className="mb-2 text-xs font-medium text-muted">{region.label}</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {defs.map((def) => (
                    <TrophyBadge key={def.key} def={def} unlocked={unlockedKeys.has(def.key)} />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>

      <Section title="Volume horaire total" className="mt-8">
        <Card>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {VOLUME_DEFS.map((def) => (
              <TrophyBadge key={def.key} def={def} unlocked={unlockedKeys.has(def.key)} />
            ))}
          </div>
        </Card>
      </Section>
    </Page>
  )
}
