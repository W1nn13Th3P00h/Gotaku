# Phase 0 — Research: Exécution de séance et historique (Lot 3)

Aucun `NEEDS CLARIFICATION` ne subsistait dans le Technical Context. Les décisions
ci-dessous figent la manière de construire ce qui est déjà cadré par `docs/spec.md`
(sections Exécution, Historique) et par les contraintes de plateforme déjà tranchées de
`CLAUDE.md`.

## Le statut « abandonnée » n'est jamais écrit, seulement calculé

- **Decision**: aucune écriture explicite de `sessions.status = 'abandoned'`, ni au
  moment où l'utilisateur quitte l'écran, ni par une tâche de fond. Une séance est
  considérée abandonnée à la lecture quand son statut stocké n'est pas `completed` ET
  que la date locale de `started_at` n'est plus le jour courant.
- **Rationale**: c'est la seule façon de satisfaire FR-014 exactement : une séance
  quittée aujourd'hui doit rester reprenable aujourd'hui (donc surtout pas marquée
  abandonnée tout de suite), et devenir non reprenable seulement le jour suivant. Un
  calcul à la lecture couvre aussi nativement le cas d'un onglet fermé sans action
  explicite (edge case), qui ne peut de toute façon jamais déclencher d'écriture. Évite
  également d'introduire une tâche de fond dans ce lot (`CLAUDE.md` réserve Supabase
  Cron au Lot 5).
- **Alternatives considered**: écrire `abandoned` sur un événement explicite de sortie
  (bouton « quitter », `beforeunload`) — ne couvre pas la fermeture silencieuse de
  l'onglet/l'app (le cas le plus probable en usage réel sur iOS PWA, où
  `beforeunload` n'est pas fiable), et contredirait FR-014 si déclenché le jour même.
  Une tâche planifiée qui bascule les séances de la veille en `abandoned` — reporté
  hors scope, aucune fonctionnalité de ce lot n'a besoin que la colonne `status`
  elle-même porte la valeur, seule la vue qu'en a l'utilisateur compte, et
  `exercise_last_performed` (fraîcheur) ne filtre déjà que sur `status = 'completed'`,
  donc une séance jamais explicitement complétée n'alimente jamais la fraîcheur, qu'elle
  soit ou non marquée `abandoned` en base.

## Machine à états pure pour le lecteur

- **Decision**: la logique de décompte, pause/reprise, passer/revenir, et les deux
  phases d'un exercice asymétrique vivent dans `lib/session-player/reducer.ts`, un
  module pur (aucun accès à `Date.now()`, au DOM, à React ou à Supabase) qui reçoit un
  horodatage en paramètre à chaque transition, sur le modèle de `lib/generator/`. Le
  composant client `session-player-screen.tsx` se contente de piloter une boucle de
  rendu réelle (`requestAnimationFrame`), de déclencher les effets de bord (son, Wake
  Lock, écriture Supabase) sur les transitions d'état, et de rendre l'écran de fin
  quand l'état devient terminal.
- **Rationale**: c'est la partie la plus facile à rendre subtilement fausse (décompte
  qui dérive, pause qui perd du temps, retour qui recalcule mal la phase d'un exercice
  asymétrique, dernier exercice qui ne termine pas la séance). La rendre pure permet de
  la tester avec des horodatages injectés, sans timer réel ni DOM, exactement comme les
  11 tests obligatoires du générateur donnent confiance dans `lib/generator/`.
- **Alternatives considered**: tout piloter depuis des `useState`/`useEffect` avec
  `setInterval` dans le composant — plus rapide à écrire au premier jet, mais rend les
  cas limites (pause pendant le dernier tick, passer sur la dernière phase d'un
  exercice asymétrique) impossibles à tester sans un DOM et un timer réels, et donc en
  pratique non testés.

## Décompte : horodatage de référence, pas de décrément cumulatif

- **Decision**: chaque phase (item ou côté d'un exercice asymétrique) mémorise son
  instant de début et son temps déjà écoulé avant une pause ; le temps restant affiché
  est recalculé à chaque tick comme `duréeS*1000 - (maintenant - débutPhase) +
  écouléAvantPause`, jamais décrémenté tick après tick.
- **Rationale**: un décompte qui se contente de soustraire une seconde à chaque
  `setInterval` dérive dès que le thread principal est occupé (changement d'onglet,
  throttling navigateur) — recalculer depuis une référence absolue élimine la dérive.

## Signaux sonores : synthétisés, pas de fichier audio

- **Decision**: les deux signaux (trois secondes avant la fin, changement d'exercice)
  sont générés par un oscillateur WebAudio (`AudioContext.createOscillator`), pas par la
  lecture d'un fichier audio.
- **Rationale**: aucun pipeline d'assets audio n'existe dans le projet ; un son
  synthétisé de quelques dizaines de millisecondes suffit au besoin (un signal, pas une
  mélodie) et évite d'ajouter une dépendance ou un asset versionné pour ça.
- **Alternatives considered**: fichier `.mp3`/`.wav` servi statiquement — ajoute un
  asset et son chargement pour un signal qu'un oscillateur produit sans dépendance.

## Persistance de la progression : écriture directe à chaque transition

- **Decision**: chaque passage d'un `session_item` à `done` ou `skipped`, le passage de
  la séance à `in_progress` (au démarrage) puis à `completed` (à la fin), sont écrits
  immédiatement via le client Supabase du navigateur (`lib/supabase/client.ts`), protégés
  par les policies RLS déjà en place (`sessions_own`, `session_items_own`).
- **Rationale**: FR-010 exige que la progression soit connue au fur et à mesure, pas
  seulement à la fin ; c'est aussi le seul moyen de satisfaire SC-002 (reprise sans
  perte) puisqu'un rechargement de page perd tout état en mémoire mais retrouve l'état
  en base.
- **Alternatives considered**: accumuler les changements en mémoire et les envoyer en
  un seul batch à la fin — perdrait toute la progression en cas d'interruption avant la
  fin, ce que FR-010/SC-002 excluent explicitement.

## Synthèse 30 jours : une fonction SQL pour le seul calcul à risque

- **Decision**: une fonction SQL `session_history_summary(since timestamptz)` (nouvelle
  migration), qui agrège le volume de temps par zone pour les séances `completed` dont
  `completed_at >= since`, en partant du référentiel `zones` (pas des seules zones déjà
  travaillées) pour que les zones à zéro volume sur la fenêtre apparaissent. Testée
  contre PGlite comme `zone_coverage()` (Lot 1). La liste de l'historique elle-même
  (FR-015) reste une requête `supabase-js` déclarative, non retestée à ce niveau, comme
  `listExercises` au Lot 1.
- **Rationale**: même raisonnement qu'au Lot 1 (`research.md` de
  `001-exercise-bank-browse`) : le risque d'un bug silencieux (zone omise, mauvaise
  borne de fenêtre) est concentré dans l'agrégation, pas dans le listing déclaratif.
  Cette fonction sert aussi de brique potentiellement réutilisable par le Lot 2 (écran
  de génération) pour peupler `GeneratorContext.zoneVolume30d`, mais cette
  réutilisation n'est pas construite ici — elle est notée en Assumptions pour ne pas
  dupliquer la logique plus tard sans le savoir.
- **Alternatives considered**: calculer la synthèse en JS après avoir chargé toutes les
  séances et leurs items sur 30 jours — fonctionnerait mais oblige à réimplémenter côté
  application le remplissage des zones à zéro, comme écarté au Lot 1 pour la même
  raison.
