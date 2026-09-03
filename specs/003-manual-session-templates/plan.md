# Implementation Plan: Séance manuelle et modèles (Lot 4)

**Branch**: `003-manual-session-templates` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-manual-session-templates/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Composition manuelle modélisée comme une séance à l'état `draft` (`sessions`,
`source = 'manual'`), persistée à chaque changement exactement comme le Lot 3 persiste
la progression d'exécution — pas d'état de composition qui vivrait seulement en mémoire
côté client. L'écran banque (Lot 1) gagne une action « ajouter à la composition » ; un
nouvel écran `/compose` gère réordonnancement (boutons haut/bas, pas de bibliothèque de
glisser-déposer), ajustement de durée (borné à la plage de l'exercice), démarrage direct
et sauvegarde comme modèle. Démarrer, que ce soit depuis la composition ou depuis un
modèle, ne fait rien de plus que préparer une séance en base puis appeler
`startSession`/naviguer vers `/session/[id]` (Lot 3) : aucune logique d'exécution n'est
dupliquée ici.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16, App Router, React 19)

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (lecture/écriture
directe, RLS déjà en place sur `sessions`/`session_items`/`session_templates`/
`template_items`) ; aucune nouvelle dépendance — en particulier aucune bibliothèque de
glisser-déposer pour le réordonnancement.

**Storage**: Postgres/Supabase, tables déjà créées au Lot 0 (`sessions`, `session_items`,
`session_templates`, `template_items`). Aucune nouvelle table, aucune migration.

**Testing**: Vitest pour les fonctions pures de `lib/sessions/composition.ts` (calcul de
la durée totale, clampage d'une durée dans la plage de l'exercice) ; pas de test PGlite
dans ce lot, les requêtes restant des lectures/écritures déclaratives sur un schéma déjà
testé au Lot 0 (même raisonnement qu'au Lot 1 pour `listExercises`).

**Target Platform**: web, PWA installée sur iPhone (contraintes déjà actées, aucune
nouvelle contrainte de plateforme dans ce lot : pas de timer, pas de son, pas de Wake
Lock ici).

**Project Type**: application web monolithique unique (inchangé).

**Performance Goals**: chaque action de composition (ajout, retrait, réordonnancement,
ajustement) doit se refléter à l'écran sans attente perceptible, l'écriture Supabase se
faisant en arrière-plan (mise à jour optimiste de l'état affiché).

**Constraints**: aucune composition ni aucun modèle vide ne peut être démarré ou
sauvegardé (FR-009) ; toute durée retenue doit rester dans la plage de l'exercice
(FR-005) ; une composition en cours (`draft`) ne doit jamais apparaître dans l'historique
ni la liste des séances reprenables du Lot 3 (déjà corrigé dans
`002-session-execution-history/data-model.md`).

**Scale/Scope**: une composition ou un modèle compte au plus quelques dizaines
d'exercices ; un seul utilisateur ; une composition active à la fois (voir Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — N/A : cette feature ne touche pas
  `lib/generator/`.
- **Principe II (banque = source de vérité versionnée)** — PASS : aucune écriture sur
  `exercises`/`data/exercises.json` ; l'ajout d'un exercice à une composition ne fait
  que référencer un `exercise_id` existant.
- **Principe III (référentiels fermés, 3 axes exposés)** — N/A directement : aucun
  nouveau filtre introduit, la sélection d'exercices reste celle du Lot 1.
- **Principe IV (historique immuable)** — PASS explicitement : FR-014 exige l'instantané
  des durées à la création de la séance, indépendant de toute modification ultérieure de
  la banque ou du modèle d'origine.
- **Principe V (mono-utilisateur, pas de social)** — PASS : aucun partage de modèle
  entre utilisateurs, RLS déjà scopée par `user_id`.
- **Méthode de travail** — ce plan est le document de validation explicite avant
  implémentation.

Aucune violation. Rien à documenter en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-manual-session-templates/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── bank/
│   ├── page.tsx                 # Lot 1, existant — ajoute l'action « ajouter à la composition »
│   └── [slug]/page.tsx          # Lot 1, existant — même ajout sur la fiche exercice
└── compose/
    ├── page.tsx                 # Server Component : charge (ou crée) la composition en cours
    ├── compose-screen.tsx       # 'use client' : réordonnancement, durées, démarrer, sauvegarder
    └── templates/
        └── page.tsx             # Liste des modèles + démarrage depuis un modèle

lib/
└── sessions/
    ├── composition.ts           # Fonctions pures : durée totale, clampage de durée
    ├── composition.test.ts      # Vitest
    ├── queries.ts                # Existant (Lot 3) + ajouts : getOrCreateDraftComposition, listTemplates
    └── mutations.ts              # Existant (Lot 3) + ajouts : addItemToComposition, removeItem,
                                   #   reorderItems, updateItemDuration, saveAsTemplate,
                                   #   startSessionFromTemplate
```

**Structure Decision**: même projet Next.js unique. Cette feature étend
`lib/sessions/` (déjà créé au Lot 3) plutôt que de créer un nouveau module parallèle,
puisqu'elle manipule les mêmes entités (`sessions`/`session_items`) sous un autre statut
(`draft`). Seul `lib/sessions/composition.ts` est nouveau, pour isoler les deux
fonctions pures qui méritent un test sans base de données. `app/compose/` est un
nouveau groupe de routes, à côté de `app/bank/` (Lot 1) et `app/session/`/`app/history/`
(Lot 3).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
