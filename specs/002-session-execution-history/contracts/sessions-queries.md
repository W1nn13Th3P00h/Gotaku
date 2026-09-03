# Contrat interne : `lib/sessions/queries.ts` et `lib/sessions/mutations.ts`

## `getSessionForExecution(supabase, sessionId): Promise<SessionForExecution | null>`

Charge la séance et ses items (avec `exercise.name`, `instructions`,
`zones`/`primary_zone` pour l'affichage). `null` si la séance n'existe pas ou n'appartient
pas à l'utilisateur (RLS renvoie simplement zéro ligne, pas une erreur).

## `getResumableSessionsToday(supabase): Promise<HistorySessionRow[]>`

Séances de l'utilisateur avec `status = 'in_progress'` (jamais `draft`) dont le statut
effectif n'est pas `abandoned` (donc `started_at` est aujourd'hui, en heure locale) —
voir `data-model.md`. Une composition manuelle encore à l'état `draft` (Lot 4) n'est
jamais retournée ici : elle n'a pas encore de `started_at` et relève de l'écran de
composition, pas de la reprise d'exécution.

## `listSessionsForHistory(supabase): Promise<HistorySessionRow[]>`

Séances de l'utilisateur avec `status IN ('in_progress', 'completed')` (donc jamais
`draft`), triées par date décroissante, statut effectif calculé pour chacune.

## `getHistorySummary30d(supabase): Promise<HistorySummary30d[] | null>`

Appelle `supabase.rpc('session_history_summary', { since: <30 jours avant maintenant> })`.
`null` (pas un tableau vide) si aucune séance `completed` sur la fenêtre, pour que
l'appelant affiche le message explicite requis par FR-017 plutôt qu'un tableau de zéros.

## `startSession(supabase, sessionId): Promise<void>`

Écrit `status: 'in_progress'`, `started_at: now()` si `started_at` est encore `null`.
Sans effet si déjà démarrée (reprise).

## `markItemDone(supabase, itemId): Promise<void>` / `markItemSkipped(supabase, itemId): Promise<void>`

Écrit `status` sur l'item concerné.

## `revertItemToPending(supabase, itemId): Promise<void>`

Utilisé par l'action « revenir » (voir `contracts/session-player.md`).

## `completeSession(supabase, sessionId, { actualDurationS }): Promise<void>`

Écrit `status: 'completed'`, `completed_at: now()`, `actual_duration_s: actualDurationS`.

## Hors contrat

- Aucune fonction de ce module n'écrit jamais `status: 'abandoned'` (voir
  `research.md`).
- Aucune fonction ne modifie `session_items.duration_s`, `per_side`, `ord` ou
  `exercise_id` : ce sont des instantanés posés à la création de la séance (Lot 2),
  hors périmètre de cette feature (Constitution Principe IV).
