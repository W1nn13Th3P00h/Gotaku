# Contrat interne : `lib/bank/queries.ts`

Pas d'API externe dans cette feature : le contrat qui compte est celui que les Server
Components de `app/bank/` (et, plus tard, tout autre lot qui a besoin de lire la banque —
par ex. le Lot 4, composition manuelle) consomment. Ce document fige les signatures pour
que `/speckit-tasks` et l'implémentation restent alignées avec `data-model.md`.

## `listExercises(filters: BankFilters): Promise<ExerciseSummary[]>`

- **Entrée** `BankFilters`: `{ search?: string; zone?: ZoneCode; type?: ExerciseType;
  equipment?: EquipmentCode }`
- **Sortie**: tableau d'`ExerciseSummary` (voir `data-model.md`), trié par `name`.
- **Comportement garanti**:
  - Filtres combinables (ET logique entre `search`, `zone`, `type`, `equipment`).
  - Aucun filtre fourni → tous les exercices actifs (`exercises.active = true`).
  - Aucun résultat → tableau vide (à l'appelant d'afficher le message explicite, FR-011).
  - Ne retourne jamais `position` ni `intensity`.

## `getExerciseBySlug(slug: string): Promise<ExerciseDetail | null>`

- **Sortie**: `ExerciseDetail` (voir `data-model.md`) ou `null` si le slug n'existe pas
  ou correspond à un exercice inactif.
- **Comportement garanti**: `lastPerformedAt` est `null` plutôt qu'absent quand
  l'exercice n'a jamais été réalisé (FR-006) ; ne retourne jamais `position` ni
  `intensity`.

## `getZoneCoverage(): Promise<ZoneCoverageRow[]>`

- **Sortie**: un `ZoneCoverageRow` par zone du référentiel (26 lignes), y compris les
  zones à zéro exercice (FR-008), avec `isLowCoverage` déjà calculé (seuil défini dans
  `research.md`).
- **Comportement garanti**: ordre stable (ordre du référentiel `ZONES`, cf.
  `lib/referentials.ts`), aucune zone omise.
- **Implémentation**: appelle `supabase.rpc('zone_coverage')`, une fonction SQL ajoutée
  par migration (voir `research.md`, testée directement contre PGlite dans
  `lib/bank/queries.test.ts`), puis attache `zoneLabel`/`regionCode` depuis
  `lib/referentials.ts` et calcule `isLowCoverage` en JS.

## Hors contrat

- Aucune fonction de ce module n'accepte de paramètre de mutation (pas de `create`,
  `update`, `delete`) : le seul chemin d'écriture de la banque reste `npm run seed`
  (Constitution Principe II).
- Aucune fonction n'expose `position` ni `intensity` en sortie, même en cas d'ajout
  futur de champs à `ExerciseSummary`/`ExerciseDetail` (Constitution Principe III).
