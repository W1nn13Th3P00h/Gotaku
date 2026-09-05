'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import type { CatalogExercise } from '@/lib/bank/catalog'
import { TOLERANCE_S } from '@/lib/generator/constants'
import { costForDuration } from '@/lib/generator/cost'
import { suggestRecovery } from '@/lib/generator/failure-actions'
import { generateSession } from '@/lib/generator/generate'
import { replaceExercise } from '@/lib/generator/replace'
import type { ExerciseId, FailureDetail, GeneratorInput } from '@/lib/generator/types'
import { resolvePersonalizedZones } from '@/lib/personalization/queries'
import { DURATION_PRESETS_MIN, MOOD_PRESETS, type ProgrammedSessionEntry } from '@/lib/presets'
import { saveGeneratedAsTemplate, startGeneratedSession } from '@/lib/sessions/mutations'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ToggleChip } from '@/components/ui/chip'
import { Field, FormMessage, inputClasses, selectClasses } from '@/components/ui/field'
import { BackLink, Page, PageHeader, Section } from '@/components/ui/page'
import { StickyBar } from '@/components/ui/sticky-bar'
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  MOBILITY_FOCUSES,
  PRACTICES,
  REGIONS,
  regionOfZone,
  zoneLabel,
  zonesByRegion,
  type EquipmentCode,
  type ExerciseType,
  type MobilityFocusCode,
  type PracticeCode,
  type RegionCode,
  type ZoneCode,
} from '@/lib/referentials'

/** Au-delà, une séance perd son sens : trop de zones différentes à couvrir. */
const MAX_REGIONS = 2

type ResultItem = { exercise: CatalogExercise; durationS: number }

type ViewState =
  | { kind: 'form' }
  | { kind: 'failure'; detail: FailureDetail }
  | {
      kind: 'preview'
      items: ResultItem[]
      unmetRequiredTypes: ExerciseType[]
      /** Entrée et seed ayant produit cet aperçu — nécessaires pour le persister au « Démarrer »/« Sauvegarder ». */
      input: GeneratorInput
      seed: number
    }

