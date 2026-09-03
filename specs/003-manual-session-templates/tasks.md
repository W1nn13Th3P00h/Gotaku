---

description: "Task list template for feature implementation"
---

# Tasks: Séance manuelle et modèles (Lot 4)

**Input**: Design documents from `/specs/003-manual-session-templates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/composition.md, quickstart.md ; dépend du Lot 1 (`app/bank/`) et du Lot 3
(`startSession`, `/session/[id]`), tous deux déjà spécifiés/planifiés.

**Tests**: incluses pour les deux fonctions pures de `lib/sessions/composition.ts`
(seul endroit à risque d'erreur silencieuse dans ce lot : clampage de durée, calcul de
durée totale). Le reste (requêtes et mutations déclaratives) est validé manuellement
via `quickstart.md`, comme les requêtes de lecture des Lots 1 et 3.

**Organization**: tâches groupées par user story (P1 → P3 dans `spec.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3)

## Path Conventions

`app/bank/` (Lot 1, existant), `app/compose/` (nouveau), `app/session/[id]` (Lot 3),
`lib/sessions/` (étendu depuis le Lot 3).

---

## Phase 1: Setup

- [X] T001 [P] Créer les routes vides `app/compose/page.tsx`,
      `app/compose/compose-screen.tsx` (`'use client'`, placeholder), et
      `app/compose/templates/page.tsx`

**Checkpoint**: les deux URLs répondent (contenu placeholder).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: le clampage de durée et le calcul de durée totale sont utilisés à la fois
par la composition (US1) et par l'affichage des modèles (US3).

**⚠️ CRITICAL**: aucune tâche US1/US2/US3 ne démarre avant la fin de cette phase.

- [X] T002 [P] Définir dans `lib/sessions/queries.ts` les types `CompositionForEdit` et
      `TemplateSummary` conformes à `data-model.md`
- [X] T003 [P] Écrire les tests Vitest dans `lib/sessions/composition.test.ts` pour
      `computeTotalDurationS` (avec et sans exercices `perSide`) et `clampDurationS`
      (valeur dans la plage, sous la borne basse, au-dessus de la borne haute, valeur
      non entière) — doit échouer tant que T004 n'est pas fait
- [X] T004 Implémenter `computeTotalDurationS` et `clampDurationS` dans
      `lib/sessions/composition.ts` (dépend de T003 ; contrat :
      `contracts/composition.md`)

**Checkpoint**: `npm run test` passe sur `composition.test.ts`.

---

## Phase 3: User Story 1 - Composer une séance à la main et la démarrer (Priority: P1) 🎯 MVP

**Goal**: ajouter des exercices depuis la banque, réordonner, ajuster les durées,
démarrer directement.

**Independent Test**: `quickstart.md` étapes 1 à 6.

### Implementation for User Story 1

- [X] T005 [US1] Implémenter `getOrCreateDraftComposition(supabase)` dans
      `lib/sessions/queries.ts` : cherche une séance `status = 'draft' AND
      source = 'manual'` pour l'utilisateur, la crée sinon (dépend de T002 ; contrat :
      `contracts/composition.md`)
- [X] T006 [US1] Implémenter `addItemToComposition`, `removeItemFromComposition`,
      `reorderItems`, `updateItemDuration` (via `clampDurationS`) dans
      `lib/sessions/mutations.ts` (dépend de T004, T005 ; contrat :
      `contracts/composition.md`)
- [X] T007 [US1] Ajouter l'action « ajouter à la composition » sur `app/bank/page.tsx`
      et `app/bank/[slug]/page.tsx` (Lot 1), appelant `addItemToComposition` (dépend de
      T006)
- [X] T008 [US1] Implémenter `app/compose/page.tsx` : appelle
      `getOrCreateDraftComposition`, rend `<ComposeScreen composition={...} />` (dépend
      de T005)
- [X] T009 [US1] Implémenter `compose-screen.tsx` : liste des items avec boutons
      monter/descendre (`reorderItems`), contrôle de durée clampé
      (`updateItemDuration`), retrait (`removeItemFromComposition`), durée totale
      recalculée en continu (`computeTotalDurationS`), bouton « démarrer » désactivé si
      la composition est vide, qui appelle `startSession` (contrat du Lot 3) puis
      navigue vers `/session/[id]` (dépend de T006, T008)

**Checkpoint**: User Story 1 fonctionne seule, de la banque au démarrage.

