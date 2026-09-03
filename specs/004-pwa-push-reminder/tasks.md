---

description: "Task list template for feature implementation"
---

# Tasks: PWA et rappel push (Lot 5)

**Input**: Design documents from `/specs/004-pwa-push-reminder/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/reminders-logic.md, contracts/settings-screen.md, quickstart.md

**Tests**: incluses pour les deux modules purs (`lib/reminders/due.ts`,
`lib/reminders/failures.ts`, seule logique de ce lot vérifiable sans envoi réel) et pour
la contrainte d'unicité de `reminder_sends` (PGlite). Le reste (formulaire de réglages,
Edge Function elle-même) est validé manuellement via `quickstart.md`, un vrai envoi ne
pouvant de toute façon être vérifié que sur un appareil réel après les étapes
manuelles de déploiement.

**⚠️ Étapes manuelles hors périmètre de ces tâches** : génération des clés VAPID, dépôt
des secrets, déploiement de l'Edge Function, création du job Supabase Cron — voir
`quickstart.md` § Pré-requis. Aucune tâche ci-dessous ne les exécute.

**Organization**: tâches groupées par user story (P1 → P3 dans `spec.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut s'exécuter en parallèle (fichiers différents, pas de dépendance)
- **[Story]**: user story concernée (US1, US2, US3)

## Path Conventions

`app/manifest.ts`, `app/settings/`, `public/sw.js`, `lib/push/`, `lib/reminders/`,
`supabase/functions/send-reminders/`.

---

## Phase 1: Setup

- [ ] T001 [P] Créer `app/manifest.ts` (nom, icônes, `start_url`,
      `display: 'standalone'`, couleurs) et des icônes minimales dans `public/icons/`
      (voir Assumptions de `spec.md` : un monogramme suffit pour ce lot)
- [ ] T002 [P] Créer `public/sw.js` minimal (`install`/`activate` sans mise en cache)
- [ ] T003 [P] Créer les routes vides `app/settings/page.tsx` et
      `app/settings/settings-screen.tsx` (`'use client'`, placeholder)

**Checkpoint**: le manifest est servi, `/settings` répond, le service worker
s'enregistre sans erreur console.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: le service worker doit être enregistré avant qu'un abonnement (US1) ou
qu'une notification reçue (US3) n'ait de sens.

**⚠️ CRITICAL**: aucune tâche US1/US3 ne démarre avant la fin de cette phase.

- [ ] T004 Enregistrer le service worker (`navigator.serviceWorker.register('/sw.js')`)
      au montage d'un composant client global (dans `app/settings/settings-screen.tsx`
      ou un composant partagé monté dans `app/layout.tsx`) (dépend de T002, T003)

**Checkpoint**: le service worker est actif (`navigator.serviceWorker.ready` résolu)
avant toute tentative d'abonnement.

---

## Phase 3: User Story 1 - Installer la PWA et activer les notifications (Priority: P1) 🎯 MVP

**Goal**: écran d'installation tant que l'app n'est pas ajoutée à l'écran d'accueil,
puis bouton d'activation qui déclenche permission + abonnement sur tap explicite.

**Independent Test**: `quickstart.md` étapes 1 à 4.

### Implementation for User Story 1

- [ ] T005 [US1] Implémenter la détection du mode installé (`matchMedia('(display-mode:
      standalone)')`, repli `navigator.standalone`) et l'écran d'installation dans
      `settings-screen.tsx` (dépend de T003 ; contrat : `contracts/settings-screen.md`)
- [ ] T006 [P] [US1] Implémenter `urlBase64ToUint8Array` dans `lib/push/vapid.ts`
      (dépend de rien, pur)
- [ ] T007 [US1] Implémenter `subscribeToPush()` dans `lib/push/subscribe.ts` :
      `Notification.requestPermission()` puis `pushManager.subscribe(...)` puis
      écriture dans `push_subscriptions`, jamais appelée hors d'un geste utilisateur
      (dépend de T004, T006 ; contrat : `contracts/settings-screen.md`)