type Props = {
  catalog: CatalogExercise[]
  lastPerformed: Record<ExerciseId, string>
  zoneVolume30d: Record<string, number>
  /** Réglage global (écran Réglages), valeur initiale de `equipment` : voir CLAUDE.md. */
  availableEquipment: EquipmentCode[]
  /** Réglages de personnalisation (écran Réglages) : présélection de la séance
   *  personnalisée et source de la catégorie « Sports » des séances programmées. */
  practices: PracticeCode[]
  mainPractice: PracticeCode | null
  majorDeficitFocus: MobilityFocusCode | null
  practiceZones: Record<PracticeCode, ZoneCode[]>
  mobilityFocusZones: Record<MobilityFocusCode, ZoneCode[]>
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

type ProgrammedSessionCategoryProps = {
  title: string
  entries: ProgrammedSessionEntry[]
  onSelect: (zones: ZoneCode[]) => void
  /** Dépliée par défaut : la catégorie la plus proche de l'utilisateur. */
  defaultOpen?: boolean
}

/** Une catégorie de séances programmées, dépliable/consultable séparément des autres. */
function ProgrammedSessionCategory({
  title,
  entries,
  onSelect,
  defaultOpen = false,
}: ProgrammedSessionCategoryProps) {
  return (
    <details className="rounded-xl border border-border" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium">
        {title}
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        {entries.map((entry) => (
          <Button key={entry.id} variant="subtle" size="sm" onClick={() => onSelect(entry.zones)}>
            {entry.label}
          </Button>
        ))}
      </div>
    </details>
  )
}

/** Libellé de l'action de relance en un tap, alignée sur le motif d'échec courant. */
function recoveryLabel(detail: FailureDetail, suggestion: GeneratorInput): string {
  switch (detail.reason) {
    case 'ZONES_UNSERVABLE':
      return 'Continuer avec les zones couvrables'
    case 'BUDGET_TOO_SMALL':
      return `Générer en ${Math.round(suggestion.targetDurationS / 60)} min`
    case 'EMPTY_CATALOG':
      return 'Relancer sans matériel'
  }
}

export function GeneratorScreen({
  catalog,
  lastPerformed,
  zoneVolume30d,
  availableEquipment,
  practices,
  mainPractice,
  majorDeficitFocus,
  practiceZones,
  mobilityFocusZones,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

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
  // Présélection de la séance personnalisée : union des zones du déficit majeur et
  // du sport principal (`docs/data-model.md`), `[]` si les deux sont absents —
  // comportement inchangé, sélection manuelle comme avant ces réglages.
  const [zones, setZones] = useState<ZoneCode[]>(() =>
    resolvePersonalizedZones({ majorDeficitFocus, mainPractice, mobilityFocusZones, practiceZones }),
  )
  const [equipment, setEquipment] = useState<EquipmentCode[]>(availableEquipment)
  const [excludedType, setExcludedType] = useState<ExerciseType | ''>('')
  const [requiredType, setRequiredType] = useState<ExerciseType | ''>('')
  const [maxIntensity, setMaxIntensity] = useState<1 | 2 | 3 | ''>('')
  const [preferNeglectedZones, setPreferNeglectedZones] = useState(false)
  const [toleranceS, setToleranceS] = useState<number>(TOLERANCE_S)

  const [view, setView] = useState<ViewState>({ kind: 'form' })

  const [starting, setStarting] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const zonesByRegionCode = useMemo(() => {
    const map = new Map<RegionCode, ZoneCode[]>()
    for (const { region, zones: regionZones } of zonesByRegion()) {
      map.set(region.code, regionZones.map((z) => z.code))
    }
    return map
  }, [])

  const selectedRegions = useMemo(
    () => [...new Set(zones.map(regionOfZone))],
    [zones],
  )

  // Catégorie « Sports » des séances programmées : une tuile par pratique cochée
  // dans les réglages, dynamique et vide si aucune pratique n'est cochée.
  const sportsEntries = useMemo<ProgrammedSessionEntry[]>(
    () =>
      PRACTICES.filter((practice) => practices.includes(practice.code)).map((practice) => ({
        id: practice.code,
        label: practice.label,
        zones: practiceZones[practice.code] ?? [],
      })),
    [practices, practiceZones],
  )

  // Catégorie « Zones de mobilité » : toujours les 4 grandes zones, indépendamment
  // des réglages.
  const mobilityEntries = useMemo<ProgrammedSessionEntry[]>(
    () =>
      MOBILITY_FOCUSES.map((focus) => ({
        id: focus.code,
        label: focus.label,
        zones: mobilityFocusZones[focus.code] ?? [],
      })),
    [mobilityFocusZones],
  )

  function toggleZone(zone: ZoneCode) {
    setZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]))
  }

  function toggleRegion(region: RegionCode) {
    if (selectedRegions.includes(region)) {
      setZones((prev) => prev.filter((z) => regionOfZone(z) !== region))
      return
    }
    if (selectedRegions.length >= MAX_REGIONS) return
    const regionZones = zonesByRegionCode.get(region) ?? []
    setZones((prev) => [...prev, ...regionZones.filter((z) => !prev.includes(z))])
  }

  function currentInput(): GeneratorInput {
    return {
      targetDurationS: targetDurationMin * 60,
      zones,
      equipment,
      excludedTypes: excludedType ? [excludedType] : undefined,
      requiredTypes: requiredType ? [requiredType] : undefined,
      maxIntensity: maxIntensity || undefined,
      preferNeglectedZones,
      toleranceS,
    }
  }

  function runGeneration(input: GeneratorInput) {
    const seed = randomSeed()
    const result = generateSession(input, {
      catalog,
      lastPerformed: lastPerformedMap,
      zoneVolume30d: zoneVolumeMap,
      now: new Date(),
      seed,
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
    setTemplateName('')
    setSaveError(null)
    setSaved(false)
    setView({ kind: 'preview', items, unmetRequiredTypes: result.unmetRequiredTypes, input, seed })
  }

  function previewToItems(items: ResultItem[]) {
    return items.map((item) => ({
      exerciseId: item.exercise.id,
      durationS: item.durationS,
      perSide: item.exercise.symmetry === 'asymmetric',
    }))
  }

  async function handleStart() {
    if (view.kind !== 'preview' || view.items.length === 0 || starting) return
    setStarting(true)
    const { sessionId } = await startGeneratedSession(supabase, {
      items: previewToItems(view.items),
      requestedZones: view.input.zones,
      availableEquipment: view.input.equipment,
      excludedTypes: view.input.excludedTypes ?? [],
      seed: view.seed,
    })
    router.push(`/session/${sessionId}`)
  }

  async function handleSaveTemplate() {
    if (view.kind !== 'preview') return
    setSaveError(null)
    setSaved(false)
    setSaving(true)
    const result = await saveGeneratedAsTemplate(supabase, templateName, previewToItems(view.items))
    setSaving(false)
    if (!result.ok) {
      setSaveError(
        result.reason === 'EMPTY_NAME'
          ? 'Donnez un nom au modèle avant de le sauvegarder.'
          : 'L’aperçu est vide : rien à sauvegarder.',
      )
      return
    }
    setTemplateName('')
    setSaved(true)
  }

  function onGenerate() {
    if (zones.length === 0) return
    runGeneration(currentInput())
  }

  function onRegenerate() {
    runGeneration(currentInput())
  }

  /**
   * Un matériel requis par la séance affichée n'est en fait pas disponible à cet
   * instant (ex. quelqu'un d'autre l'utilise) : on le retire et on relance tout de
   * suite, sans toucher au réglage global (Réglages reste la seule source du
   * défaut persistant).
   */
  function onEquipmentUnavailable(code: EquipmentCode) {
    const nextEquipment = equipment.filter((e) => e !== code)
    setEquipment(nextEquipment)
    runGeneration({ ...currentInput(), equipment: nextEquipment })
  }

  function onRecover(suggestion: GeneratorInput) {
    // Le formulaire reste la source de vérité pour toute relance ultérieure
    // (régénérer, revenir au formulaire) : on le resynchronise avec la suggestion.
    setTargetDurationMin(suggestion.targetDurationS / 60)
    setZones(suggestion.zones)
    setEquipment(suggestion.equipment)
    runGeneration(suggestion)
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
    const suggestion = suggestRecovery(view.detail, currentInput(), DURATION_PRESETS_MIN)
    return (
      <Page layout="centered">
        <PageHeader title="Séance impossible" subtitle={failureMessage(view.detail)} />
        {suggestion !== null ? (
          <Button variant="primary" size="lg" block onClick={() => onRecover(suggestion)}>
            {recoveryLabel(view.detail, suggestion)}
          </Button>
        ) : null}
        <Button
          variant={suggestion !== null ? 'secondary' : 'primary'}
          size="lg"
          block
          onClick={onBackToForm}
        >
          Modifier les critères
        </Button>
      </Page>
    )
  }

  if (view.kind === 'preview') {
    const totalDurationS = view.items.reduce(
      (sum, item) => sum + costForDuration(item.durationS, item.exercise.symmetry),
      0,
    )
    const targetDurationS = targetDurationMin * 60
    const deltaS = totalDurationS - targetDurationS
    const neededEquipmentSet = new Set(view.items.flatMap((item) => item.exercise.equipment))
    const neededEquipment = EQUIPMENT.filter((item) => neededEquipmentSet.has(item.code))

    return (
      <Page className="pb-32">
        <PageHeader
          title="Aperçu de la séance"
          subtitle={
            <>
              {view.items.length} exercice{view.items.length > 1 ? 's' : ''} ·{' '}
              <span className="tabular-nums">{Math.round(totalDurationS / 60)} min</span> pour{' '}
              <span className="tabular-nums">{Math.round(targetDurationS / 60)} min</span> demandées
              {/* L'écart est le seul chiffre que le spec demande de comparer :
                  autant l'écrire plutôt que le laisser calculer. */}
              {Math.abs(deltaS) >= 30 ? (
                <span className="text-muted">
                  {' '}
                  ({deltaS > 0 ? '+' : '−'}
                  {Math.round(Math.abs(deltaS) / 60)} min)
                </span>
              ) : null}
            </>
          }
        />

        {view.unmetRequiredTypes.length > 0 ? (
          <Card className="mt-4 text-sm text-muted">
            Type{view.unmetRequiredTypes.length > 1 ? 's' : ''} imposé
            {view.unmetRequiredTypes.length > 1 ? 's' : ''} non trouvé
            {view.unmetRequiredTypes.length > 1 ? 's' : ''} :{' '}
            {view.unmetRequiredTypes.map((t) => EXERCISE_TYPE_LABELS[t]).join(', ')}
          </Card>
        ) : null}

        {neededEquipment.length > 0 ? (
          <Section
            title="Matériel nécessaire"
            description="Décoche ce que tu n'as finalement pas sous la main : la séance se régénère aussitôt."
            className="mt-6"
          >
            <div className="flex flex-wrap gap-2">
              {neededEquipment.map((item) => (
                <ToggleChip
                  key={item.code}
                  selected
                  onClick={() => onEquipmentUnavailable(item.code)}
                >
                  {item.label}
                </ToggleChip>
              ))}
            </div>
          </Section>
        ) : null}

        <ol className="mt-6 flex flex-col gap-3">
          {view.items.map((item, index) => (
            <li key={`${item.exercise.id}-${index}`}>
              <Card>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    <span className="mr-2 text-muted tabular-nums">{index + 1}</span>
                    {item.exercise.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted tabular-nums">
                    {item.durationS}s{item.exercise.symmetry === 'asymmetric' ? ' / côté' : ''}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {EXERCISE_TYPE_LABELS[item.exercise.type]} · {zoneLabel(item.exercise.primary_zone)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`Monter ${item.exercise.name}`}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onMove(index, 1)}
                    disabled={index === view.items.length - 1}
                    aria-label={`Descendre ${item.exercise.name}`}
                  >
                    ↓
                  </Button>
                  <Button size="sm" onClick={() => onReplace(index)} className="ml-auto">
                    Remplacer
                  </Button>
                  <Button size="sm" onClick={() => onRemove(index)}>
                    Retirer
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ol>

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
            <Button block onClick={handleSaveTemplate} disabled={view.items.length === 0 || saving}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
          </div>
        </Card>

        <StickyBar>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={handleStart}
              disabled={view.items.length === 0 || starting}
            >
              {starting ? 'Démarrage…' : 'Démarrer'}
            </Button>
            <div className="flex gap-3">
              <Button block onClick={onBackToForm}>
                Critères
              </Button>
              <Button block onClick={onRegenerate}>
                Régénérer
              </Button>
            </div>
          </div>
        </StickyBar>
      </Page>
    )
  }

  const canGenerate = zones.length > 0

  return (
    <Page className="pb-32">
      <BackLink href="/">Accueil</BackLink>

      <div className="mt-2">
        <PageHeader title="Générer une séance" />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        <Section title="Durée">
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS_MIN.map((min) => (
              <ToggleChip
                key={min}
                selected={targetDurationMin === min}
                onClick={() => setTargetDurationMin(min)}
                className="min-w-16 justify-center"
              >
                {min} min
              </ToggleChip>
            ))}
          </div>
        </Section>

        <Section
          title="Zones"
          action={
            zones.length > 0 ? (
              <Button variant="quiet" size="sm" onClick={() => setZones([])} className="-mr-2">
                Tout effacer
              </Button>
            ) : null
          }
          description={
            zones.length > 0
              ? `${zones.length} zone${zones.length > 1 ? 's' : ''} sélectionnée${zones.length > 1 ? 's' : ''}.`
              : 'Au moins une zone est nécessaire.'
          }
        >
          {/*
            Les séances programmées remplacent la sélection, les zones la
            modifient : deux gestes opposés, donc deux traitements visuels
            distincts. Rendus identiques, ils se confondaient.
          */}
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Séances programmées
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {sportsEntries.length > 0 ? (
              <ProgrammedSessionCategory
                title="Sports"
                entries={sportsEntries}
                onSelect={setZones}
                defaultOpen
              />
            ) : null}
            <ProgrammedSessionCategory
              title="Zones de mobilité"
              entries={mobilityEntries}
              onSelect={setZones}
              defaultOpen={sportsEntries.length === 0}
            />
            <ProgrammedSessionCategory title="Mood" entries={MOOD_PRESETS} onSelect={setZones} />
          </div>

          {/*
            Régions d'abord, zones ensuite : 26 zones dépliées d'un coup forçaient
            trop de scroll. Choisir une région sélectionne toutes ses zones (le
            geste courant), affinables ensuite chip par chip. Au-delà de
            `MAX_REGIONS`, les régions non représentées sont grisées : une séance
            qui part dans trop de directions n'a plus de sens.
          */}
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Régions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              <ToggleChip
                key={region.code}
                selected={selectedRegions.includes(region.code)}
                onClick={() => toggleRegion(region.code)}
                disabled={
                  !selectedRegions.includes(region.code) && selectedRegions.length >= MAX_REGIONS
                }
              >
                {region.label}
              </ToggleChip>
            ))}
          </div>

          {selectedRegions.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {selectedRegions.map((regionCode) => {
                const region = REGIONS.find((r) => r.code === regionCode)
                const regionZones = zonesByRegionCode.get(regionCode) ?? []
                return (
                  <div key={regionCode}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {region?.label}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {regionZones.map((zone) => (
                        <ToggleChip
                          key={zone}
                          selected={zones.includes(zone)}
                          onClick={() => toggleZone(zone)}
                        >
                          {zoneLabel(zone)}
                        </ToggleChip>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </Section>

        <details className="rounded-xl border border-border">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 text-sm font-medium">
            Options
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
            <Field label="Exclure un type">
              <select
                value={excludedType}
                onChange={(e) => setExcludedType(e.target.value as ExerciseType | '')}
                className={selectClasses}
              >
                <option value="">Aucun</option>
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXERCISE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Imposer un type">
              <select
                value={requiredType}
                onChange={(e) => setRequiredType(e.target.value as ExerciseType | '')}
                className={selectClasses}
              >
                <option value="">Aucun</option>
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXERCISE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Intensité maximale">
              <select
                value={maxIntensity}
                onChange={(e) =>
                  setMaxIntensity(e.target.value ? (Number(e.target.value) as 1 | 2 | 3) : '')
                }
                className={selectClasses}
              >
                <option value="">Aucune</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={preferNeglectedZones}
                onChange={(e) => setPreferNeglectedZones(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              Prioriser les zones délaissées
            </label>
            <Field label="Tolérance sur la durée totale" hint="En secondes.">
              <input
                type="number"
                min={0}
                step={5}
                value={toleranceS}
                onChange={(e) => setToleranceS(Math.max(0, Number(e.target.value) || 0))}
                className={inputClasses}
              />
            </Field>
          </div>
        </details>
      </div>

      {/*
        Le formulaire fait plusieurs écrans de haut une fois les zones dépliées :
        l'action de sortie est ancrée, sinon chaque essai impose de redescendre
        toute la liste.
      */}
      <StickyBar>
        <Button variant="primary" size="lg" block onClick={onGenerate} disabled={!canGenerate}>
          Générer
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          {canGenerate
            ? `${targetDurationMin} min · ${zones.length} zone${zones.length > 1 ? 's' : ''}`
            : 'Sélectionne au moins une zone.'}
        </p>
      </StickyBar>
    </Page>
  )
}
