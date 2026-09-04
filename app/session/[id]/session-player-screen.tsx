'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatCountdown } from '@/lib/format'
import { zoneLabel, type ZoneCode } from '@/lib/referentials'
import { back, init, pause, remainingMs, resume, skip, tick } from '@/lib/session-player/reducer'
import type { PlayerItem, PlayerState } from '@/lib/session-player/types'
import { completeSession, markItemDone, markItemSkipped, revertItemToPending, startSession } from '@/lib/sessions/mutations'
import type { SessionForExecution } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonClasses } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Page, PageHeader, Section } from '@/components/ui/page'

type Props = {
  session: SessionForExecution
}

type ExerciseDisplay = {
  name: string
  instructions: string[]
  primaryZone: ZoneCode
  zones: ZoneCode[]
}

/** État affiché à chaque frame : le player pur, plus l'horodatage qui pilote son rendu. */
type Clock = { player: PlayerState; nowMs: number }

function toPlayerItems(session: SessionForExecution): PlayerItem[] {
  return session.items.map((it) => ({
    id: it.id,
    exerciseId: it.exerciseId,
    ord: it.ord,
    durationS: it.durationS,
    perSide: it.perSide,
    status: it.status,
  }))
}

function idleClock(session: SessionForExecution): Clock {
  return {
    nowMs: 0,
    player: {
      phase: 'idle',
      items: toPlayerItems(session),
      currentIndex: 0,
      currentSide: null,
      phaseStartedAtMs: 0,
      elapsedBeforePauseMs: 0,
    },
  }
}

function phaseKey(player: PlayerState): string {
  return `${player.currentIndex}:${player.currentSide ?? 'sym'}`
}

/** Signal synthétisé (WebAudio), jamais `navigator.vibrate` (non supporté Safari iOS). */
function beep(ctx: AudioContext, frequency: number, atOffsetS: number, durationS: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  osc.connect(gain)
  gain.connect(ctx.destination)
  const start = ctx.currentTime + atOffsetS
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.2, start + 0.01)
  gain.gain.linearRampToValueAtTime(0, start + durationS)
  osc.start(start)
  osc.stop(start + durationS + 0.02)
}

