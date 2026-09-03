'use client'

import { useMemo, useState } from 'react'

import type { CatalogExercise } from '@/lib/bank/catalog'
import { costForDuration } from '@/lib/generator/cost'
import { generateSession } from '@/lib/generator/generate'
import { replaceExercise } from '@/lib/generator/replace'
import type { ExerciseId, FailureDetail, GeneratorInput } from '@/lib/generator/types'
import { DURATION_PRESETS_MIN, ZONE_PRESETS } from '@/lib/presets'
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  equipmentLabel,
  zoneLabel,
  zonesByRegion,
  type EquipmentCode,
  type ExerciseType,
  type ZoneCode,
} from '@/lib/referentials'

type ResultItem = { exercise: CatalogExercise; durationS: number }

type ViewState =
  | { kind: 'form' }
  | { kind: 'failure'; detail: FailureDetail }
  | { kind: 'preview'; items: ResultItem[]; unmetRequiredTypes: ExerciseType[] }

type Props = {
  catalog: CatalogExercise[]
  lastPerformed: Record<ExerciseId, string>
  zoneVolume30d: Record<string, number>
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0
}

function failureMessage(detail: FailureDetail): string {
  switch (detail.reason) {
    case 'EMPTY_CATALOG':
      return detail.message
    case 'BUDGET_TOO_SMALL':
      return `Durée trop courte : le plus petit exercice possible demande déjà ${Math.ceil(detail.minViableDurationS / 60)} min. Choisis une durée plus longue.`
    case 'ZONES_UNSERVABLE':
      return `Trop de zones pour la durée choisie : ${detail.droppedZones.map(zoneLabel).join(', ')} ne pourrai${detail.droppedZones.length > 1 ? 'en' : ''}t pas être couverte${detail.droppedZones.length > 1 ? 's' : ''}. Réduis les zones ou augmente la durée.`
  }
}

