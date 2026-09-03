# Phase 1 — Data Model: Banque d'exercices en lecture (Lot 1)

Cette feature ne crée aucune table et n'écrit jamais en base : les entités ci-dessous
sont les modèles de lecture (formes de retour des fonctions de `lib/bank/queries.ts`),
construits à partir du schéma déjà existant depuis le Lot 0
(`supabase/migrations/20260902120100_exercises.sql`,
`supabase/migrations/20260902120200_sessions.sql`).

## ExerciseSummary

Ligne de la liste filtrée (User Story 1).

| Champ | Type | Origine | Note |
|---|---|---|---|
| `slug` | `string` | `exercises.slug` | identifiant d'URL de la fiche |
| `name` | `string` | `exercises.name` | cible de la recherche texte |
| `type` | `ExerciseType` | `exercises.type` | un des 4 types du référentiel |
| `primaryZone` | `ZoneCode` | `exercise_zones` où `is_primary` | mise en évidence dans l'UI |
| `zones` | `ZoneCode[]` | `exercise_zones` | toutes les zones travaillées |
| `equipment` | `EquipmentCode[]` | `exercise_equipment` | vide = sans matériel |
| `durationTargetS` | `number` | `exercises.duration_target_s` | secondes, entier |

`position` et `intensity` ne figurent **jamais** dans ce modèle : ils ne quittent pas la
couche `lib/bank/queries.ts` (FR-007, Constitution Principe III).

## ExerciseDetail

Fiche exercice (User Story 2). Étend `ExerciseSummary`.

| Champ | Type | Origine | Note |
|---|---|---|---|
| *(tous les champs de `ExerciseSummary`)* | | | |
| `instructions` | `string[]` | `exercises.instructions` | 1 à 6 lignes |
| `contraindications` | `string \| null` | `exercises.contraindications` | absent si non renseigné |
| `lastPerformedAt` | `string \| null` (ISO date) | vue `exercise_last_performed` | `null` = jamais réalisé, état valide (FR-006) |

**Validation / invariants hérités du schéma existant** (non revalidés ici, déjà garantis
par le Lot 0) : `primaryZone` ∈ `zones`, `durationMinS ≤ durationTargetS ≤ durationMaxS`,
`zones` non vide, pas de doublon dans `zones` ni `equipment`.

## ZoneCoverageRow

Ligne du tableau de couverture (User Story 3).

| Champ | Type | Origine | Note |
|---|---|---|---|
| `zoneCode` | `ZoneCode` | `zones.code` | toutes les zones du référentiel, y compris à 0 |
| `zoneLabel` | `string` | `lib/referentials.ts` (`zoneLabel`) | libellé affiché |
| `regionCode` | `RegionCode` | `zones.region` | pour un regroupement visuel par région |
| `exerciseCount` | `number` | fonction SQL `zone_coverage()` (nouvelle migration) | 0 si aucune, jamais absent — voir research.md |
| `isLowCoverage` | `boolean` | calculé en JS : `exerciseCount < ZONE_LOW_COVERAGE_THRESHOLD` | seuil fixé en Phase 0 (10) |

## Filtres de recherche (entrée, pas une entité stockée)

| Champ | Type | Note |
|---|---|---|
| `search` | `string \| undefined` | texte libre sur le nom |
| `zone` | `ZoneCode \| undefined` | une zone à la fois (cf. Assumptions du spec : sélection simple pour ce lot) |
| `type` | `ExerciseType \| undefined` | |
| `equipment` | `EquipmentCode \| undefined` | |

Portés par les `searchParams` de l'URL de `app/bank/page.tsx`, jamais par un state
client persistant.

## Relations

```text
zones (référentiel) 1───* exercise_zones *───1 exercises 1───* exercise_equipment *───1 equipment (référentiel)
exercises 1───* session_items ───* sessions  (lu via la vue exercise_last_performed, jamais écrit ici)
```
