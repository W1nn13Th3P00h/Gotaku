import { formatDurationShort } from '@/lib/format'
import { getCompletedSessionDays, getWeeklyVolume } from '@/lib/stats/queries'
import { computeStreak } from '@/lib/stats/streak'
import { createClient } from '@/lib/supabase/server'
import { Card, EmptyState } from '@/components/ui/card'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'

export const metadata = { title: 'Stats — Gokaku' }

// Streak et volume hebdo dépendent de l'utilisateur connecté (RLS) et de sa
// progression du jour : jamais de réponse mise en cache.
export const dynamic = 'force-dynamic'

const CHART_HEIGHT = 96
const LABEL_HEIGHT = 20
const BAR_WIDTH = 16
const BAR_GAP = 8
const MIN_BAR_HEIGHT = 3

type WeekBar = {
  weekStart: string
  totalVolumeS: number
  barHeight: number
  showLabel: boolean
}

/**
 * Hauteur proportionnelle au volume max de la fenêtre, jamais nulle : une
 * semaine à zéro reste une barre visible (quasi nulle), pas une absence.
 * Le label de durée n'est affiché que sur la barre max et la plus récente,
 * pour ne pas surcharger le graph (pas de tooltip interactif, mono-utilisateur).
 */
function buildWeekBars(weeks: { weekStart: string; totalVolumeS: number }[]): WeekBar[] {
  const maxVolume = Math.max(0, ...weeks.map((w) => w.totalVolumeS))
  let maxIndex = 0
  weeks.forEach((w, i) => {
    if (w.totalVolumeS > (weeks[maxIndex]?.totalVolumeS ?? 0)) maxIndex = i
  })
  const latestIndex = weeks.length - 1

  return weeks.map((w, i) => ({
    weekStart: w.weekStart,
    totalVolumeS: w.totalVolumeS,
    barHeight:
      maxVolume > 0 ? Math.max((w.totalVolumeS / maxVolume) * CHART_HEIGHT, MIN_BAR_HEIGHT) : MIN_BAR_HEIGHT,
    showLabel: maxVolume > 0 && (i === maxIndex || i === latestIndex),
  }))
}

function WeeklyVolumeChart({ bars }: { bars: WeekBar[] }) {
  const width = bars.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP
  const height = CHART_HEIGHT + LABEL_HEIGHT

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-32 w-full"
      role="img"
      aria-label="Volume horaire par semaine, des plus anciennes aux plus récentes"
    >
      {bars.map((bar, i) => {
        const x = i * (BAR_WIDTH + BAR_GAP)
        const y = LABEL_HEIGHT + (CHART_HEIGHT - bar.barHeight)

        return (
          <g key={bar.weekStart}>
            {bar.showLabel ? (
              <text
                x={x + BAR_WIDTH / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-muted text-[9px] tabular-nums"
              >
                {formatDurationShort(bar.totalVolumeS)}
              </text>
            ) : null}
            <rect
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={bar.barHeight}
              rx={3}
              className={bar.totalVolumeS > 0 ? 'fill-accent' : 'fill-border'}
            />
          </g>
        )
      })}
    </svg>
  )
}

export default async function StatsPage() {
  const supabase = await createClient()
  const [completedDays, weeklyVolume] = await Promise.all([
    getCompletedSessionDays(supabase),
    getWeeklyVolume(supabase),
  ])

  const streak = computeStreak(completedDays, new Date())
  const bars = buildWeekBars(weeklyVolume)
  const isVolumeEmpty = weeklyVolume.every((w) => w.totalVolumeS === 0)

  return (
    <Page>
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader title="Stats" />
      </div>

      <Section title="Série en cours" className="mt-6">
        <Card>
          {streak === 0 ? (
            <p className="text-sm text-muted">
              Pas de série en cours. Une séance aujourd&apos;hui pour en démarrer une.
            </p>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{streak}</span>
              <span className="text-sm text-muted">
                jour{streak > 1 ? 's' : ''} d&apos;affilée
              </span>
            </div>
          )}
        </Card>
      </Section>

      <Section title="Volume hebdomadaire" className="mt-8">
        {isVolumeEmpty ? (
          <EmptyState>Aucune séance terminée récemment.</EmptyState>
        ) : (
          <Card>
            <WeeklyVolumeChart bars={bars} />
          </Card>
        )}
      </Section>
    </Page>
  )
}
