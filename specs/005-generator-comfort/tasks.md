---

description: "Task list template for feature implementation"
---

# Tasks: Confort du générateur (Lot 6)

**Input**: Design documents from `/specs/005-generator-comfort/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/failure-actions.md, quickstart.md

**Tests**: incluses pour la nouvelle fonction pure (`suggestRecovery`) et pour la
tolérance personnalisée du générateur (extension de `generate.test.ts`, sans toucher
aux 11 tests obligatoires existants). Les trois autres stories (presets, case à
cocher, contrôle de tolérance) sont des ajouts d'interface ou de constantes déjà
couverts par les tests existants du générateur ; validées manuellement via
`quickstart.md`.

**Organization**: tâches groupées par user story (P1 → P4 dans `spec.md`). Les quatre
stories sont indépendantes entre elles (aucune ne bloque les autres) : pas de phase
Foundational distincte dans ce lot.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3, US4)

## Path Conventions

`app/generateur/generator-screen.tsx`, `lib/generator/`, `lib/presets.ts`,
`docs/generator.md` — tous déjà existants (Lot 2).

---

## Phase 1: Setup

Aucune tâche : les quatre stories modifient des fichiers déjà en place, aucune
nouvelle route ni nouvelle structure de dossier.

## Phase 2: Foundational

Aucune tâche : les quatre user stories ci-dessous ne partagent aucun code bloquant —
chacune touche des fichiers disjoints (voir Dependencies) et peut être livrée seule.

---

## Phase 3: User Story 1 - Rebondir sur un échec sans repartir de zéro (Priority: P1) 🎯

**Goal**: chaque écran d'échec propose, quand c'est raisonnable, une action en un tap
qui relance la génération avec les critères corrigés.

**Independent Test**: `quickstart.md` étapes 1 à 4.

### Tests for User Story 1

- [x] T001 [P] [US1] Écrire les tests Vitest dans
      `lib/generator/failure-actions.test.ts` pour `suggestRecovery` : `ZONES_UNSERVABLE`
      retire les zones non couvrables ; `BUDGET_TOO_SMALL` retient le premier preset de
      durée ≥ la durée minimale viable (et le plus grand si aucun ne l'atteint) ;
      `EMPTY_CATALOG` cause `equipment`/`both` vide le matériel ; `EMPTY_CATALOG` cause
      `zones` retourne `null` (doit échouer tant que T002 n'est pas fait)

### Implementation for User Story 1

- [x] T002 [US1] Implémenter `suggestRecovery` dans
      `lib/generator/failure-actions.ts` (dépend de T001 ; fait passer T001 ; contrat :
      `contracts/failure-actions.md`)
- [x] T003 [US1] Dans `app/generateur/generator-screen.tsx`, sur l'écran d'échec :
      appeler `suggestRecovery` avec le détail courant, et si le résultat n'est pas
      `null`, afficher un bouton d'action qui relance `runGeneration` avec cet input ;
      conserver dans tous les cas le bouton « Modifier les critères » déjà existant
      (dépend de T002)

**Checkpoint**: User Story 1 fonctionne seule, sur les trois motifs d'échec.

---

## Phase 4: User Story 2 - Prioriser les zones délaissées (Priority: P2)

**Goal**: exposer `preferNeglectedZones` (déjà supporté par le générateur) comme une
option de l'écran de génération.

**Independent Test**: `quickstart.md` étape 5.

### Implementation for User Story 2

- [x] T004 [US2] Ajouter une case à cocher « Prioriser les zones délaissées » dans le
      bloc `<details>` Options de `generator-screen.tsx`, état
      `preferNeglectedZones` (défaut `false`) inclus dans `currentInput()`

**Checkpoint**: User Story 2 fonctionne seule.

---

## Phase 5: User Story 3 - Presets de zones supplémentaires (Priority: P3)

**Goal**: trois presets ciblés de plus, à côté des cinq existants.

**Independent Test**: `quickstart.md` étape 6.

### Implementation for User Story 3

- [x] T005 [US3] Ajouter à `ZONE_PRESETS` dans `lib/presets.ts` les entrées « Cou et
      épaules » (`neck`, `shoulders`, `shoulder_rotators`, `traps`, `pecs`), « Hanches
      et bassin » (`hip_flexors`, `hip_rotators`, `glutes`, `adductors`), « Bras et
      avant-bras » (`biceps`, `triceps`, `forearm_flexors`, `forearm_extensors`)

**Checkpoint**: User Story 3 fonctionne seule.

---

## Phase 6: User Story 4 - Tolérance de durée ajustable (Priority: P4)

**Goal**: `TOLERANCE_S` devient un défaut, plus une limite figée.

**Independent Test**: `quickstart.md` étape 7.

### Implementation for User Story 4

- [ ] T006 [US4] Ajouter `toleranceS?: number` à `GeneratorInput` dans
      `lib/generator/types.ts`
- [ ] T007 [US4] Modifier `adjustDurations` dans `lib/generator/adjust.ts` pour
      accepter un troisième paramètre `toleranceS: number = TOLERANCE_S`, remplaçant
      la lecture directe de la constante importée (dépend de T006)
- [ ] T008 [US4] Dans `generateSession` (`lib/generator/generate.ts`), passer
      `input.toleranceS` à `adjustDurations` (dépend de T007)
- [ ] T009 [US4] Ajouter un test dans `lib/generator/generate.test.ts` vérifiant
      qu'une `toleranceS` personnalisée (ex. 60s) élargit effectivement l'écart
      accepté, sans modifier aucun des 11 tests obligatoires existants (SC-003)
      (dépend de T008)
- [ ] T010 [US4] Mettre à jour `docs/generator.md` : bloc de contrat
      `GeneratorInput` et étape 5, pour documenter `toleranceS` et sa valeur par
      défaut (dépend de T006-T009 ; `CLAUDE.md` : ce document doit rester la source de
      vérité de l'algorithme)
- [ ] T011 [US4] Ajouter le contrôle de tolérance dans le bloc Options de
      `generator-screen.tsx`, valeur par défaut affichée = `TOLERANCE_S` actuel
      (dépend de T006, T008)

**Checkpoint**: les quatre user stories sont complètes, indépendamment et ensemble.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T012 Exécuter `npm run typecheck`, `npm run lint` et `npm run test` ; vérifier
      explicitement que les 11 tests obligatoires du générateur passent toujours sans
      modification
- [ ] T013 Dérouler `quickstart.md` de bout en bout

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational**: aucune tâche
- **User Story 1 (Phase 3)**, **User Story 2 (Phase 4)**, **User Story 3 (Phase 5)**,
  **User Story 4 (Phase 6)** : toutes indépendantes entre elles, peuvent être
  développées et livrées dans n'importe quel ordre ou en parallèle
- **Polish (Phase 7)**: dépend des stories livrées

### Parallel Opportunities

- Les quatre user stories peuvent avancer en parallèle (fichiers disjoints : US1 touche
  `failure-actions.ts` + la branche échec de `generator-screen.tsx`, US2 une case à
  cocher du même fichier, US3 `lib/presets.ts`, US4 `lib/generator/{types,adjust,
  generate}.ts` + `docs/generator.md` + le bloc Options du même fichier). US2 et US4
  touchent toutes deux `generator-screen.tsx` (blocs Options distincts) : à fusionner
  avec attention si menées en parallèle par deux agents différents.

---

## Implementation Strategy

### Ordre suggéré (valeur décroissante, prudence croissante)

1. User Story 1 (le gain d'usage le plus direct)
2. User Story 2 (branchement simple d'une option déjà supportée)
3. User Story 3 (ajout de constante, aucun risque)
4. User Story 4 (seule story qui touche le contrat déjà testé du module pur — livrée
   en dernier par prudence, cf. `spec.md`)
5. Polish → gate `npm run typecheck && npm run lint && npm run test`

Chaque story peut aussi être livrée seule et indépendamment de cet ordre : aucune ne
dépend d'une autre.
