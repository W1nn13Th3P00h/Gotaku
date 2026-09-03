# Contrat interne : `lib/session-player/reducer.ts`

Module pur, sans I/O. Toutes les fonctions sont `(state: PlayerState, nowMs: number) =>
PlayerState`, sauf `init`.

## `init(items: PlayerItem[], nowMs: number): PlayerState`

Construit l'état initial. Positionne `currentIndex` sur le premier item dont le statut
n'est pas `pending`... en fait sur le premier item `pending` (reprise naturelle d'une
séance déjà partiellement faite, voir Assumptions de `spec.md`). Si tous les items sont
déjà `done`/`skipped`, retourne directement `phase: 'finished'`.

## `tick(state, nowMs): PlayerState`

Ne change rien tant que le temps restant de la phase courante est positif. Quand il
atteint zéro : marque l'item courant (ou sa phase) `done`, avance vers la phase/item
suivant, ou vers `phase: 'finished'` s'il n'y en a plus.

## `pause(state, nowMs): PlayerState` / `resume(state, nowMs): PlayerState`

`pause` fige le temps déjà écoulé de la phase courante. `resume` repart de ce point.
Sans effet si l'état n'est pas dans la phase attendue (`pause` sur un état déjà en
pause, etc.) — pas d'erreur, état inchangé.

## `skip(state, nowMs): PlayerState`

Marque l'item (ou la phase, pour un exercice asymétrique) courant `skipped`, avance
immédiatement vers la suite, comme `tick` à zéro mais déclenché par l'utilisateur.
Sur la première phase d'un exercice asymétrique, avance vers sa seconde phase, pas vers
l'exercice suivant (FR-008, edge case).

## `back(state, nowMs): PlayerState`

Sans effet si `currentIndex` est déjà sur le tout premier item (FR-006, edge case).
Sinon : remet le statut de l'item précédent (ou de sa phase en cours) à `pending`,
recule `currentIndex` (et `currentSide` si besoin), redémarre son horodatage de phase à
`nowMs`.

## Événements émis (pour le composant client, pas pour le reducer)

Le composant client compare l'état avant/après chaque appel pour déclencher les effets
de bord (signal sonore, écriture Supabase) — le reducer lui-même n'a pas de mécanisme de
notification, il retourne un nouvel état, point.

- Item passé à `done` ou `skipped` → écrire son nouveau statut (`markItemDone` /
  `markItemSkipped`, `lib/sessions/mutations.ts`).
- `phase` passe à `finished` → appeler `completeSession` avec la durée réelle écoulée
  depuis `started_at`.
- Temps restant de la phase courante ≤ 3000 ms et pas encore signalé pour cette phase →
  jouer le signal d'avertissement.
- Changement de `currentIndex` ou `currentSide` → jouer le signal de changement.

## Hors contrat

- Le reducer ne connaît jamais `sessions`/`session_items` de Supabase, ni React, ni
  `AudioContext`, ni `navigator.wakeLock`.
- Aucune fonction du reducer n'accepte `Date.now()` implicitement : `nowMs` est toujours
  un paramètre.
