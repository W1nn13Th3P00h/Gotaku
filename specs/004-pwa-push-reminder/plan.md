# Implementation Plan: PWA et rappel push (Lot 5)

**Branch**: `004-pwa-push-reminder` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-pwa-push-reminder/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Manifest natif Next.js (`app/manifest.ts`) et service worker minimal
(`public/sw.js`, sans mise en cache — hors périmètre v1) pour rendre l'application
installable et capable de recevoir des push. Un écran de réglages détecte le mode
installé (`display-mode: standalone`) pour afficher soit les instructions d'ajout à
l'écran d'accueil, soit un bouton d'activation qui déclenche la demande de permission
et l'abonnement — jamais au chargement. La sélection des rappels dus et le traitement
des échecs d'abonnement sont deux modules purs et testés (`lib/reminders/due.ts`,
`lib/reminders/failures.ts`, écrits sans alias `@/` pour rester important **tels
quels** aussi bien par Vitest que par l'Edge Function Deno) : c'est la seule façon de
garantir la logique la plus délicate de ce lot (fenêtre de cinq minutes, fuseau horaire
par rappel, idempotence, dégressivité des échecs) sans dépendre d'un vrai envoi. La
génération des clés VAPID, le déploiement de l'Edge Function et la création du job
Supabase Cron restent des étapes manuelles, déjà annoncées comme telles dans
`.env.example`.

## Technical Context

**Language/Version**: TypeScript strict côté Next.js ; TypeScript Deno pour l'Edge
Function (`supabase/functions/send-reminders/`), qui importe directement
`lib/reminders/due.ts` et `lib/reminders/failures.ts` par chemin relatif (Deno résout
les imports relatifs `.ts` nativement, sans les alias `tsconfig`).

**Primary Dependencies**: manifest et Metadata API natifs de Next.js (aucune
dépendance PWA tierce, type `next-pwa`, ajoutée) ; Web Push API et Service Worker API
natifs du navigateur ; côté Edge Function, une bibliothèque de signature VAPID/Web
Push importée par spécificateur `npm:` (runtime Deno de Supabase Edge Functions),
aucun ajout aux dépendances npm du projet Next.js.

**Storage**: Postgres/Supabase — `push_subscriptions`, `reminders`, `reminder_sends`
déjà créées au Lot 0. Aucune nouvelle table, aucune migration de schéma (l'unicité
`(reminder_id, sent_on)` déjà en place porte toute l'idempotence, voir research.md).

**Testing**: Vitest pour `lib/reminders/due.ts` (sélection des rappels dus : fenêtre de
cinq minutes, jour de semaine et heure dans la timezone du rappel, exclusion
déjà-envoyé et déjà-complété-aujourd'hui) et `lib/reminders/failures.ts`
(classification 404/410 vs autre échec, seuil des cinq échecs consécutifs) ; PGlite
pour un test unique vérifiant que la contrainte d'unicité de `reminder_sends` rejette
bien un second envoi le même jour (le cœur réel de FR-009).

**Target Platform**: PWA installée sur écran d'accueil iOS (cible principale, cf.
`CLAUDE.md`) ; l'Edge Function tourne sur l'infrastructure Supabase (Deno), invoquée
par Supabase Cron.

**Project Type**: application web monolithique unique + une Edge Function Supabase
(premier composant hors du projet Next.js dans ce dépôt).

**Performance Goals**: le cycle de sélection (toutes les cinq minutes) doit rester
largement sous la minute d'exécution pour un seul rappel réel (`docs/roadmap.md` :
« un seul utilisateur réel ») — aucune exigence de charge au-delà.

**Constraints**: jamais de `Notification.requestPermission()` hors d'un geste
utilisateur explicite (déjà acté, `CLAUDE.md`) ; jamais de tentative d'abonnement avant
que l'app tourne en mode installé (`display-mode: standalone` sur iOS) ; jamais de
Vercel Cron pour la planification (`CLAUDE.md`) ; aucune génération ni dépôt réel de
secret VAPID par un agent d'implémentation (étape manuelle, voir Assumptions du spec).

**Scale/Scope**: au plus un rappel actif et quelques abonnements (un par appareil
installé) pour l'unique utilisateur réel de l'application.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — N/A directement, mais
  `lib/reminders/due.ts`/`failures.ts` suivent le même principe de pureté et de test
  par horodatage/entrées injectées, pour la même raison de fiabilité.
- **Principe II (banque = source de vérité versionnée)** — N/A : aucune interaction
  avec `exercises`/`data/exercises.json`.
- **Principe III (référentiels fermés, 3 axes exposés)** — N/A : aucun filtre
  zone/type/matériel dans cette feature.
- **Principe IV (historique immuable)** — PASS : cette feature lit `sessions`
  (complétion du jour) sans jamais l'écrire.
- **Principe V (mono-utilisateur, pas de social)** — PASS : un seul rappel par
  utilisateur, aucun partage d'abonnement.
- **Pièges de plateforme déjà tranchés** — c'est le cœur même de ce lot : permission
  sur geste explicite (FR-003), PWA installée requise (FR-001/FR-002), Supabase Cron et
  non Vercel Cron (FR-008).
- **Méthode de travail** — ce plan est le document de validation explicite avant
  implémentation.

Aucune violation. Rien à documenter en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-pwa-push-reminder/
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
├── manifest.ts                 # Manifest natif Next.js (MetadataRoute.Manifest)
└── settings/
    ├── page.tsx                 # Server Component : charge le rappel existant (ou son absence)
    └── settings-screen.tsx      # 'use client' : install/activation, formulaire du rappel

public/
├── sw.js                        # Service worker minimal : install/activate, push, notificationclick
└── icons/                       # Icônes du manifest (assets minimaux, voir Assumptions du spec)

lib/
├── push/
│   ├── vapid.ts                 # urlBase64ToUint8Array (pur)
│   ├── subscribe.ts             # Permission + abonnement navigateur, écrit push_subscriptions
│   └── queries.ts                # getReminder, upsertReminder (lib/sessions-like, RLS)
└── reminders/
    ├── due.ts                    # Pur, sans alias @/ : sélection des rappels dus
    ├── due.test.ts
    ├── failures.ts                # Pur : classification d'échec, seuil d'abandon
    └── failures.test.ts

supabase/
├── functions/
│   └── send-reminders/
│       └── index.ts               # Edge Function Deno : orchestration autour de lib/reminders/
└── migrations/
    └── (aucune nouvelle — schéma déjà complet depuis le Lot 0)
```

**Structure Decision**: projet Next.js existant + un premier composant Deno
(`supabase/functions/send-reminders/`). `lib/reminders/` reste sous `lib/` comme tout
le reste du code pur du projet (cohérence avec `lib/generator/`, `lib/session-player/`)
mais s'interdit l'alias `@/` pour pouvoir être importé tel quel par l'Edge Function
Deno, qui ne résout pas les chemins `tsconfig`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
