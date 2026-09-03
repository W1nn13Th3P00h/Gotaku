'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { formatDurationShort } from '@/lib/format'
import { computeTotalDurationS } from '@/lib/sessions/composition'
import {
  removeItemFromComposition,
  reorderItems,
  saveAsTemplate,
  startSession,
  updateItemDuration,
} from '@/lib/sessions/mutations'
import type { CompositionForEdit, CompositionItem } from '@/lib/sessions/queries'
import { createClient } from '@/lib/supabase/client'

type Props = {
  composition: CompositionForEdit
}

/** Pas de saisie libre : des pas de 5 s, au tap, cohérents avec le choix
 * « boutons, pas de glisser-déposer » du réordonnancement (`research.md`). */
const DURATION_STEP_S = 5

export function ComposeScreen({ composition }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [items, setItems] = useState<CompositionItem[]>(composition.items)
  const [starting, setStarting] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const totalDurationS = useMemo(
    () =>
      computeTotalDurationS(items.map((it) => ({ durationS: it.durationS, perSide: it.perSide }))),
    [items],
  )
  const isEmpty = items.length === 0

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const next = [...items]
    const moved = next[index]
    const swapped = next[target]
    if (!moved || !swapped) return
    next[index] = swapped
    next[target] = moved

    setItems(next)
    void reorderItems(
      supabase,
      composition.sessionId,
      next.map((it) => it.id),
    )
  }

  function changeDuration(item: CompositionItem, requestedS: number) {
    const clamped = Math.min(item.maxS, Math.max(item.minS, Math.round(requestedS)))
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, durationS: clamped } : it)))
    void updateItemDuration(supabase, item.id, requestedS)
  }

  function remove(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    void removeItemFromComposition(supabase, itemId)
  }

  async function handleStart() {
    if (isEmpty || starting) return
    setStarting(true)
    await startSession(supabase, composition.sessionId)
    router.push(`/session/${composition.sessionId}`)
  }

  async function handleSave() {
    setSaveError(null)
    setSaved(false)
    const result = await saveAsTemplate(supabase, composition.sessionId, templateName)
    if (!result.ok) {
      setSaveError(
        result.reason === 'EMPTY_NAME'
          ? 'Donnez un nom au modèle avant de le sauvegarder.'
          : 'La composition est vide : rien à sauvegarder.',
      )
      return
    }
    setTemplateName('')
    setSaved(true)
  }

  return (
    <main className="mx-auto max-w-md p-6 pb-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Composition</h1>
        <Link href="/compose/templates" className="text-sm text-accent underline underline-offset-2">
          Modèles
        </Link>
      </div>

      <p className="mt-1 text-sm text-muted">
        {isEmpty
          ? 'Aucun exercice pour le moment.'
          : `${items.length} exercice${items.length > 1 ? 's' : ''} · ${formatDurationShort(totalDurationS)}`}
      </p>

      {isEmpty ? (
        <div className="mt-8 rounded-xl border border-border p-4 text-sm text-muted">
          Ajoutez des exercices depuis la{' '}
          <Link href="/bank" className="text-accent underline underline-offset-2">
            banque
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{item.name}</p>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="shrink-0 text-sm text-muted underline underline-offset-2"
                >
                  Retirer
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Monter"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Descendre"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  ↓
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeDuration(item, item.durationS - DURATION_STEP_S)}
                    disabled={item.durationS <= item.minS}
                    aria-label="Diminuer la durée"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-24 text-center text-sm tabular-nums">
                    {formatDurationShort(item.durationS)}
                    {item.perSide ? ' /côté' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeDuration(item, item.durationS + DURATION_STEP_S)}
                    disabled={item.durationS >= item.maxS}
                    aria-label="Augmenter la durée"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={isEmpty || starting}
        className="mt-8 w-full rounded-lg bg-accent py-4 text-base font-medium text-accent-foreground disabled:opacity-40"
      >
        Démarrer
      </button>

      <div className="mt-6 rounded-xl border border-border p-4">
        <label className="flex flex-col gap-1 text-sm">
          Sauvegarder comme modèle
          <input
            type="text"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.target.value)
              setSaveError(null)
              setSaved(false)
            }}
            placeholder="Nom du modèle"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>
        {saveError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
        ) : null}
        {saved ? <p className="mt-2 text-sm text-muted">Modèle sauvegardé.</p> : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-medium disabled:opacity-40"
        >
          Sauvegarder
        </button>
      </div>
    </main>
  )
}
