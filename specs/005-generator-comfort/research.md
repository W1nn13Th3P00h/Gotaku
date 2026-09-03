# Phase 0 — Research: Confort du générateur (Lot 6)

Le seul point réellement ambigu du roadmap (« réglages de tolérance ») a été tranché
avec l'utilisateur avant l'écriture de la spec (voir Assumptions de `spec.md`). Les
décisions ci-dessous portent sur la façon de construire les quatre stories, à partir du
code déjà existant du Lot 2 (`app/generateur/generator-screen.tsx`, `lib/generator/`,
`lib/presets.ts`).

## Suggestions de relance : une fonction pure à partir du détail déjà structuré

- **Decision**: `suggestRecovery(detail: FailureDetail, current: GeneratorInput,
  durationPresetsMin: readonly number[]): GeneratorInput | null` dans
  `lib/generator/failure-actions.ts`. Retourne un nouveau `GeneratorInput` prêt à
  relancer, ou `null` quand aucune action à tap unique n'est raisonnable (cas
  `EMPTY_CATALOG` à cause dominante « zones », FR-004).
  - `ZONES_UNSERVABLE` → `{ ...current, zones: current.zones.filter(z =>
    !detail.droppedZones.includes(z)) }`
  - `BUDGET_TOO_SMALL` → `{ ...current, targetDurationS: (premier preset de
    `durationPresetsMin` × 60 qui est ≥ `detail.minViableDurationS`, ou le plus grand
    preset multiplié par 60 si aucun n'atteint ce seuil) }`
  - `EMPTY_CATALOG` avec `dominantCause` `'equipment'` ou `'both'` →
    `{ ...current, equipment: [] }`
  - `EMPTY_CATALOG` avec `dominantCause: 'zones'` → `null`
- **Rationale**: toute la donnée nécessaire à la suggestion existe déjà dans
  `FailureDetail` (Lot 2) — reformuler la logique de décision en pur TypeScript, testé
  sans React ni catalogue réel, évite de la disperser dans le composant d'écran et la
  rend vérifiable indépendamment de l'affichage.
- **Alternatives considered**: calculer la suggestion directement dans
  `generator-screen.tsx` (comme le fait déjà `failureMessage` aujourd'hui) — plus
  rapide à écrire, mais untestable sans monter le composant, alors que la décision
  elle-même (quels champs changer) ne dépend d'aucun état React.

## Priorisation des zones délaissées : un simple branchement, aucune nouvelle logique

- **Decision**: une case à cocher dans le bloc « Options » de `generator-screen.tsx`,
  état `preferNeglectedZones: boolean` (défaut `false`), ajoutée à `currentInput()`.
- **Rationale**: le paramètre et sa logique de pondération existent déjà et sont déjà
  couverts par les tests du module pur (Lot 2) ; il ne manque que l'exposer. Aucun test
  supplémentaire nécessaire côté générateur pour ce point.

## Presets supplémentaires : extension de la constante existante

- **Decision**: trois entrées ajoutées à `ZONE_PRESETS` (`lib/presets.ts`) : « Cou et
  épaules » (`neck`, `shoulders`, `shoulder_rotators`, `traps`, `pecs`), « Hanches et
  bassin » (`hip_flexors`, `hip_rotators`, `glutes`, `adductors`), « Bras et
  avant-bras » (`biceps`, `triceps`, `forearm_flexors`, `forearm_extensors`) — tous des
  codes déjà dans `docs/data-model.md`, aucun code inventé.
- **Rationale**: même mécanisme que les cinq presets existants (une constante
  d'interface, `docs/spec.md` : « pas une entité en base »), aucun changement de
  structure (`ZonePreset` reste `{ label, zones }`).
- **Alternatives considered**: aucune — le roadmap ne fixe ni le nombre ni le nom des
  presets supplémentaires (voir Assumptions de `spec.md`), ce choix est un détail
  d'interface réversible sans coût.

## Tolérance ajustable : paramètre optionnel, valeur par défaut inchangée

- **Decision**: `GeneratorInput.toleranceS?: number` (Lot 2, `lib/generator/types.ts`).
  `adjustDurations(selected, remaining, toleranceS: number = TOLERANCE_S)` remplace la
  lecture directe de la constante importée. `generateSession` passe
  `input.toleranceS ?? TOLERANCE_S` (en pratique, laisser `adjustDurations` gérer le
  défaut suffit ; `generateSession` peut passer `input.toleranceS` directement,
  `undefined` déclenchant le défaut du paramètre).
- **Rationale**: c'est la forme la plus étroite du changement demandé — un seul point
  d'entrée modifié (`adjustDurations`), un seul appelant à ajuster
  (`generateSession`), aucun des 11 tests obligatoires existants ne fournit
  `toleranceS` et continue donc de s'exécuter avec la constante actuelle (SC-003).
- **Alternatives considered**: remplacer entièrement `TOLERANCE_S` par un champ
  obligatoire — rejeté explicitement par l'utilisateur (rétrocompatibilité demandée) et
  aurait cassé la signature de tous les appelants existants, y compris les 11 tests.

## Mise à jour de `docs/generator.md`

- **Decision**: le bloc de contrat (`GeneratorInput`) et l'étape 5 sont mis à jour pour
  mentionner `toleranceS?: number` (défaut `TOLERANCE_S`), dans le même changement que
  le code.
- **Rationale**: `CLAUDE.md` est explicite — ce document est la source de vérité de
  l'algorithme, à lire avant d'écrire une ligne du générateur ; le laisser désynchronisé
  du code romprait cette garantie pour la prochaine session qui y touchera.
