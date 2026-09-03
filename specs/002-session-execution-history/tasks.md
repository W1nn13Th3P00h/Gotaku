---

description: "Task list template for feature implementation"
---

# Tasks: Exécution de séance et historique (Lot 3)

**Input**: Design documents from `/specs/002-session-execution-history/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/session-player.md, contracts/sessions-queries.md, quickstart.md

**Tests**: incluses pour la machine à états (`lib/session-player/reducer.ts`, cœur
testable de cette feature, voir `research.md`) et pour la fonction SQL de synthèse
30 jours. Les requêtes de lecture déclaratives (`getSessionForExecution`,
`listSessionsForHistory`) n'ont pas de test dédié, validées via `quickstart.md`.

**Organization**: tâches groupées par user story (P1 → P3 dans `spec.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3)

## Path Conventions

Projet unique Next.js App Router : `app/session/[id]/`, `app/history/`,
`lib/session-player/`, `lib/sessions/`, `supabase/migrations/`.

---

## Phase 1: Setup

- [X] T001 [P] Créer les routes vides `app/session/[id]/page.tsx` (placeholder),
      `app/session/[id]/session-player-screen.tsx` (`'use client'`, placeholder), et
      `app/history/page.tsx` (placeholder)

**Checkpoint**: les deux URLs répondent (contenu placeholder, pas de 404).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `init()` positionne le lecteur sur le bon item au chargement — utilisé
aussi bien pour démarrer une séance neuve (US1) que pour en reprendre une (US2).

**⚠️ CRITICAL**: aucune tâche US1/US2 ne démarre avant la fin de cette phase.

- [X] T002 [P] Définir dans `lib/session-player/types.ts` : `PlayerState`,
      `PlayerItem`, `PlayerPhase` conformes à `data-model.md`
- [X] T003 [P] Définir dans `lib/sessions/queries.ts` les types `SessionForExecution`,
      `HistorySessionRow`, `HistorySummary30d` conformes à `data-model.md`
