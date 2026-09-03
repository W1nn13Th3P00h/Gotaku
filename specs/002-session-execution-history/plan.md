# Implementation Plan: Exécution de séance et historique (Lot 3)

**Branch**: `002-session-execution-history` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-session-execution-history/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Lecteur de séance plein écran (client) piloté par une machine à états pure et testable
(`lib/session-player/`), sur le modèle déjà établi par `lib/generator/` : le décompte,
la pause/reprise, le passage/retour, et le déroulement en deux phases d'un exercice
asymétrique sont des transitions pures pilotées par un horodatage injecté, pas du
`setInterval` naïf dispersé dans un composant React. Autour de ce cœur, une coquille
client fine branche timer réel, WebAudio (signaux synthétisés, aucun fichier audio),
Screen Wake Lock, et écrit la progression dans `sessions`/`session_items` au fil de
l'eau via le client Supabase du navigateur (RLS déjà en place). Le statut « abandonnée »
n'est jamais écrit explicitement : il est calculé à la lecture (séance non terminée dont
le jour de début n'est plus aujourd'hui), ce qui satisfait directement l'exigence de
reprise « le jour même » sans tâche de fond. L'historique et sa synthèse 30 jours
s'appuient sur une nouvelle fonction SQL testée via PGlite pour le seul calcul à risque
d'erreur silencieuse (volume par zone sur une fenêtre glissante), sur le même principe
que `zone_coverage()` du Lot 1.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16, App Router, React 19 ; premier lot
de ce projet avec un composant client à état riche, au-delà du formulaire de connexion)

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (lecture et écriture
directes depuis le client, RLS déjà en place sur `sessions`/`session_items`) ; API
navigateur natives uniquement pour le temps réel — WebAudio (signaux synthétisés),
Screen Wake Lock — aucune nouvelle dépendance npm.

**Storage**: Postgres/Supabase — tables `sessions`, `session_items` déjà créées au
Lot 0 ; une nouvelle fonction SQL (`session_history_summary`) ajoutée par migration
pour l'agrégation de la synthèse 30 jours. Aucune nouvelle table.

**Testing**: Vitest pour `lib/session-player/reducer.ts` (machine à états pure : pause,
reprise, passer, revenir, phases d'un exercice asymétrique, détection de fin de
séance — tous les scénarios d'acceptation de User Story 1 sont couverts ici, avec un
horodatage injecté, sans timer réel) ; PGlite pour la fonction SQL de synthèse 30 jours,
sur le modèle de `lib/db/migrations.test.ts` et de `zone_coverage()` (Lot 1).

**Target Platform**: web, usage principal sur iPhone en PWA installée (Wake Lock,
WebAudio, pas de `navigator.vibrate` — contraintes déjà actées dans `CLAUDE.md`).

**Project Type**: application web monolithique unique (inchangé depuis le Lot 1).

**Performance Goals**: le décompte affiché ne doit pas dériver de plus d'une seconde sur
une séance de 45 minutes (recalcul depuis un horodatage de référence à chaque tick,
jamais par décrément cumulatif) ; les écritures de progression ne doivent pas bloquer
l'affichage du décompte (écriture asynchrone, non bloquante pour l'UI).

**Constraints**: aucune vibration ; la demande de Wake Lock et l'initialisation du
contexte WebAudio doivent partir d'un geste utilisateur explicite (tap sur « démarrer »),
jamais au chargement ; le statut « abandonnée » n'est jamais un état stocké
explicitement, seulement calculé à la lecture ; aucune tâche de fond (pas de Supabase
Cron dans ce lot, réservé au Lot 5).

**Scale/Scope**: une séance compte au plus quelques dizaines d'exercices ; un seul
utilisateur ; trois écrans (exécution, écran de fin intégré à l'exécution, historique
avec sa synthèse).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — N/A directement (cette feature ne modifie
  pas `lib/generator/`), mais `lib/session-player/reducer.ts` est conçu dans le même
  esprit (pur, testé, aucune dépendance au temps réel ou à React) pour la même raison :
  c'est la logique la plus délicate à obtenir juste (pause/reprise, phases, bornes de
  séance), donc celle qui a le plus besoin d'être testée sérieusement.
- **Principe II (banque = source de vérité versionnée)** — PASS : aucune écriture sur
  `exercises`/`data/exercises.json`. Les durées écrites dans `session_items` sont déjà
  des instantanés posés à la création de la séance (Lot 2), cette feature ne fait que
  changer leur `status`.
- **Principe III (référentiels fermés, 3 axes exposés)** — N/A : aucun filtre par
  zone/type/matériel dans cette feature ; les zones affichées le sont à titre
  informatif (zones travaillées par l'exercice en cours, synthèse), jamais comme
  filtre.
- **Principe IV (historique immuable)** — PASS directement : cette feature EST la
  fabrication de l'historique. `session_items.duration_s` n'est jamais réécrit après
  coup ; seul `status` change pendant l'exécution.
- **Principe V (mono-utilisateur, pas de social)** — PASS : RLS déjà scopée à
  `user_id = auth.uid()`, aucune fonctionnalité de partage.
- **Pièges de plateforme déjà tranchés** — PASS : Wake Lock demandé sur geste
  utilisateur et relâché à la sortie (FR-009) ; WebAudio initialisé au même moment ;
  aucun `navigator.vibrate` (FR-007) ; aucun Supabase Cron introduit ici.
- **Méthode de travail** — ce plan est le document de validation explicite avant
  implémentation, conforme à `CLAUDE.md`.

Aucune violation. Rien à documenter en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-session-execution-history/
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
├── session/
│   └── [id]/
│       ├── page.tsx                  # Server Component : charge la séance + items, ownership via RLS
│       └── session-player-screen.tsx # 'use client' : timer réel, WebAudio, Wake Lock, écritures, écran de fin
└── history/
    └── page.tsx                      # Server Component : liste + synthèse 30 jours

lib/
├── session-player/
│   ├── types.ts           # PlayerState, PlayerItem, événements
│   ├── reducer.ts         # Machine à états pure : start/tick/pause/resume/skip/back
│   └── reducer.test.ts    # Vitest, horodatages injectés, tous les scénarios US1 + edge cases
└── sessions/
    ├── queries.ts          # getSessionForExecution, listSessionsForHistory, getResumableSessionsToday, getHistorySummary30d
    ├── mutations.ts        # startSession, markItemDone, markItemSkipped, completeSession
    └── queries.test.ts     # PGlite : la fonction SQL session_history_summary uniquement

supabase/
└── migrations/
    └── <timestamp>_session_history_summary_fn.sql
```

**Structure Decision**: même projet Next.js unique. `lib/session-player/` isole la
machine à états (pure, testée) de `lib/sessions/` (accès aux données, écritures) et de
`app/session/[id]/` (l'assemblage React + APIs navigateur). C'est la même séparation
que le Lot 1 entre `lib/bank/queries.ts` et `app/bank/`, appliquée ici en plus à la
logique de timing elle-même, qui le justifie encore davantage.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
