# Implementation Plan: Rappels multiples

**Branch**: `006-multiple-reminders` (worktree `reminder-multiple`) | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-multiple-reminders/spec.md`

## Summary

Le backend (table `reminders` sans contrainte d'unicité sur `user_id`, RLS
`reminders_own`, Edge Function `send-reminders`) gère déjà nativement N rappels par
utilisateur : la boucle de sélection/envoi traite chaque rappel actif indépendamment.
Aucune migration n'est nécessaire. Toute la limite « un seul rappel » est une
hypothèse purement applicative, à trois endroits : `lib/push/queries.ts` (lecture et
écriture bornées à un seul enregistrement), `lib/reminders/next.ts` (le calcul du
libellé « prochain rappel » de l'accueil prend un seul `Reminder | null`), et l'écran
`app/settings/settings-screen.tsx` (un seul formulaire, pas de liste). Cette feature
lève ces trois limites, sans toucher à `supabase/functions/send-reminders/` ni aux
migrations.

## Technical Context

**Language/Version**: TypeScript strict (inchangé)

**Primary Dependencies**: aucune nouvelle dépendance.

**Storage**: PostgreSQL/Supabase, table `reminders` existante, **aucun changement de
schéma** — l'absence de contrainte d'unicité sur `user_id` permettait déjà plusieurs
lignes ; seule l'application les traitait comme si elle était bornée à une.

**Testing**: Vitest. `lib/reminders/next.test.ts` (existant, 004) est réécrit pour la
nouvelle signature en tableau, avec des cas supplémentaires propres à la sélection
multi-rappels (rappel le plus proche parmi plusieurs, égalité entre deux rappels,
mélange actif/inactif). Pas de nouveau test PGlite : la table permettait déjà
plusieurs lignes par `user_id`, il n'y a pas de nouvelle contrainte à vérifier au
niveau SQL (contrairement à l'unicité de `reminder_sends` couverte par
`reminder-sends.test.ts`, inchangée).

**Target Platform**: web (PWA iOS/Safari, inchangé).

**Project Type**: application web monolithique unique (inchangé).

**Performance Goals**: aucune exigence nouvelle. `nextReminderLabel` reste une
fonction pure et immédiate, appelée sur une liste de quelques rappels au plus (usage
personnel).

**Constraints**: aucun changement de comportement pour un utilisateur qui n'a réglé
qu'un seul rappel (FR-008) — le cas à un seul élément d'un tableau doit se comporter
exactement comme l'ancien cas `Reminder | null` non nul.

**Scale/Scope**: un écran modifié (`app/settings/`), un module de requêtes réécrit
(`lib/push/queries.ts`), un module de calcul pur réécrit (`lib/reminders/next.ts`), un
point d'appel ajusté (`app/page.tsx`). Aucune nouvelle route, aucune nouvelle table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — N/A : aucune interaction avec
  `lib/generator/`.
- **Principe II (banque = source de vérité versionnée)** — N/A : aucune interaction
  avec `exercises`/`data/exercises.json`.
- **Principe III (référentiels fermés, 3 axes exposés)** — N/A : les rappels ne sont
  pas un axe de filtrage de la banque, aucun référentiel touché.
- **Principe IV (historique immuable)** — N/A : aucune écriture de séance.
- **Principe V (mono-utilisateur, pas de social)** — PASS avec vigilance : « plusieurs
  rappels » ne veut pas dire « plusieurs utilisateurs ». Chaque rappel reste rattaché à
  `user_id` de l'unique utilisateur réel (RLS `reminders_own` inchangée), aucune
  notion de partage, d'invitation ou de rôle n'est introduite.
- **Méthode de travail** — `docs/spec.md` § Rappel affirme aujourd'hui « Un seul
  rappel en v1. » ; cette phrase devient fausse et doit être corrigée dans le même
  changement que le code (Phase 1, ci-dessous), pas laissée comme dette documentaire.

Aucune violation. Rien à documenter en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-multiple-reminders/
├── plan.md                      # Ce fichier
├── research.md                  # Phase 0
├── data-model.md                # Phase 1
├── contracts/
│   ├── reminders-queries.md     # Phase 1 : lib/push/queries.ts
│   ├── next-reminder.md         # Phase 1 : lib/reminders/next.ts
│   └── settings-screen.md       # Phase 1 : app/settings/
├── quickstart.md                # Phase 1
└── tasks.md                     # Phase 2 (/speckit-tasks, pas ce lot-ci)
```

### Source Code (repository root)

```text
docs/
└── spec.md                          # Édité : retire « Un seul rappel en v1. »

lib/
├── push/
│   └── queries.ts                   # Réécrit : getReminders/createReminder/
│                                     #   updateReminder/deleteReminder
└── reminders/
    ├── next.ts                      # Réécrit : nextReminderLabel(reminders[], now)
    └── next.test.ts                 # Réécrit : cas multi-rappels

app/
├── page.tsx                         # Édité : getReminders (pluriel) → nextReminderLabel
└── settings/
    ├── page.tsx                     # Édité : getReminders (pluriel)
    └── settings-screen.tsx          # Réécrit : liste de rappels, ajout, suppression
```

**Structure Decision**: aucun nouveau projet, aucune nouvelle route, aucune migration.
Cette feature réécrit trois modules déjà en place (Lot 5) et ajuste leurs deux points
d'appel, dans les mêmes fichiers et la même architecture (Server Component qui charge,
Client Component qui édite).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
