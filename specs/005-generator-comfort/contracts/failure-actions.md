# Contrat interne : `lib/generator/failure-actions.ts`

Module pur (aucun import de React, Supabase, `Date.now()`, `Math.random()` — même
règle que le reste de `lib/generator/`, Constitution Principe I).

## `suggestRecovery(detail: FailureDetail, current: GeneratorInput, durationPresetsMin: readonly number[]): GeneratorInput | null`

- `detail.reason === 'ZONES_UNSERVABLE'` → retourne `current` avec `zones` filtrées
  pour exclure `detail.droppedZones`. Si le résultat aurait une liste `zones` vide (ne
  devrait pas arriver, cf. edge case de `spec.md`), retourne `null` plutôt qu'un input
  invalide.
- `detail.reason === 'BUDGET_TOO_SMALL'` → retourne `current` avec `targetDurationS`
  égal au premier élément de `durationPresetsMin` (converti en secondes) qui est ≥
  `detail.minViableDurationS` ; si aucun ne l'atteint, utilise le plus grand élément de
  `durationPresetsMin`.
- `detail.reason === 'EMPTY_CATALOG'` et `detail.dominantCause` ∈
  `{'equipment', 'both'}` → retourne `current` avec `equipment: []`.
- `detail.reason === 'EMPTY_CATALOG'` et `detail.dominantCause === 'zones'` → `null`.

Ne modifie jamais `current` en place (retourne un nouvel objet ou `null`). N'accède à
aucun état extérieur : tout ce dont la fonction a besoin est dans ses paramètres.

## Hors contrat

- Ne relance jamais la génération elle-même : c'est à l'appelant (`generator-screen.tsx`)
  d'utiliser l'input retourné pour appeler `generateSession`.
- Ne modifie jamais `GeneratorContext` (catalogue, historique, seed) : uniquement
  `GeneratorInput`.
