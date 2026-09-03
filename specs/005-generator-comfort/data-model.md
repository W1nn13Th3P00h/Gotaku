# Phase 1 — Data Model: Confort du générateur (Lot 6)

Aucune table touchée. Cette feature ajoute un champ à un type déjà existant
(`GeneratorInput`) et un type de retour pour la nouvelle fonction pure.

## GeneratorInput (existant, `lib/generator/types.ts`) — un champ ajouté

| Champ | Type | Défaut | Note |
|---|---|---|---|
| `toleranceS` | `number` (optionnel) | `TOLERANCE_S` (15) si absent | agit uniquement sur l'étape 5 (ajustement fin), voir `docs/generator.md` |

Tous les autres champs sont inchangés.

## RecoverySuggestion (nouveau, en mémoire, `lib/generator/failure-actions.ts`)

`suggestRecovery` ne retourne pas un type dédié : directement un `GeneratorInput | null`
(le prochain input à utiliser pour relancer, ou `null` si aucune suggestion
raisonnable). Pas de nouvelle entité de données : c'est une transformation pure d'un
`GeneratorInput` existant, à partir d'un `FailureDetail` existant.

| Motif d'échec | Transformation appliquée |
|---|---|
| `ZONES_UNSERVABLE` | `zones` réduites aux zones non listées dans `detail.droppedZones` |
| `BUDGET_TOO_SMALL` | `targetDurationS` porté au premier preset de durée ≥ `detail.minViableDurationS` |
| `EMPTY_CATALOG`, cause `equipment` ou `both` | `equipment` vidé |
| `EMPTY_CATALOG`, cause `zones` | aucune suggestion (`null`) |

## ZonePreset (existant, `lib/presets.ts`) — trois entrées ajoutées, structure inchangée

| `label` | `zones` |
|---|---|
| Cou et épaules | `neck`, `shoulders`, `shoulder_rotators`, `traps`, `pecs` |
| Hanches et bassin | `hip_flexors`, `hip_rotators`, `glutes`, `adductors` |
| Bras et avant-bras | `biceps`, `triceps`, `forearm_flexors`, `forearm_extensors` |

## Relations

Aucune — modifications localisées à des types et constantes déjà en mémoire, aucune
nouvelle relation entre entités.
