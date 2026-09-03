# Phase 1 — Data Model: Séance manuelle et modèles (Lot 4)

Aucune nouvelle table (`sessions`, `session_items`, `session_templates`,
`template_items` existent depuis le Lot 0). Cette feature ajoute des lectures/écritures
sur ces tables, sous le statut/la source `draft`/`manual`/`template`.

## Composition en cours (vue de `sessions` + `session_items`)

| Champ | Origine | Note |
|---|---|---|
| `sessionId` | `sessions.id` | |
| `items` | `session_items` triés par `ord` | chacun avec `exerciseId`, `name`, `durationS`, `perSide`, `minS`/`maxS` (de l'exercice, pour le clampage) |
| `totalDurationS` | calculé (somme de `durationS`, × 2 si `perSide`) | recalculé côté client à chaque changement, pas seulement relu depuis la base |
| `isEmpty` | `items.length === 0` | conditionne la disponibilité de « démarrer »/« sauvegarder » (FR-009) |

`sessions.status` reste `'draft'` tant que l'utilisateur n'a pas démarré ;
`sessions.source` vaut `'manual'`.

## TemplateSummary (lecture, `lib/sessions/queries.ts`)

| Champ | Origine | Note |
|---|---|---|
| `id` | `session_templates.id` | |
| `name` | `session_templates.name` | |
| `itemCount` | `count(template_items)` | |
| `totalDurationS` | somme de `template_items.duration_s` (× 2 si `per_side`) | même convention que la composition |

## Mutations et leurs effets

| Mutation | Effet | Contrainte |
|---|---|---|
| `addItemToComposition(sessionId, exerciseId)` | insère un `session_items` à `ord = max(ord)+1`, `duration_s = duration_target_s` de l'exercice, `per_side = symmetry === 'asymmetric'` | aucune (doublons autorisés, FR-007) |
| `removeItemFromComposition(itemId)` | supprime la ligne, ne renumérote pas nécessairement `ord` (l'ordre relatif suffit) | |
| `reorderItems(sessionId, orderedItemIds)` | réécrit `ord` selon l'ordre fourni | |
| `updateItemDuration(itemId, requestedS)` | écrit `clampDurationS(exercise, requestedS)` (jamais la valeur brute) | FR-005 |
| `saveAsTemplate(sessionId, name)` | crée `session_templates` + copie `session_items` → `template_items` | refuse si `name` vide/espaces (FR-011) ou composition vide (FR-009) |
| `startSessionFromTemplate(templateId)` | crée une nouvelle `sessions` (`source: 'template'`) + copie `template_items` → `session_items`, puis appelle `startSession` (Lot 3) | |

## Relations

```text
sessions (draft, source=manual) 1───* session_items *───1 exercises
session_templates 1───* template_items *───1 exercises
```

Aucune relation entre `session_templates` et la `sessions` qui l'a éventuellement
produite : une fois sauvegardé, un modèle est indépendant (voir `research.md`).