- [ ] T008 [US1] Brancher le bouton « activer les notifications » dans
      `settings-screen.tsx` sur `subscribeToPush()`, afficher l'état résultant
      (activé / refusé), sans re-demande automatique (dépend de T005, T007)

**Checkpoint**: User Story 1 fonctionne seule : installer, activer, abonnement visible
en base.

---

## Phase 4: User Story 2 - Régler l'heure et les jours du rappel (Priority: P2)

**Goal**: formulaire de réglage d'un rappel unique (heure, jours, timezone,
activation), persistant.

**Independent Test**: `quickstart.md` étapes 5 et 6.

### Implementation for User Story 2

- [ ] T009 [US2] Implémenter `getReminder`/`upsertReminder` dans `lib/push/queries.ts`
      (refuse `NO_WEEKDAY` si actif sans aucun jour, FR-007) (contrat :
      `contracts/settings-screen.md`)
- [ ] T010 [US2] Implémenter `app/settings/page.tsx` : charge `getReminder`, transmet à
      `<SettingsScreen reminder={...} />` (dépend de T009)
- [ ] T011 [US2] Implémenter le formulaire du rappel dans `settings-screen.tsx` :
      heure locale, jours de la semaine, timezone détectée par défaut et modifiable
      (`Intl.DateTimeFormat().resolvedOptions().timeZone`), activation ; appelle
      `upsertReminder` à la sauvegarde (dépend de T003, T009, T010)

**Checkpoint**: User Stories 1 et 2 fonctionnent ensemble ; un rappel réglé se relit
identique après rechargement.

---

## Phase 5: User Story 3 - Recevoir le rappel au bon moment, une seule fois (Priority: P3)

**Goal**: sélection des rappels dus, envoi idempotent, gestion des échecs, clic vers
le générateur.

**Independent Test**: `quickstart.md` § Valider de bout en bout (nécessite les étapes
manuelles de déploiement au préalable) ; la logique de sélection et de dégressivité
des échecs se valide sans cela via les tests automatiques ci-dessous.

### Tests for User Story 3

