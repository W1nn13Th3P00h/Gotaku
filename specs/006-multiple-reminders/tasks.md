---

description: "Task list template for feature implementation"
---

# Tasks: Rappels multiples

**Input**: Design documents from `/specs/006-multiple-reminders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: `lib/reminders/next.test.ts` existe déjà (Lot 5) et doit être réécrit pour la
nouvelle signature — inclus ci-dessous comme partie de l'implémentation de US3, pas
comme option séparée : la signature change de toute façon, le fichier ne compile plus
sans cette mise à jour.

**Organization**: Tasks groupées par user story (spec.md), dans l'ordre de priorité
P1 (US1, US3) puis P2 (US2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3)

## Phase 1: Setup

Aucune tâche : pas de nouvelle dépendance, pas de nouveau projet, aucune migration
(voir plan.md § Technical Context).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose** : la surface de requêtes est partagée par les trois user stories (US1 et
US3 ont besoin de `getReminders`, US2 de `deleteReminder`) ; la traiter comme un seul
fichier réécrit une fois évite de rouvrir `lib/push/queries.ts` à trois reprises dans
des phases différentes.

**⚠️ CRITICAL**: aucune story ne peut commencer avant la fin de cette phase.

- [X] T001 Réécrire `lib/push/queries.ts` : remplacer `getReminder`/`upsertReminder`
      par `getReminders(supabase): Promise<Reminder[]>`,
      `createReminder(supabase, input): Promise<SaveReminderResult>`,
      `updateReminder(supabase, id, input): Promise<SaveReminderResult>`,
      `deleteReminder(supabase, id): Promise<void>`, avec la règle `NO_WEEKDAY`
      partagée entre `createReminder` et `updateReminder` — garanties exactes dans
      `contracts/reminders-queries.md`.

**Checkpoint**: `lib/push/queries.ts` conforme au contrat — les trois stories peuvent
commencer.

---

## Phase 3: User Story 1 - Régler plusieurs rappels indépendants (Priority: P1) 🎯 MVP

**Goal**: pouvoir créer et modifier plusieurs rappels indépendants depuis l'écran de
réglages.

**Independent Test**: créer deux rappels à des horaires différents sur `/settings`,
recharger, modifier l'un des deux, vérifier que l'autre est intact (spec.md US1,
Acceptance Scenarios 1-2).

### Implementation for User Story 1

- [X] T002 [US1] Adapter `app/settings/page.tsx` pour charger `getReminders(supabase)`
      (pluriel) et transmettre le tableau à `SettingsScreen`.
- [X] T003 [US1] Réécrire `app/settings/settings-screen.tsx` : une carte par rappel
      (clé `id`) plus les cartes en cours d'ajout (clé locale non envoyée à la base),
      chacune avec son propre état (`timeLocal`, `weekdays`, `timezone`, `active`),
      son propre bouton Sauvegarder (`createReminder` si pas d'`id` encore,
      `updateReminder(id, …)` sinon) et ses propres messages d'erreur/succès isolés
      (même patron que la section Matériel déjà présente sur cet écran) ; bouton
      « Ajouter un rappel » qui insère une carte vide (timezone détectée
      pré-remplie) — détail dans `contracts/settings-screen.md`. Pas de bouton
      Supprimer à ce stade (US2).

**Checkpoint**: régler, afficher et modifier indépendamment plusieurs rappels
fonctionne de bout en bout.

---

## Phase 4: User Story 3 - Voir le prochain rappel à venir sur l'accueil (Priority: P1)

**Goal**: l'accueil affiche l'occurrence la plus proche parmi tous les rappels actifs.

**Independent Test**: régler deux rappels actifs à des horaires différents (via US1),
vérifier que l'accueil affiche l'occurrence la plus proche des deux, désactiver
celle-ci, vérifier que l'accueil bascule sur l'autre (spec.md US3, Acceptance
Scenarios 1-3).

### Implementation for User Story 3

- [X] T004 [P] [US3] Réécrire `lib/reminders/next.test.ts` pour la nouvelle
      signature `nextReminderLabel(reminders: ReminderSchedule[], now: Date)` :
      conserver tous les cas existants adaptés à un tableau à un élément (résultat
      identique bit à bit à l'ancien comportement, FR-008), ajouter les cas propres à
      plusieurs rappels listés dans `contracts/next-reminder.md` § Garanties (le plus
      proche parmi deux, égalité stricte → premier de la liste, rappel inactif jamais
      retenu même s'il serait le plus proche, tableau vide → `null`).
- [X] T005 [US3] Réécrire `nextReminderLabel` dans `lib/reminders/next.ts` pour
      accepter `reminders: ReminderSchedule[]` et retenir l'occurrence dont le nombre
      de minutes jusqu'à échéance est le plus petit (algorithme détaillé dans
      `research.md` § 1 et `contracts/next-reminder.md`), jusqu'à faire passer T004.
- [X] T006 [US3] Adapter `app/page.tsx` : appeler `getReminders(supabase)` (pluriel)
      et passer le tableau à `nextReminderLabel`.

**Checkpoint**: l'accueil reflète correctement le rappel le plus proche parmi
plusieurs, sans régression sur le cas à un seul rappel.

---

## Phase 5: User Story 2 - Supprimer un rappel devenu inutile (Priority: P2)

**Goal**: pouvoir supprimer un rappel sans affecter les autres.

**Independent Test**: avec deux rappels déjà réglés (via US1), supprimer l'un des
deux, vérifier qu'il disparaît et ne revient pas après rechargement, que l'autre est
intact (spec.md US2, Acceptance Scenario 1).

### Implementation for User Story 2

- [X] T007 [US2] Ajouter le bouton Supprimer aux cartes déjà sauvegardées (celles
      ayant un `id`) dans `app/settings/settings-screen.tsx` : appelle
      `deleteReminder(id)` puis retire la carte de l'état local ; une carte pas
      encore sauvegardée se retire simplement de l'état local sans appel réseau.

**Checkpoint**: les trois user stories fonctionnent ensemble, indépendamment
testables chacune.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T008 [P] Retirer la phrase « Un seul rappel en v1. » de `docs/spec.md` § Rappel
      (devenue fausse, Méthode de travail de la constitution — mise à jour dans le
      même changement que le code).
- [X] T009 Exécuter `npm run typecheck`, `npm run lint`, `npm run test`, puis valider
      manuellement le scénario de `quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: bloque toutes les user stories.
- **US1 (Phase 3)** et **US3 (Phase 4)**: toutes deux P1, indépendantes l'une de
  l'autre une fois Phase 2 terminée (fichiers distincts : `settings-screen.tsx` vs
  `next.ts`/`page.tsx`) — peuvent être menées en parallèle ou dans n'importe quel
  ordre.
- **US2 (Phase 5)**: dépend de T003 (US1) pour son fichier d'accueil (`settings-
  screen.tsx` doit déjà exister sous sa forme « liste de cartes ») — non parallèle à
  US1, mais indépendante de US3.
- **Polish (Phase 6)**: après les trois stories.

### Parallel Opportunities

- T004 (test) peut démarrer en parallèle de T002/T003 (US1) puisqu'il touche un
  fichier distinct ; T005 en dépend (fait passer le test).
- T008 (doc) est indépendant de tout code, exécutable à tout moment après la Phase 2.

## Implementation Strategy

### MVP First

1. Phase 2 (Foundational)
2. Phase 3 (US1) — **STOP and VALIDATE** : créer/modifier plusieurs rappels
   fonctionne.
3. Phase 4 (US3) — l'accueil reflète correctement plusieurs rappels actifs.
4. Phase 5 (US2) — confort de suppression.
5. Phase 6 (Polish).
