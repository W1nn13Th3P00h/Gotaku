---

description: "Task list template for feature implementation"
---

# Tasks: Banque d'exercices en lecture (Lot 1)

**Input**: Design documents from `/specs/001-exercise-bank-browse/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/bank-queries.md, quickstart.md

**Tests**: incluses, mais ciblées sur les deux points où une régression serait
silencieuse (voir `research.md` § Stratégie de test des fonctions de lecture) : la
fonction SQL de couverture par zone, et l'omission de `position`/`intensity`. Le
filtrage déclaratif (`listExercises`) n'a pas de test dédié : il est validé
manuellement via `quickstart.md`.

**Organization**: tâches groupées par user story (P1 → P3 dans `spec.md`), chaque
story livrable et testable indépendamment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3)

## Path Conventions

Projet unique Next.js App Router (voir `plan.md` § Project Structure) : `app/bank/`,
`lib/bank/`, `supabase/migrations/`.

---

## Phase 1: Setup

**Purpose**: existence des routes avant implémentation.

- [ ] T001 [P] Créer les trois routes vides `app/bank/page.tsx`, `app/bank/[slug]/page.tsx`
      et `app/bank/coverage/page.tsx`, chacune avec un titre de section et un texte « à
      venir » (aucune logique de données à ce stade)

**Checkpoint**: les trois URLs répondent (404 absent, contenu placeholder).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: le mapper d'exercice est utilisé par User Story 1 (liste) et User Story 2
(fiche) ; il doit exister, testé, avant l'une ou l'autre.

**⚠️ CRITICAL**: aucune tâche de User Story 1 ou 2 ne démarre avant la fin de cette phase.

- [ ] T002 [P] Définir dans `lib/bank/queries.ts` les types `BankFilters`,
      `ExerciseSummary`, `ExerciseDetail` et `ZoneCoverageRow` conformes à
      `data-model.md`
- [ ] T003 [P] Écrire le test Vitest dans `lib/bank/queries.test.ts` qui appelle le
      futur `mapExerciseRow` avec une ligne brute simulée contenant `position` et
      `intensity`, et vérifie que ces deux champs sont absents de l'objet retourné
      (doit échouer tant que T004 n'est pas fait — dépend de T002 pour les types)
- [ ] T004 Implémenter `mapExerciseRow(row, { detailed })` dans `lib/bank/queries.ts` :
      construit un `ExerciseSummary` (ou `ExerciseDetail` si `detailed`) à partir d'une
      ligne Supabase brute (exercice + zones + équipements + zone primaire), sans jamais
      recopier `position` ni `intensity`, faisant passer T003 (dépend de T002, T003)

**Checkpoint**: `npm run test` passe sur `queries.test.ts`, le mapper est prêt à être
branché.

---

## Phase 3: User Story 1 - Retrouver un exercice par recherche et filtres (Priority: P1) 🎯 MVP

**Goal**: liste des exercices actifs, recherche texte sur le nom, filtres combinables
zone/type/matériel.

**Independent Test**: ouvrir `/bank`, taper un nom partiel, combiner zone + type +
matériel, vérifier que seuls les exercices correspondants restent, et qu'une
combinaison sans résultat affiche un message explicite plutôt qu'une liste vide muette.

### Implementation for User Story 1

- [ ] T005 [US1] Implémenter `listExercises(supabase, filters: BankFilters)` dans
      `lib/bank/queries.ts` : sélection explicite de colonnes (jamais `select('*')`),
      jointure vers `exercise_zones`/`exercise_equipment`, `ilike` insensible à la casse
      sur `name`, filtres `zone`/`type`/`equipment` combinables par ET logique, restreint
      à `active = true`, tri par `name`, mappage de chaque ligne via `mapExerciseRow`
      (dépend de T004 ; contrat : `contracts/bank-queries.md`)
- [ ] T006 [US1] Implémenter `app/bank/page.tsx` : lit `search`/`zone`/`type`/`equipment`
      depuis les `searchParams` de l'URL, appelle `listExercises`, affiche un champ de
      recherche et des contrôles de filtre en formulaire `GET` (URL partageable), la
      liste résultante (nom, type, zone primaire, durée cible), et un message explicite
      quand la liste est vide (FR-011) (dépend de T005)

**Checkpoint**: User Story 1 fonctionne seule et est démontrable (`quickstart.md`
étapes 1 à 4).

---

## Phase 4: User Story 2 - Consulter la fiche complète d'un exercice (Priority: P2)

**Goal**: fiche en lecture seule d'un exercice, avec date de dernière exécution (ou son
absence), jamais `position`/`intensity`.

**Independent Test**: ouvrir la fiche d'un exercice déjà réalisé et d'un exercice
jamais réalisé, vérifier tous les champs attendus et l'absence de toute action
d'édition.

### Implementation for User Story 2

- [ ] T007 [US2] Implémenter `getExerciseBySlug(supabase, slug: string)` dans
      `lib/bank/queries.ts` : sélection explicite incluant `instructions` et
      `contraindications`, `left join` vers la vue `exercise_last_performed`
      (`lastPerformedAt` à `null` si absent), retourne `null` si le slug n'existe pas ou
      est inactif, mappage via `mapExerciseRow` avec `detailed: true` (dépend de T004 ;
      contrat : `contracts/bank-queries.md`)
- [ ] T008 [US2] Implémenter `app/bank/[slug]/page.tsx` : affiche nom, type, zones avec
      zone primaire mise en évidence, matériel requis, durée cible, instructions,
      contre-indications (ou leur absence), date de dernière exécution ou « jamais
      fait » ; appelle `notFound()` si `getExerciseBySlug` renvoie `null` (dépend de
      T007)
- [ ] T009 [P] [US2] Relier chaque ligne de `app/bank/page.tsx` à `/bank/[slug]` (lien de
      navigation depuis la liste, conforme au scénario d'acceptation US2 #1) (dépend de
      T006, T008)

**Checkpoint**: User Stories 1 et 2 fonctionnent ensemble, chacune indépendamment
testable (`quickstart.md` étape 5).

---

## Phase 5: User Story 3 - Repérer les zones sous-alimentées via le tableau de couverture (Priority: P3)

**Goal**: tableau listant les 26 zones du référentiel avec leur nombre d'exercices,
zones sous-alimentées mises en évidence.

**Independent Test**: ouvrir le tableau de couverture, vérifier qu'une zone sans aucun
exercice apparaît avec un compte de zéro plutôt que d'être absente, et que les zones
les plus faibles sont visuellement distinguées.

### Tests for User Story 3

- [ ] T010 [P] [US3] Ajouter la migration `supabase/migrations/20260903090000_zone_coverage_fn.sql`
      créant la fonction SQL `zone_coverage()` : `left join` de `zones` vers
      `exercise_zones`, `group by zones.code`, `count(exercise_zones.exercise_id)`,
      retournant une ligne par zone du référentiel (voir `research.md`)
- [ ] T011 [US3] Écrire le test Vitest (PGlite, `createTestDb()` de `lib/db/test-db.ts`)
      dans `lib/bank/queries.test.ts` qui applique la migration T010, insère un jeu
      d'exercices de test couvrant certaines zones mais pas toutes, appelle
      `select * from zone_coverage()`, et vérifie que les 26 zones sont présentes, y
      compris celle sans exercice, avec un compte de zéro (doit échouer tant que T010
      n'est pas fait)

### Implementation for User Story 3

- [ ] T012 [US3] Implémenter `getZoneCoverage(supabase)` dans `lib/bank/queries.ts` :
      appelle `supabase.rpc('zone_coverage')`, attache `zoneLabel`/`regionCode` via
      `lib/referentials.ts`, calcule `isLowCoverage` avec la constante
      `ZONE_LOW_COVERAGE_THRESHOLD = 10` (dépend de T010, T011 ; contrat :
      `contracts/bank-queries.md`)
- [ ] T013 [US3] Implémenter `app/bank/coverage/page.tsx` : tableau des 26 zones
      (libellé, région, compte), mise en évidence visuelle des lignes `isLowCoverage`
      (dépend de T012)
- [ ] T014 [P] [US3] Ajouter un lien de navigation entre `/bank` et `/bank/coverage`
      dans les deux sens (dépend de T006, T013)

**Checkpoint**: les trois user stories fonctionnent indépendamment et ensemble
(`quickstart.md` étape 6).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T015 [P] Ajouter un lien vers `/bank` depuis l'écran actuel `app/page.tsx` (socle
      du Lot 0), pour valider sans naviguer à la main par URL — à retirer/déplacer
      quand l'écran Accueil réel de `docs/spec.md` sera construit
- [ ] T016 Exécuter `npm run typecheck`, `npm run lint` et `npm run test` ; corriger
      toute régression avant de committer (gate non négociable, `CLAUDE.md`)
- [ ] T017 Dérouler `quickstart.md` de bout en bout dans `npm run dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance
- **Foundational (Phase 2)**: dépend de Setup — bloque US1 et US2 (pas US3, qui ne
  dépend pas du mapper d'exercice)
- **User Story 1 (Phase 3)**: dépend de Foundational
- **User Story 2 (Phase 4)**: dépend de Foundational ; T009 dépend en plus de T006 (US1)
- **User Story 3 (Phase 5)**: dépend de Setup uniquement (pas de Foundational : la
  couverture ne passe pas par `mapExerciseRow`) ; T014 dépend en plus de T006 (US1)
- **Polish (Phase 6)**: dépend des user stories livrées

### Parallel Opportunities

- T001 est seule dans Setup.
- T002 et T003 en parallèle (fichiers/rubriques différentes), tous deux avant T004.
- Une fois Foundational fait, User Story 1 (Phase 3) et User Story 3 (Phase 5, hors T014)
  peuvent avancer en parallèle : elles ne partagent aucun fichier avant T006/T014.
- T009 et T014 sont parallélisables entre elles une fois T006 fait.

---

## Implementation Strategy

### MVP First (User Story 1 seule)

1. Phase 1 (Setup)
2. Phase 2 (Foundational)
3. Phase 3 (User Story 1)
4. Valider `quickstart.md` étapes 1 à 4, s'arrêter là si besoin — la banque est déjà
   consultable et filtrable, ce qui est la valeur minimale du lot.

### Livraison incrémentale

1. Setup + Foundational → base prête
2. User Story 1 → valider seule → banque consultable (MVP)
3. User Story 2 → valider seule → fiche exercice disponible
4. User Story 3 → valider seule → tableau de couverture disponible
5. Polish → `npm run typecheck && npm run lint && npm run test`, lien depuis l'accueil