- [ ] T012 [P] [US3] Tests Vitest dans `lib/reminders/due.test.ts` pour
      `selectDueReminders` : rappel inactif jamais retenu ; jour/heure correspondants
      mais jour hors `weekdays` jamais retenu ; rappel proche de minuit local utilisant
      le jour local (pas UTC) ; rappel déjà dans `alreadySentReminderIds` jamais
      retenu ; rappel dont l'utilisateur est dans `completedTodayUserIds` jamais
      retenu (doit échouer tant que T015 n'est pas fait)
- [ ] T013 [P] [US3] Tests Vitest dans `lib/reminders/failures.test.ts` pour
      `nextSubscriptionState` : 404/410 → `delete` dès le premier échec ; 5ᵉ échec
      consécutif → `delete` ; échec avant le 5ᵉ → `increment` ; succès → `reset`,
      y compris à zéro échec (doit échouer tant que T016 n'est pas fait)
- [ ] T014 [P] [US3] Test PGlite (`createTestDb()` de `lib/db/test-db.ts`) dans
      `lib/reminders/reminder-sends.test.ts` : un premier `insert ... on conflict do
      nothing` sur `(reminder_id, sent_on)` réussit et retourne une ligne, un second
      insert identique le même jour ne retourne aucune ligne (voir research.md § Idempotence)

### Implementation for User Story 3

- [ ] T015 [US3] Implémenter `selectDueReminders` dans `lib/reminders/due.ts`, sans
      alias `@/` (dépend de T012 ; fait passer T012 ; contrat :
      `contracts/reminders-logic.md`)
- [ ] T016 [US3] Implémenter `nextSubscriptionState` dans `lib/reminders/failures.ts`,
      sans alias `@/` (dépend de T013 ; fait passer T013 ; contrat :
      `contracts/reminders-logic.md`)
- [ ] T017 [US3] Ajouter les gestionnaires `push` et `notificationclick` dans
      `public/sw.js` : affiche la notification reçue, et sur clic ouvre `/generateur`
      (dépend de T002)
- [ ] T018 [US3] Implémenter `supabase/functions/send-reminders/index.ts` :
      charge les rappels actifs et, par rappel, les envois déjà faits aujourd'hui et
      les séances déjà complétées aujourd'hui (calculés dans la timezone du rappel),
      appelle `selectDueReminders`, pour chaque rappel dû réclame l'envoi (`insert ...
      on conflict do nothing`, voir T014), envoie le Web Push signé VAPID à chaque
      abonnement actif de l'utilisateur, applique `nextSubscriptionState` sur chaque
      résultat d'envoi (dépend de T014, T015, T016 ; contrat :
      `contracts/reminders-logic.md`)

**Checkpoint**: les trois user stories sont complètes ; le déploiement réel et le test
sur téléphone restent les étapes manuelles de `quickstart.md`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Ajouter un lien vers `/settings` depuis `app/page.tsx`
- [ ] T020 Exécuter `npm run typecheck`, `npm run lint` et `npm run test` ; corriger
      toute régression
- [ ] T021 Dérouler les parties automatisables de `quickstart.md` (étapes 1 à 6) ;
      rappeler explicitement à l'utilisateur les étapes manuelles avant tout test de
      bout en bout réel (clés VAPID, déploiement, Cron)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance
- **Foundational (Phase 2)**: dépend de Setup — bloque US1 et US3 (US2 n'a pas besoin
  du service worker enregistré pour son propre formulaire)
- **User Story 1 (Phase 3)**: dépend de Foundational
- **User Story 2 (Phase 4)**: dépend de Setup uniquement (T003, T009) — indépendante de
  US1/US3 dans son code, bien que les deux stories partagent le même fichier
  `settings-screen.tsx`
- **User Story 3 (Phase 5)**: dépend de Setup (T002) ; sa validation de bout en bout
  dépend en plus de US1 (un abonnement à qui envoyer) et des étapes manuelles de
  déploiement
- **Polish (Phase 6)**: dépend des user stories livrées

### Parallel Opportunities

- T001, T002, T003 en parallèle.
- T012, T013, T014 en parallèle (fichiers de test distincts).
- T006 est indépendante de tout le reste (pure, sans dépendance).

---

## Implementation Strategy

### MVP First (User Story 1 seule)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (User Story 1)
2. Valider `quickstart.md` étapes 1 à 4 : l'application est installable et un
   abonnement peut être enregistré, ce qui est la condition sans laquelle rien d'autre
   dans ce lot n'a de sens.

### Livraison incrémentale

1. Setup + Foundational → base prête
2. User Story 1 → valider seule → installation + abonnement (MVP)
3. User Story 2 → valider seule → réglage du rappel
4. User Story 3 → tests automatiques d'abord (logique de sélection/échecs, sans
   dépendre du déploiement), puis étapes manuelles, puis validation de bout en bout sur
   un appareil réel
5. Polish → gate `npm run typecheck && npm run lint && npm run test`

---

## Phase 7: Convergence

- [x] T022 Rendre `createTestDb()` (`lib/db/test-db.ts`) tolérant à l'indisponibilité de
      `pg_cron`/`pg_net` sous PGlite : la migration de ce lot,
      `supabase/migrations/20260903120000_reminders_cron.sql`, active ces deux
      extensions, absentes de PGlite, ce qui fait actuellement échouer
      `createTestDb()` dès qu'elle est rejouée — cassant silencieusement
      `lib/db/migrations.test.ts`, `lib/bank/queries.test.ts`,
      `lib/sessions/queries.test.ts` et le test T014 de ce lot lui-même
      (`lib/reminders/reminder-sends.test.ts`, seule vérification automatique de
      l'idempotence FR-009). `npm run test` est actuellement rouge sur 4 fichiers de
      test à cause de cette seule régression per FR-009 (contradicts)
