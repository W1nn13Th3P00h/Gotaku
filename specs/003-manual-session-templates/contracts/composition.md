# Contrat interne : composition et modèles

## `lib/sessions/composition.ts` (module pur)

### `computeTotalDurationS(items: { durationS: number; perSide: boolean }[]): number`

Somme des durées, chaque item comptant double si `perSide`. Utilisée à la fois pour la
composition en cours et pour l'affichage d'un `TemplateSummary`.

### `clampDurationS(exercise: { durationMinS: number; durationMaxS: number }, requestedS: number): number`

Ramène `requestedS` dans `[durationMinS, durationMaxS]`. Jamais de valeur hors plage en
sortie, quelle que soit l'entrée (y compris négative ou non entière — arrondie à
l'entier avant clampage).

## `lib/sessions/queries.ts` (ajouts au contrat du Lot 3)

### `getOrCreateDraftComposition(supabase): Promise<CompositionForEdit>`

Cherche une séance `status = 'draft' AND source = 'manual'` pour l'utilisateur ; la
crée si absente. Ne retourne jamais `null` : la création est automatique (voir
`research.md`).

### `listTemplates(supabase): Promise<TemplateSummary[]>`

Tous les modèles de l'utilisateur, avec leur nombre d'exercices et leur durée totale.

## `lib/sessions/mutations.ts` (ajouts au contrat du Lot 3)

Signatures : voir `data-model.md` § Mutations et leurs effets. Toutes protégées par les
policies RLS déjà en place (`sessions_own`, `session_items_own`, `session_templates_own`,
`template_items_own`).

- `addItemToComposition(supabase, sessionId, exerciseId): Promise<void>`
- `removeItemFromComposition(supabase, itemId): Promise<void>`
- `reorderItems(supabase, sessionId, orderedItemIds: string[]): Promise<void>`
- `updateItemDuration(supabase, itemId, requestedS: number): Promise<void>` — appelle
  `clampDurationS` avant d'écrire
- `saveAsTemplate(supabase, sessionId, name: string): Promise<{ ok: true; templateId: string } | { ok: false; reason: 'EMPTY_NAME' | 'EMPTY_COMPOSITION' }>`
- `startSessionFromTemplate(supabase, templateId): Promise<{ sessionId: string }>` —
  crée la séance puis appelle `startSession` (contrat du Lot 3,
  `002-session-execution-history/contracts/sessions-queries.md`)

## Hors contrat

- Aucune fonction de ce module n'implémente l'exécution elle-même (décompte, pause,
  etc.) : c'est `lib/session-player/` (Lot 3), inchangé ici (FR-016).
- Aucune fonction ne permet de renommer ou modifier un modèle existant, ni de le
  supprimer (hors périmètre, voir Assumptions de `spec.md`).
