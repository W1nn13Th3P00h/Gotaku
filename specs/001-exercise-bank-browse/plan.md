# Implementation Plan: Banque d'exercices en lecture (Lot 1)

**Branch**: `001-exercise-bank-browse` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-exercise-bank-browse/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Écran « Banque » en lecture seule : recherche texte + filtres zone/type/matériel sur les
330 exercices déjà seedés en base, fiche exercice détaillée, et tableau de couverture par
zone pour piloter le remplissage de la banque. Approche technique : Server Components
Next.js qui interrogent Postgres/Supabase directement (recherche et agrégation de
couverture faites en base via des requêtes dédiées dans `lib/bank/`), sans aucune
mutation, dans la continuité de l'écran de socle déjà en place.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16, App Router, React 19 Server
Components)

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (lecture Postgres),
Tailwind CSS 4 (styles utilitaires, cf. `app/page.tsx`) ; Zod n'intervient pas dans cette
feature (déjà consommé côté seed, cf. `lib/bank/schema.ts`)

**Storage**: Postgres géré par Supabase — tables `exercises`, `exercise_zones`,
`exercise_equipment`, référentiels `zones`/`equipment`, vue `exercise_last_performed`
(toutes déjà créées au Lot 0, cf. `supabase/migrations/`). Aucune nouvelle table, aucune
écriture.

**Testing**: Vitest pour les fonctions pures de `lib/bank/` (formatage, agrégation de
couverture) ; PGlite pour un test d'intégration des requêtes de lecture si jugé utile à
l'étape tasks, dans la continuité de `lib/db/migrations.test.ts`.

**Target Platform**: application web responsive, PWA installable sur écran d'accueil iOS
(contrainte de plateforme du projet, mais non spécifique à cet écran en lecture seule).

**Project Type**: application web monolithique unique (pas de séparation
frontend/backend : Next.js App Router sert et rend depuis le même projet)

**Performance Goals**: filtrage perçu comme instantané pour l'utilisateur sur un volume
de 330 exercices (un aller-retour serveur par changement de filtre, sans latence
perceptible sur ce volume)

**Constraints**: lecture seule stricte (aucune mutation possible depuis cet écran) ;
seuls zone, type et matériel sont exposés comme axes de filtre ; position et intensity ne
doivent transiter dans aucune réponse envoyée au client ; interface en français,
identifiants et code en anglais

**Scale/Scope**: 330 exercices, 26 zones réparties en 9 régions, 4 types, 9 matériels ;
trois vues (liste/recherche/filtres, fiche exercice, tableau de couverture) pour un seul
utilisateur

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — N/A : cette feature ne touche pas à
  `lib/generator/`.
- **Principe II (banque = source de vérité versionnée)** — PASS : aucun écran de ce lot
  ne permet une écriture ; la seule voie de modification reste `data/exercises.json` puis
  `npm run seed` (FR-010).
- **Principe III (référentiels fermés, 3 axes exposés)** — PASS : les filtres et le
  tableau de couverture ne portent que sur zone/type/matériel (FR-003, FR-004) ;
  `position` et `intensity` sont explicitement exclus de tout affichage (FR-007).
- **Principe IV (historique immuable)** — PASS par construction : cette feature ne fait
  que lire `exercise_last_performed`, elle n'écrit jamais dans `session_items`.
- **Principe V (mono-utilisateur, pas de social)** — PASS : aucun partage, aucune notion
  de rôle introduite.
- **Stack imposée** — PASS : Next.js App Router, Tailwind, Supabase, aucun ORM
  supplémentaire.
- **Méthode de travail** — ce plan est le document de validation explicite avant
  implémentation, conforme à l'exigence de `CLAUDE.md`.

Aucune violation. Rien à documenter en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-exercise-bank-browse/
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
└── bank/
    ├── page.tsx              # Liste + recherche + filtres (User Story 1)
    ├── [slug]/
    │   └── page.tsx          # Fiche exercice en lecture seule (User Story 2)
    └── coverage/
        └── page.tsx          # Tableau de couverture par zone (User Story 3)

lib/
└── bank/
    ├── schema.ts             # Existant (Lot 0), inchangé
    ├── queries.ts            # Fonctions de lecture (liste filtrée, fiche, couverture) + mappers purs
    └── queries.test.ts       # Tests Vitest des mappers purs + de la fonction SQL zone_coverage (PGlite)

supabase/
└── migrations/
    └── <timestamp>_zone_coverage_fn.sql   # Fonction SQL zone_coverage(), lecture seule
```

**Structure Decision**: projet Next.js unique existant, pas de nouveau projet ni de
séparation frontend/backend. Les trois écrans vivent sous `app/bank/`, miroir des routes
déjà en place (`app/login`, `app/auth`). Les fonctions de lecture sont regroupées dans
`lib/bank/queries.ts`, aux côtés du schéma existant, sur le modèle déjà suivi par
`lib/generator/` (logique séparée de la couche React, testable isolément).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