export function GeneratorScreen({ catalog, lastPerformed, zoneVolume30d }: Props) {
  const catalogById = useMemo(() => {
    const map = new Map<ExerciseId, CatalogExercise>()
    for (const exercise of catalog) map.set(exercise.id, exercise)
    return map
  }, [catalog])

  const lastPerformedMap = useMemo(() => {
    const map = new Map<ExerciseId, Date>()
    for (const [id, iso] of Object.entries(lastPerformed)) map.set(id, new Date(iso))
    return map
  }, [lastPerformed])

  const zoneVolumeMap = useMemo(
    () => new Map(Object.entries(zoneVolume30d)) as Map<ZoneCode, number>,
    [zoneVolume30d],
  )

  const [targetDurationMin, setTargetDurationMin] = useState<number>(10)
  const [zones, setZones] = useState<ZoneCode[]>([])
  const [equipment, setEquipment] = useState<EquipmentCode[]>([])
  const [excludedType, setExcludedType] = useState<ExerciseType | ''>('')
  const [requiredType, setRequiredType] = useState<ExerciseType | ''>('')
  const [maxIntensity, setMaxIntensity] = useState<1 | 2 | 3 | ''>('')

  const [view, setView] = useState<ViewState>({ kind: 'form' })

  function toggleZone(zone: ZoneCode) {
    setZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]))
  }

  function toggleEquipment(code: EquipmentCode) {
    setEquipment((prev) => (prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code]))
  }

  function currentInput(): GeneratorInput {
    return {
      targetDurationS: targetDurationMin * 60,
      zones,
      equipment,
      excludedTypes: excludedType ? [excludedType] : undefined,
      requiredTypes: requiredType ? [requiredType] : undefined,
      maxIntensity: maxIntensity || undefined,
    }
  }

  function runGeneration(input: GeneratorInput) {
    const result = generateSession(input, {
      catalog,
      lastPerformed: lastPerformedMap,
      zoneVolume30d: zoneVolumeMap,
      now: new Date(),
      seed: randomSeed(),
    })

    if (!result.ok) {
      setView({ kind: 'failure', detail: result.detail })
      return
    }

    const items = result.items.map((item): ResultItem => {
      const exercise = catalogById.get(item.exerciseId)
      if (exercise === undefined) throw new Error(`Exercice inconnu : ${item.exerciseId}`)
      return { exercise, durationS: item.durationS }
    })
    setView({ kind: 'preview', items, unmetRequiredTypes: result.unmetRequiredTypes })
  }

  function onGenerate() {
    if (zones.length === 0) return
    runGeneration(currentInput())
  }

  function onRegenerate() {
    runGeneration(currentInput())
  }

  function onReplace(index: number) {
    if (view.kind !== 'preview') return
    const currentItems = view.items.map((i) => ({ exercise: i.exercise, durationS: i.durationS }))
    const result = replaceExercise({
      currentItems,
      indexToReplace: index,
      catalog,
      availableEquipment: equipment,
      requestedZones: zones,
      sessionTargetDurationS: targetDurationMin * 60,
      context: { now: new Date(), lastPerformed: lastPerformedMap, zoneVolume30d: zoneVolumeMap, seed: randomSeed() },
    })
    if (!result.ok) return
    // `replaceExercise` est typé sur `Exercise` (module pur) ; l'objet retourné est
    // bien un élément de `catalog`, donc porte réellement `name`.
    const exercise = result.exercise as CatalogExercise
    const nextItems = [...view.items]
    nextItems[index] = { exercise, durationS: result.durationS }
    setView({ ...view, items: nextItems })
  }

  function onRemove(index: number) {
    if (view.kind !== 'preview') return
    setView({ ...view, items: view.items.filter((_, i) => i !== index) })
  }

  function onMove(index: number, direction: -1 | 1) {
    if (view.kind !== 'preview') return
    const target = index + direction
    if (target < 0 || target >= view.items.length) return
    const nextItems = [...view.items]
    const a = nextItems[index]
    const b = nextItems[target]
    if (a === undefined || b === undefined) return
    nextItems[index] = b
    nextItems[target] = a
    setView({ ...view, items: nextItems })
  }

  function onBackToForm() {
    setView({ kind: 'form' })
  }

  if (view.kind === 'failure') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Séance impossible</h1>
          <p className="mt-2 text-sm text-muted">{failureMessage(view.detail)}</p>
        </div>
        <button
          type="button"
          onClick={onBackToForm}
          className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-accent-foreground"
        >
          Modifier les critères
        </button>
      </main>
    )
  }

  if (view.kind === 'preview') {
    const totalDurationS = view.items.reduce(
      (sum, item) => sum + costForDuration(item.durationS, item.exercise.symmetry),
      0,
    )
    const targetDurationS = targetDurationMin * 60

    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Aperçu de la séance</h1>
          <p className="mt-1 text-sm text-muted">
            {Math.round(totalDurationS / 60)} min générées pour {Math.round(targetDurationS / 60)} min
            demandées
          </p>
          {view.unmetRequiredTypes.length > 0 ? (
            <p className="mt-1 text-sm text-muted">
              Type{view.unmetRequiredTypes.length > 1 ? 's' : ''} imposé
              {view.unmetRequiredTypes.length > 1 ? 's' : ''} non trouvé
              {view.unmetRequiredTypes.length > 1 ? 's' : ''} :{' '}
              {view.unmetRequiredTypes.map((t) => EXERCISE_TYPE_LABELS[t]).join(', ')}
            </p>
          ) : null}
        </div>

        <ol className="flex flex-col gap-2">
          {view.items.map((item, index) => (
            <li
              key={`${item.exercise.id}-${index}`}
              className="flex flex-col gap-2 rounded-xl border border-border p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{item.exercise.name}</span>
                <span className="text-sm text-muted">
                  {item.durationS}s{item.exercise.symmetry === 'asymmetric' ? ' / côté' : ''}
                </span>
              </div>
              <p className="text-xs text-muted">
                {EXERCISE_TYPE_LABELS[item.exercise.type]} · {zoneLabel(item.exercise.primary_zone)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-30"
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === view.items.length - 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-30"
                  aria-label="Descendre"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onReplace(index)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Remplacer
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRegenerate}
            className="w-full rounded-lg border border-border py-3 text-sm font-medium"
          >
            Régénérer
          </button>
          <button
            type="button"
            onClick={onBackToForm}
            className="w-full rounded-lg border border-border py-3 text-sm font-medium"
          >
            Nouveaux critères
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Générer une séance</h1>

      <section>
        <h2 className="text-sm font-medium">Durée</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATION_PRESETS_MIN.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => setTargetDurationMin(min)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                targetDurationMin === min
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border'
              }`}
            >
              {min} min
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Zones</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {ZONE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setZones(preset.zones)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {zonesByRegion().map(({ region, zones: regionZones }) => (
            <div key={region.code}>
              <p className="text-xs text-muted">{region.label}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {regionZones.map((zone) => (
                  <button
                    key={zone.code}
                    type="button"
                    onClick={() => toggleZone(zone.code)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      zones.includes(zone.code)
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border'
                    }`}
                  >
                    {zone.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Matériel disponible</h2>
        <p className="mt-1 text-xs text-muted">Aucune sélection : séance sans matériel.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EQUIPMENT.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => toggleEquipment(item.code)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                equipment.includes(item.code)
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border'
              }`}
            >
              {equipmentLabel(item.code)}
            </button>
          ))}
        </div>
      </section>

      <details className="rounded-lg border border-border p-4">
        <summary className="text-sm font-medium">Options</summary>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Exclure un type
            <select
              value={excludedType}
              onChange={(e) => setExcludedType(e.target.value as ExerciseType | '')}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            >
              <option value="">Aucun</option>
              {EXERCISE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXERCISE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Imposer un type
            <select
              value={requiredType}
              onChange={(e) => setRequiredType(e.target.value as ExerciseType | '')}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            >
              <option value="">Aucun</option>
              {EXERCISE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXERCISE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Intensité maximale
            <select
              value={maxIntensity}
              onChange={(e) =>
                setMaxIntensity(e.target.value ? (Number(e.target.value) as 1 | 2 | 3) : '')
              }
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            >
              <option value="">Aucune</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        </div>
      </details>

      <button
        type="button"
        onClick={onGenerate}
        disabled={zones.length === 0}
        className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        Générer
      </button>
    </main>
  )
}
