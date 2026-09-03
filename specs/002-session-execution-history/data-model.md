# Phase 1 — Data Model: Exécution de séance et historique (Lot 3)

Aucune nouvelle table. Cette feature lit/écrit `sessions` et `session_items` (Lot 0),
lit `exercises`/`exercise_zones` pour l'affichage, et ajoute une seule fonction SQL de
lecture pour la synthèse 30 jours.

## PlayerState (module pur, `lib/session-player/types.ts`)

Pas persisté : état en mémoire du lecteur, reconstruit à chaque chargement depuis les
`session_items` déjà en base (voir « Reconstruction de l'état » plus bas).

| Champ | Type | Note |
|---|---|---|
| `phase` | `'idle' \| 'running' \| 'paused' \| 'finished'` | état global du lecteur |
| `items` | `PlayerItem[]` | copie des items de la séance, statut inclus |
| `currentIndex` | `number` | index dans `items` de l'exercice courant |
| `currentSide` | `'right' \| 'left' \| null` | phase en cours pour un exercice asymétrique, `null` sinon |
| `phaseStartedAtMs` | `number` | horodatage (injecté) de début de la phase courante |
| `elapsedBeforePauseMs` | `number` | temps déjà écoulé sur la phase courante avant une pause |

`PlayerItem` : `{ id, exerciseId, ord, durationS, perSide, status }` (miroir de
`session_items`, `status: 'pending' | 'done' | 'skipped'`).

**Transitions pures** (`reducer.ts`), chacune `(state, nowMs) → state` :
`start`, `tick`, `pause`, `resume`, `skip`, `back`. `tick` ne fait rien tant que le temps
restant de la phase courante est positif ; quand il atteint zéro, il émet la transition
vers la phase/exercice suivant (ou vers `finished` si plus rien à faire), exactement
comme le ferait un appel explicite mais déclenché par le temps plutôt que par
l'utilisateur.

## Session (existant, `sessions`)

Pas de nouvelle colonne. Champs lus/écrits par cette feature :

| Champ | Lu / Écrit | Note |
|---|---|---|
| `status` | écrit `in_progress` au démarrage, `completed` à la fin | jamais écrit `abandoned` (voir research.md) |
| `started_at` | écrit au démarrage si absent | sert au calcul du statut effectif « abandonnée » |
| `completed_at` | écrit à la fin | alimente `exercise_last_performed` |
| `actual_duration_s` | écrit à la fin | temps réellement écoulé, indépendant de `target_duration_s` |

**Statut effectif** (calculé, jamais stocké), défini seulement pour une séance déjà
démarrée (`status IN ('in_progress', 'completed')`, donc `started_at` non nul) :
`status === 'completed' ? 'completed' : (isToday(started_at) ? 'in_progress' : 'abandoned')`.

Une séance encore `status = 'draft'` (composition manuelle en cours, Lot 4) n'entre
**jamais** dans ce calcul ni dans l'historique/la liste des séances reprenables : elle
n'a pas encore d'`started_at` et n'appartient pas au domaine de cette feature tant
qu'elle n'a pas été démarrée (`startSession` la fait passer à `in_progress`, moment à
partir duquel elle devient une séance comme une autre pour ce lot).

## SessionItem (existant, `session_items`)

| Champ | Lu / Écrit | Note |
|---|---|---|
| `status` | écrit `done` ou `skipped` à chaque transition | jamais réécrit une fois posé, sauf reprise (« revenir » avant la fin de la séance peut remettre un item à `pending`, voir Assumptions) |
| `duration_s`, `per_side`, `ord`, `exercise_id` | lus seulement | instantanés déjà posés à la création (Lot 2), jamais modifiés ici (Principe IV) |

## HistorySessionRow (lecture, `lib/sessions/queries.ts`)

| Champ | Origine | Note |
|---|---|---|
| `id` | `sessions.id` | |
| `date` | `sessions.completed_at` ou `started_at` selon statut effectif | affichage seulement |
| `actualDurationS` | `sessions.actual_duration_s` | absent si jamais démarrée à terme |
| `exerciseCount` | `count(session_items)` | |
| `zonesWorked` | zones distinctes des exercices de la séance | via jointure `session_items` → `exercise_zones` |
| `effectiveStatus` | calculé (voir plus haut) | `completed \| in_progress \| abandoned` |

## HistorySummary30d (lecture, fonction SQL `session_history_summary`)

| Champ | Origine | Note |
|---|---|---|
| `zoneCode` | `zones.code` | toutes les zones du référentiel, y compris à 0 (même logique que `zone_coverage()`, Lot 1) |
| `secondsWorked` | somme de `session_items.duration_s` (× 2 si `per_side`) sur les séances `completed` avec `completed_at >= since` | |
| `sessionCount` | `count(distinct sessions.id)` sur la même fenêtre | identique pour chaque ligne, porté pour affichage direct |
| `totalVolumeS` | somme de `actual_duration_s` sur la fenêtre | |

`since` est fixé à 30 jours avant aujourd'hui par l'appelant (`getHistorySummary30d()`
dans `lib/sessions/queries.ts`), pas codé en dur dans la fonction SQL.

## Relations

```text
sessions 1───* session_items *───1 exercises 1───* exercise_zones *───1 zones (référentiel)
```
