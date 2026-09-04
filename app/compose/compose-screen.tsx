'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button, buttonClasses } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/card'
import { FormMessage, inputClasses } from '@/components/ui/field'
import { BackLink, Page, PageHeader } from '@/components/ui/page'
import { StickyBar } from '@/components/ui/sticky-bar'
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
    <Page className="pb-32">
      <BackLink href="/bank">Banque</BackLink>

      <div className="mt-2">
        <PageHeader
          title="Composition"
          subtitle={
            isEmpty
              ? 'Aucun exercice pour le moment.'
              : `${items.length} exercice${items.length > 1 ? 's' : ''} · ${formatDurationShort(totalDurationS)}`
          }
          action={
            <Link href="/compose/templates" className={buttonClasses({ size: 'sm' })}>
              Modèles
            </Link>
          }
        />
      </div>

      {isEmpty ? (
        <div className="mt-8">
          <EmptyState>
            <p>La composition est vide.</p>
            <Link href="/bank" className={buttonClasses({ size: 'sm', className: 'mt-4' })}>
              Ajouter depuis la banque
            </Link>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.name}</p>
                  <Button variant="quiet" size="sm" onClick={() => remove(item.id)} className="shrink-0 -mr-2">
                    Retirer
                  </Button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Monter ${item.name}`}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Descendre ${item.name}`}
                  >
                    ↓
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => changeDuration(item, item.durationS - DURATION_STEP_S)}
                      disabled={item.durationS <= item.minS}
                      aria-label={`Diminuer la durée de ${item.name}`}
                    >
                      −
                    </Button>
                    <span className="w-24 text-center text-sm tabular-nums">
                      {formatDurationShort(item.durationS)}
                      {item.perSide ? ' /côté' : ''}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => changeDuration(item, item.durationS + DURATION_STEP_S)}
                      disabled={item.durationS >= item.maxS}
                      aria-label={`Augmenter la durée de ${item.name}`}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-8">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Sauvegarder comme modèle</span>
            <input
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value)
                setSaveError(null)
                setSaved(false)
              }}
              placeholder="Nom du modèle"
              className={inputClasses}
            />
          </label>
          {saveError ? <FormMessage kind="error">{saveError}</FormMessage> : null}
          {saved ? <FormMessage kind="success">Modèle sauvegardé.</FormMessage> : null}
          <Button block onClick={handleSave} disabled={isEmpty}>
            Sauvegarder
          </Button>
        </div>
      </Card>

      {/*
        Action de sortie ancrée : la composition s'allonge exercice après
        exercice, et « Démarrer » ne doit jamais demander de refaire défiler la
        liste entière pour être atteint.
      */}
      <StickyBar>
        <Button variant="primary" size="lg" block onClick={handleStart} disabled={isEmpty || starting}>
          {starting ? 'Démarrage…' : 'Démarrer'}
        </Button>
      </StickyBar>
    </Page>
  )
}
