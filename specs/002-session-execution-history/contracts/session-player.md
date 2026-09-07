# Contrat interne : `lib/session-player/reducer.ts`

Module pur, sans I/O. Toutes les fonctions sont `(state: PlayerState, nowMs: number) =>
PlayerState`, sauf `init`.

## `init(items: PlayerItem[], nowMs: number): PlayerState`

Construit l'état initial. Positionne `currentIndex` sur le premier item dont le statut
n'est pas `pending`... en fait sur le premier item `pending` (reprise naturelle d'une
séance déjà partiellement faite, voir Assumptions de `spec.md`). Si tous les items sont
déjà `done`/`skipped`, retourne directement `phase: 'finished'`. Sinon, démarre en
`phase: 'prep'` (pas `'running'`) : le tout premier exercice de la séance a lui aussi sa
préparation de `PREP_DURATION_S` secondes.

## `tick(state, nowMs): PlayerState`

Ne change rien tant que le temps restant de la phase courante est positif.

- En `phase: 'prep'`, quand il atteint zéro : bascule directement vers `phase: 'running'`
  sur le même item et le même côté, sans poser de statut ni avancer `currentIndex`.
- En `phase: 'running'`, quand il atteint zéro : marque l'item courant (ou sa phase)
  `done`, avance vers la phase/item suivant (qui démarre en `phase: 'prep'`), ou vers
  `phase: 'finished'` s'il n'y en a plus.

## `pause(state, nowMs): PlayerState` / `resume(state, nowMs): PlayerState`

`pause` fige le temps déjà écoulé de la phase courante et mémorise dans `pausedPhase`
la phase d'origine (`'prep'` ou `'running'`). `resume` repart de ce point, dans la phase
mémorisée. Sans effet si l'état n'est pas dans la phase attendue (`pause` sur un état déjà
en pause, etc.) — pas d'erreur, état inchangé.

## `skip(state, nowMs): PlayerState`

Comportement dépendant de la phase effective (`phase`, ou `pausedPhase` si en pause) :

- Phase effective `'prep'` : bascule directement vers `phase: 'running'` sur le même item
  et le même côté (comme `tick` à zéro en `'prep'`), sans poser de statut.
- Phase effective `'running'` : marque l'item (ou la phase, pour un exercice asymétrique)
  courant `skipped`, avance immédiatement vers la suite (qui démarre en `phase: 'prep'`),
  comme `tick` à zéro mais déclenché par l'utilisateur. Sur la première phase d'un
  exercice asymétrique, avance vers la préparation de sa seconde phase, pas vers
  l'exercice suivant (FR-008, edge case).

## `back(state, nowMs): PlayerState`

Sans effet si `currentIndex` est déjà sur le tout premier item (FR-006, edge case).
Sinon : remet le statut de l'item précédent (ou de sa phase en cours) à `pending`,
recule `currentIndex` (et `currentSide` si besoin), atterrit en `phase: 'prep'` et
redémarre son horodatage de phase à `nowMs` — cohérent avec le fait que chaque item/côté
commence toujours par sa préparation, y compris en cas de retour arrière (relecture des
instructions).

## Événements émis (pour le composant client, pas pour le reducer)

Le composant client compare l'état avant/après chaque appel pour déclencher les effets
de bord (signal sonore, écriture Supabase) — le reducer lui-même n'a pas de mécanisme de
notification, il retourne un nouvel état, point.

- Item passé à `done` ou `skipped` → écrire son nouveau statut (`markItemDone` /
  `markItemSkipped`, `lib/sessions/mutations.ts`).
- `phase` passe à `finished` → appeler `completeSession` avec la durée réelle écoulée
  depuis `started_at`.
- Temps restant de la phase courante ≤ 10000 ms, uniquement en `phase: 'running'` (jamais
  en `'prep'`), et pas encore signalé pour cette phase → jouer le signal d'avertissement.
- Changement de `currentIndex` ou `currentSide` → jouer le signal de changement. Comme
  chaque nouvel item/côté démarre désormais en `'prep'`, ce signal se déclenche
  mécaniquement à l'entrée en préparation du nouvel item/côté, plutôt qu'à l'entrée dans
  son décompte réel.

## Constantes et champs additionnels

- `PREP_DURATION_S` (exportée par `reducer.ts`) : durée en secondes de la phase `'prep'`,
  fixe, non stockée en base (elle ne fait pas partie de `session_items`).
- `PlayerState.pausedPhase: 'prep' | 'running' | null` : phase vers laquelle `resume`
  doit repartir. `null` hors de `phase: 'paused'`.

## Hors contrat

- Le reducer ne connaît jamais `sessions`/`session_items` de Supabase, ni React, ni
  `AudioContext`, ni `navigator.wakeLock`.
- Aucune fonction du reducer n'accepte `Date.now()` implicitement : `nowMs` est toujours
  un paramètre.