export function SessionPlayerScreen({ session }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const exerciseById = useMemo(() => {
    const map = new Map<string, ExerciseDisplay>()
    for (const item of session.items) map.set(item.id, item.exercise)
    return map
  }, [session.items])

  const [clock, setClock] = useState<Clock>(() => idleClock(session))
  // Posée une seule fois, dans l'effet de fin de séance : jamais recalculée au
  // rendu (Date.now() y serait une lecture impure).
  const [finishedDurationS, setFinishedDurationS] = useState<number | null>(null)

  const rafIdRef = useRef<number | null>(null)
  const playerRef = useRef<PlayerState>(clock.player)
  const prevPlayerRef = useRef<PlayerState | null>(null)
  const warnedKeyRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const startedAtMsRef = useRef<number | null>(session.startedAt ? new Date(session.startedAt).getTime() : null)

  useEffect(() => {
    playerRef.current = clock.player
  }, [clock.player])

  function ensureAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new Ctor()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  function playWarningSignal() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    beep(ctx, 880, 0, 0.12)
  }

  function playChangeSignal() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    beep(ctx, 523.25, 0, 0.1)
    beep(ctx, 783.99, 0.13, 0.12)
  }

  async function requestWakeLockSafe() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {
      // Repli silencieux : Wake Lock indisponible (navigateur, contexte non sécurisé, batterie faible…).
    }
  }

  function releaseWakeLock() {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (sentinel) void sentinel.release().catch(() => {})
  }

  // Relâché à la sortie de l'écran (démontage), quelle qu'en soit la raison.
  useEffect(() => {
    return () => {
      releaseWakeLock()
      const ctx = audioCtxRef.current
      audioCtxRef.current = null
      if (ctx) void ctx.close().catch(() => {})
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // Boucle de décompte réel : ne tourne que pendant `running`, pilote aussi le
  // signal d'avertissement à 3 secondes de la fin de la phase courante.
  useEffect(() => {
    if (clock.player.phase !== 'running') return

    let cancelled = false

    function loop() {
      if (cancelled) return
      const now = performance.now()

      const current = playerRef.current
      if (current.phase === 'running') {
        const key = phaseKey(current)
        if (remainingMs(current, now) <= 3000 && warnedKeyRef.current !== key) {
          warnedKeyRef.current = key
          playWarningSignal()
        }
      }

      setClock((prev) => ({ player: tick(prev.player, now), nowMs: now }))
      rafIdRef.current = requestAnimationFrame(loop)
    }

    rafIdRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [clock.player.phase])

  // Effets de bord déclenchés par une vraie transition d'état (pas par le simple
  // écoulement du temps) : écriture Supabase, signal de changement, fin de séance.
  useEffect(() => {
    const prev = prevPlayerRef.current
    const player = clock.player
    prevPlayerRef.current = player

    if (prev === null || prev === player) return

    player.items.forEach((it, i) => {
      const prevItem = prev.items[i]
      if (!prevItem) return
      if (prevItem.status === 'pending' && it.status === 'done') {
        void markItemDone(supabase, it.id)
      } else if (prevItem.status === 'pending' && it.status === 'skipped') {
        void markItemSkipped(supabase, it.id)
      } else if (prevItem.status !== 'pending' && it.status === 'pending') {
        void revertItemToPending(supabase, it.id)
      }
    })

    if (
      player.phase !== 'finished' &&
      (player.currentIndex !== prev.currentIndex || player.currentSide !== prev.currentSide)
    ) {
      warnedKeyRef.current = null
      playChangeSignal()
    }

    if (player.phase === 'finished' && prev.phase !== 'finished') {
      const actualDurationS = startedAtMsRef.current
        ? Math.round((Date.now() - startedAtMsRef.current) / 1000)
        : 0
      setFinishedDurationS(actualDurationS)
      void completeSession(supabase, session.id, { actualDurationS })
      releaseWakeLock()
    }
  }, [clock.player, session.id, supabase])

  function handleStart() {
    // Geste utilisateur explicite : c'est le seul moment où WebAudio et Wake
    // Lock peuvent être initialisés côté iOS (CLAUDE.md).
    ensureAudioContext()
    void requestWakeLockSafe()

    if (!startedAtMsRef.current) startedAtMsRef.current = Date.now()
    void startSession(supabase, session.id)

    const now = performance.now()
    const player = init(clock.player.items, now)
    prevPlayerRef.current = player
    setClock({ player, nowMs: now })
  }

  function dispatch(action: (state: PlayerState, nowMs: number) => PlayerState) {
    const now = performance.now()
    setClock((prev) => ({ player: action(prev.player, now), nowMs: now }))
  }


  const player = clock.player

  if (player.phase === 'idle') {
    const alreadyStarted = session.startedAt !== null
    return (
      <Page layout="centered">
        <PageHeader
          title={alreadyStarted ? 'Reprendre la séance' : 'Prêt à commencer ?'}
          subtitle={`${session.items.length} exercice${session.items.length > 1 ? 's' : ''}, environ ${Math.round(session.targetDurationS / 60)} min.`}
        />
        <Button variant="primary" size="lg" block onClick={handleStart}>
          {alreadyStarted ? 'Reprendre' : 'Démarrer'}
        </Button>
        <Link href="/" className={buttonClasses({ variant: 'quiet', block: true })}>
          Quitter
        </Link>
      </Page>
    )
  }

  if (player.phase === 'finished') {
    const doneItems = player.items.filter((it) => it.status === 'done')
    const skippedItems = player.items.filter((it) => it.status === 'skipped')
    const actualDurationS = finishedDurationS ?? 0
    const zonesWorked = [
      ...new Set(
        player.items.flatMap((it) => exerciseById.get(it.id)?.zones ?? []),
      ),
    ]

    return (
      <Page layout="centered">
        <PageHeader title="Séance terminée" />

        {/* Le chiffre qui compte est la durée réellement tenue : il porte le résumé. */}
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold tabular-nums tracking-tight">
            {Math.round(actualDurationS / 60)}
          </span>
          <span className="text-sm text-muted">
            min · {doneItems.length} réalisé{doneItems.length > 1 ? 's' : ''}
            {skippedItems.length > 0
              ? `, ${skippedItems.length} passé${skippedItems.length > 1 ? 's' : ''}`
              : ''}
          </span>
        </div>

        <Section title="Zones travaillées">
          <div className="flex flex-wrap gap-2">
            {zonesWorked.map((zone) => (
              <Chip key={zone} size="md">
                {zoneLabel(zone)}
              </Chip>
            ))}
          </div>
        </Section>

        <Link
          href="/"
          className={buttonClasses({ variant: 'primary', size: 'lg', block: true })}
        >
          Retour à l&apos;accueil
        </Link>
      </Page>
    )
  }

  // running | paused
  const currentItem = player.items[player.currentIndex]
  const exercise = currentItem ? exerciseById.get(currentItem.id) : undefined
  const nextItem = player.items[player.currentIndex + 1]
  const nextExercise = nextItem ? exerciseById.get(nextItem.id) : undefined
  const remaining = Math.ceil(remainingMs(player, clock.nowMs) / 1000)
  const isPaused = player.phase === 'paused'

  if (!currentItem || !exercise) {
    // Ne devrait pas arriver tant que `phase` n'est pas `finished` (invariant du reducer).
    return null
  }

  // Part de la phase courante déjà écoulée. Purement visuelle : le décompte
  // chiffré reste la source d'information, la barre n'en donne que la forme.
  const phaseTotalS = currentItem.durationS
  const phaseProgress = phaseTotalS > 0 ? Math.min(1, Math.max(0, 1 - remaining / phaseTotalS)) : 0

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <div>
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span className="tabular-nums">
            {player.currentIndex + 1} / {player.items.length}
          </span>
          {isPaused ? <span className="font-medium text-accent">En pause</span> : null}
        </div>
        {/* Avancement dans la phase courante, pas dans la séance : c'est la seule
            échéance qui se joue à cet instant. */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div
            className="h-full bg-accent transition-[width] duration-100 ease-linear"
            style={{ width: `${phaseProgress * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {currentItem.perSide ? (
          <p className="text-sm font-medium text-accent">
            {player.currentSide === 'right' ? 'Côté droit' : 'Côté gauche'}
          </p>
        ) : null}

        <p
          className={`text-7xl font-semibold tabular-nums tracking-tight transition-opacity duration-150 ${
            isPaused ? 'opacity-40' : ''
          }`}
          role="timer"
          aria-live="off"
        >
          {formatCountdown(remaining)}
        </p>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">{exercise.name}</h1>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {exercise.zones.map((zone) => (
              <Chip key={zone} emphasis={zone === exercise.primaryZone}>
                {zoneLabel(zone)}
              </Chip>
            ))}
          </div>
        </div>

        <ol className="max-w-xs list-decimal space-y-1 pl-5 text-left text-sm text-muted">
          {exercise.instructions.map((line, i) => (
            // L'ordre est la seule identité stable ici : les instructions n'ont pas de clé propre.
            <li key={i}>{line}</li>
          ))}
        </ol>

        {nextExercise ? (
          <p className="text-xs text-muted">Ensuite : {nextExercise.name}</p>
        ) : (
          <p className="text-xs text-muted">Dernier exercice</p>
        )}
      </div>

      {/* Contrôles surdimensionnés : ils sont visés au pouce, au sol, sans regarder. */}
      <div className="flex gap-3">
        <Button size="lg" onClick={() => dispatch(back)}>
          Revenir
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={() => dispatch(isPaused ? resume : pause)}
        >
          {isPaused ? 'Reprendre' : 'Pause'}
        </Button>
        <Button size="lg" onClick={() => dispatch(skip)}>
          Passer
        </Button>
      </div>
    </main>
  )
}