---

## Phase 4: User Story 2 - Sauvegarder une composition comme modèle (Priority: P2)

**Goal**: sauvegarder la composition en cours sous un nom, réutilisable plus tard.

**Independent Test**: `quickstart.md` étapes 7 et 8.

### Implementation for User Story 2

- [X] T010 [US2] Implémenter `saveAsTemplate(supabase, sessionId, name)` dans
      `lib/sessions/mutations.ts` : refuse un nom vide/espaces ou une composition vide,
      copie sinon `session_items` vers un nouveau `session_templates`/`template_items`
      (dépend de T005 ; contrat : `contracts/composition.md`)
- [X] T011 [US2] Ajouter le contrôle de sauvegarde (champ nom + bouton) dans
      `compose-screen.tsx`, désactivé si la composition est vide, affichant l'erreur si
      `saveAsTemplate` renvoie `EMPTY_NAME` (dépend de T009, T010)

**Checkpoint**: User Stories 1 et 2 fonctionnent ensemble ; un modèle sauvegardé
apparaît indépendant de la composition d'origine (scénario US2 #4, vérifié
manuellement à cette étape).

---

## Phase 5: User Story 3 - Démarrer une séance à partir d'un modèle (Priority: P3)

**Goal**: liste des modèles, démarrage direct depuis l'un d'eux.

**Independent Test**: `quickstart.md` étapes 9 et 10.

### Implementation for User Story 3

- [X] T012 [US3] Implémenter `listTemplates(supabase)` dans `lib/sessions/queries.ts`
      (dépend de T002 ; contrat : `contracts/composition.md`)
- [X] T013 [US3] Implémenter `startSessionFromTemplate(supabase, templateId)` dans
      `lib/sessions/mutations.ts` : crée une nouvelle séance (`source: 'template'`),
      copie `template_items` → `session_items`, appelle `startSession` (contrat du
      Lot 3) (dépend de T002)
- [X] T014 [US3] Implémenter `app/compose/templates/page.tsx` : liste des modèles
      (`listTemplates`, nom/nombre d'exercices/durée totale), action « démarrer » par
      modèle (`startSessionFromTemplate` puis navigation vers `/session/[id]`) (dépend
      de T012, T013)
- [X] T015 [P] [US3] Ajouter un lien entre `/compose` et `/compose/templates` dans les
      deux sens (dépend de T009, T014)

**Checkpoint**: les trois user stories fonctionnent indépendamment et ensemble.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Ajouter un lien vers `/compose` depuis `app/page.tsx`
- [X] T017 Exécuter `npm run typecheck`, `npm run lint` et `npm run test` ; corriger
      toute régression
- [ ] T018 Dérouler `quickstart.md` de bout en bout, y compris l'étape 11 (reprise
      après fermeture d'onglet)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance
- **Foundational (Phase 2)**: dépend de Setup — bloque US1, US2, US3
- **User Story 1 (Phase 3)**: dépend de Foundational et du Lot 1 (`app/bank/`, déjà
  spécifié) pour T007
- **User Story 2 (Phase 4)**: dépend de US1 (une composition à sauvegarder)
- **User Story 3 (Phase 5)**: dépend de Foundational et du Lot 3 (`startSession`, déjà
  spécifié) ; indépendante du code de US1/US2 (T012/T013 ne touchent aucun fichier de
  US1/US2), mais n'a de données à afficher qu'une fois US2 utilisée au moins une fois
- **Polish (Phase 6)**: dépend des user stories livrées

### Parallel Opportunities

- T002 et T003 en parallèle.
- Une fois Foundational fait, T012/T013 (US3) peuvent avancer en parallèle du reste de
  US1 (fichiers disjoints), même si leur validation de bout en bout attend un modèle
  existant (US2).

---

## Implementation Strategy

### MVP First (User Story 1 seule)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (User Story 1)
2. Valider `quickstart.md` étapes 1 à 6 : composer et démarrer sans passer par le
   générateur, ce qui couvre déjà la moitié du nom du lot.

### Livraison incrémentale

1. Setup + Foundational → base prête
2. User Story 1 → valider seule → composition + démarrage direct (MVP)
3. User Story 2 → valider seule → sauvegarde en modèle
4. User Story 3 → valider seule → démarrage depuis un modèle
5. Polish → gate `npm run typecheck && npm run lint && npm run test`