- [X] T004 [P] Écrire le test Vitest dans `lib/session-player/reducer.test.ts` pour
      `init(items, nowMs)` : une séance neuve (tous `pending`) démarre à l'index 0 ;
      une séance partiellement faite démarre au premier item `pending` ; une séance
      entièrement `done`/`skipped` retourne `phase: 'finished'` (doit échouer tant que
      T005 n'est pas fait — dépend de T002)
- [X] T005 Implémenter `init(items, nowMs)` dans `lib/session-player/reducer.ts`
      (dépend de T002, T004 ; contrat : `contracts/session-player.md`)

**Checkpoint**: `npm run test` passe sur `reducer.test.ts` (le seul test présent à ce
stade est celui de `init`).

---

## Phase 3: User Story 1 - Exécuter une séance du début à la fin (Priority: P1) 🎯 MVP

**Goal**: lecteur plein écran fonctionnel de bout en bout : décompte, pause/reprise,
passer/revenir, exercice asymétrique en deux phases, écran de fin qui termine la
séance.

**Independent Test**: démarrer une séance de test (créée directement en base),
dérouler `quickstart.md` étapes 1 à 8.

### Tests for User Story 1

- [X] T006 [P] [US1] Tests Vitest dans `lib/session-player/reducer.test.ts` pour
      `tick`/`pause`/`resume` : le temps restant se recalcule depuis l'horodatage de
      référence (pas de dérive sur des ticks irréguliers), `pause` fige le temps
      écoulé, `resume` repart exactement de ce point (scénarios d'acceptation US1 #2 à
      #4)
- [X] T007 [P] [US1] Tests Vitest pour `skip`/`back` : `skip` marque l'item `skipped`
      et avance immédiatement ; `back` remet l'item précédent à `pending` et redémarre
      son horodatage ; `back` sur le tout premier item est sans effet (scénarios #5,
      #6, edge cases correspondants)
- [X] T008 [P] [US1] Tests Vitest pour l'exercice asymétrique et la fin de séance :
      la phase droite puis la phase gauche sont traitées comme deux exercices à part
      entière ; `skip` sur la phase droite enchaîne sur la phase gauche (pas sur
      l'exercice suivant) ; le dernier item traité (réalisé ou passé) fait passer
      `phase` à `finished` (scénarios #7, #8, edge cases correspondants)

### Implementation for User Story 1

- [X] T009 [US1] Implémenter `tick`, `pause`, `resume` dans
      `lib/session-player/reducer.ts` (dépend de T005 ; fait passer T006)
- [X] T010 [US1] Implémenter `skip`, `back` dans `lib/session-player/reducer.ts`
      (dépend de T009 ; fait passer T007)
- [X] T011 [US1] Implémenter la gestion des deux phases d'un exercice asymétrique et
      la transition vers `phase: 'finished'` dans `lib/session-player/reducer.ts`
      (dépend de T010 ; fait passer T008)
- [X] T012 [US1] Implémenter `getSessionForExecution`, `startSession`,
      `markItemDone`, `markItemSkipped`, `completeSession` dans
      `lib/sessions/queries.ts` et `lib/sessions/mutations.ts` (dépend de T003 ;
      contrat : `contracts/sessions-queries.md`)
- [X] T013 [US1] Implémenter `app/session/[id]/page.tsx` : appelle
      `getSessionForExecution`, `notFound()` si `null`, rend
      `<SessionPlayerScreen session={...} />` (dépend de T012)
- [X] T014 [US1] Implémenter `session-player-screen.tsx` : boucle
      `requestAnimationFrame` qui appelle `tick` avec `performance.now()`, affiche
      décompte/nom/instructions/zones/aperçu du suivant, boutons pause/passer/revenir
      reliés au reducer, appelle `startSession` au montage, `markItemDone`/
      `markItemSkipped` à chaque item terminé (dépend de T009, T010, T011, T013)
- [X] T015 [US1] Ajouter le contexte WebAudio dans `session-player-screen.tsx` :
      initialisé sur le tap « démarrer » (geste utilisateur), signal synthétisé à 3
      secondes de la fin de la phase courante et à chaque changement d'exercice/côté,
      jamais `navigator.vibrate` (dépend de T014)
- [X] T016 [US1] Ajouter le Screen Wake Lock dans `session-player-screen.tsx` :
      demandé au démarrage, relâché à la sortie de l'écran (fin ou navigation hors de
      l'écran), repli silencieux si `navigator.wakeLock` est absent (dépend de T014)
- [X] T017 [US1] Implémenter l'écran de fin dans `session-player-screen.tsx` : durée
      réelle (écoulée depuis `started_at`), nombre d'exercices réalisés et passés,
      zones travaillées ; appelle `completeSession` quand `phase` devient `finished`
      (dépend de T011, T014)

**Checkpoint**: User Story 1 fonctionne seule et est démontrable de bout en bout.

---

## Phase 4: User Story 2 - Reprendre une séance quittée en cours de route (Priority: P2)

**Goal**: une séance non terminée aujourd'hui reste reprenable et redémarre exactement
là où elle en était.

**Independent Test**: démarrer une séance, la quitter avant l'écran de fin, revenir
sur `/session/<id>` le même jour et vérifier que `init()` (Phase 2) reprend
correctement au premier item `pending`.

### Implementation for User Story 2

- [X] T018 [US2] Implémenter `getResumableSessionsToday` dans `lib/sessions/queries.ts`
      : séances dont le statut effectif n'est ni `completed` ni `abandoned` (voir
      `data-model.md` § Statut effectif) (dépend de T003 ; contrat :
      `contracts/sessions-queries.md`)
- [X] T019 [US2] Implémenter `revertItemToPending` dans `lib/sessions/mutations.ts`,
      appelé par `session-player-screen.tsx` sur l'action « revenir » (dépend de T010,
      T012, T014)
- [X] T020 [P] [US2] Ajouter sur `app/page.tsx` (écran de socle du Lot 0) une section
      listant les séances de `getResumableSessionsToday`, chacune avec un lien vers
      `/session/[id]` — à déplacer vers l'écran Accueil réel de `docs/spec.md` quand il
      existera (dépend de T018)

**Checkpoint**: User Stories 1 et 2 fonctionnent ensemble ; une séance interrompue se
retrouve identique à son état quitté.

---

## Phase 5: User Story 3 - Consulter l'historique et la synthèse 30 jours (Priority: P3)

**Goal**: liste inversée des séances passées + synthèse des 30 derniers jours.

**Independent Test**: après avoir accumulé plusieurs séances sur et hors fenêtre de 30
jours, ouvrir `/history` et vérifier liste et synthèse.

### Tests for User Story 3

- [X] T021 [P] [US3] Ajouter la migration
      `supabase/migrations/20260903100000_session_history_summary_fn.sql` créant la
      fonction SQL `session_history_summary(since timestamptz)` : part du référentiel
      `zones`, agrège le temps travaillé (× 2 si `per_side`) sur les séances
      `completed` dont `completed_at >= since`, retourne une ligne par zone y compris
      à zéro (voir `research.md`)
- [X] T022 [US3] Écrire le test Vitest (PGlite, `createTestDb()`) dans
      `lib/sessions/queries.test.ts` : insère des séances de test à des dates
      distinctes (certaines avant/après `since`, certaines `completed`/`abandoned` non
      pertinentes), un exercice `per_side`, et vérifie fenêtre, zone à zéro incluse, et
      doublement du temps `per_side` (dépend de T021, doit échouer tant que T021 n'est
      pas fait)

### Implementation for User Story 3

- [X] T023 [US3] Implémenter `getHistorySummary30d` (RPC `session_history_summary`,
      retourne `null` si aucune séance sur la fenêtre) et `listSessionsForHistory`
      (statut effectif calculé par ligne) dans `lib/sessions/queries.ts` (dépend de
      T022, T003 ; contrat : `contracts/sessions-queries.md`)
- [X] T024 [US3] Implémenter `app/history/page.tsx` : liste inversée des séances,
      vue de synthèse, message explicite si `getHistorySummary30d` renvoie `null`
      (FR-017) (dépend de T023)

**Checkpoint**: les trois user stories fonctionnent indépendamment et ensemble.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Ajouter un lien vers `/history` depuis `app/page.tsx`
- [X] T026 Exécuter `npm run typecheck`, `npm run lint` et `npm run test` ; corriger
      toute régression avant de committer
- [ ] T027 Dérouler `quickstart.md` de bout en bout dans `npm run dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance
- **Foundational (Phase 2)**: dépend de Setup — bloque US1 et US2 (US3 ne dépend pas
  du reducer, seulement de ses propres types en T003)
- **User Story 1 (Phase 3)**: dépend de Foundational
- **User Story 2 (Phase 4)**: dépend de Foundational et, pour T019/T020, de morceaux
  de US1 (T010, T012, T014, T018)
- **User Story 3 (Phase 5)**: dépend de Setup + T003 uniquement, indépendante de
  US1/US2
- **Polish (Phase 6)**: dépend des user stories livrées

### Parallel Opportunities

- T002 et T003 en parallèle.
- Une fois Foundational fait, User Story 1 (Phase 3) et User Story 3 (Phase 5)
  peuvent avancer en parallèle : aucun fichier partagé avant la Polish.
- Au sein de US1 : T006, T007, T008 en parallèle (mêmes fichiers de test mais
  sections indépendantes, à fusionner avec attention) ; T015 et T016 en parallèle une
  fois T014 fait (effets de bord indépendants sur le même composant, à séquencer si
  un seul agent implémente).

---

## Implementation Strategy

### MVP First (User Story 1 seule)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (User Story 1)
2. Valider `quickstart.md` étapes 1 à 8 : une séance se fait de bout en bout, ce qui
   est la fin de lot énoncée par `docs/roadmap.md` (« une séance se fait de bout en
   bout et alimente la pondération de fraîcheur du générateur »).

### Livraison incrémentale

1. Setup + Foundational → base prête
2. User Story 1 → valider seule → exécution de bout en bout (MVP)
3. User Story 2 → valider seule → reprise fiable
4. User Story 3 → valider seule → historique et synthèse
5. Polish → gate `npm run typecheck && npm run lint && npm run test`
