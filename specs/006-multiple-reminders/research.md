# Phase 0 — Research: Rappels multiples

Aucun `NEEDS CLARIFICATION` dans le Technical Context du plan : cette feature ne
touche à aucune dépendance ni plateforme nouvelle. Les décisions ci-dessous portent
sur les deux points réellement ouverts par la spec.

## 1. Choisir « le plus proche » parmi plusieurs rappels, potentiellement dans des timezones différentes

- **Decision**: `nextReminderLabel` calcule, pour chaque rappel actif avec au moins un
  jour coché, un nombre de minutes jusqu'à sa prochaine occurrence — même méthode que
  l'existant (`localWeekdayAndMinutes`/`parseTimeLocalToMinutes` de `lib/reminders/due.ts`,
  déjà réutilisées par `next.ts`) : jour de semaine et minutes depuis minuit calculés
  dans la timezone propre du rappel, recherche du premier jour coché (offset 0 à 7),
  minutes jusqu'à l'occurrence = `offset * 1440 + (cible − minutesÉcoulées)`. Le rappel
  retenu est celui dont ce nombre de minutes est le plus petit ; en cas d'égalité
  stricte, le premier dans l'ordre du tableau reçu l'emporte (choix arbitraire mais
  déterministe, cohérent avec `selectDueReminders` qui préserve aussi l'ordre reçu).
- **Rationale**: réutilise exactement la même approximation déjà en production dans
  `next.ts` (1440 minutes par jour, sans traiter les transitions DST à l'intérieur de
  la fenêtre) — ce module reste un affichage de confort pour l'accueil, pas
  l'ordonnanceur réel (`send-reminders`/`selectDueReminders` restent seuls
  responsables de l'envoi). Comparer des « minutes jusqu'à » calculées dans la
  timezone propre de chaque rappel donne un ordre correct entre rappels de timezones
  différentes sans jamais convertir explicitly en UTC : chaque calcul part déjà de
  `now` (un instant UTC unique) et mesure un delta, donc les deltas restent
  comparables entre eux même si les timezones diffèrent.
- **Alternatives considered**: convertir chaque candidat en `Date` UTC absolue via
  `Temporal`/une lib de dates tierce, puis comparer des timestamps. Rejeté : introduit
  une dépendance nouvelle pour un gain de précision sans objet ici (l'imprécision DST
  potentielle, de l'ordre d'une heure une ou deux fois par an, n'affecte qu'un libellé
  d'accueil, pas un envoi réel) et casse le principe déjà en place (`contracts/
  reminders-logic.md`, lot 5) de n'utiliser que `Intl.DateTimeFormat`.

## 2. Forme de l'écran de réglages pour éditer une liste plutôt qu'un formulaire unique

- **Decision**: chaque rappel (existant ou en cours d'ajout) devient sa propre carte
  avec ses propres champs et son propre bouton Sauvegarder/Supprimer, sur le modèle
  déjà présent dans cet écran pour la section Matériel (état de sauvegarde isolé,
  `equipmentSaving`/`equipmentSaved` indépendants du rappel). Un bouton « Ajouter un
  rappel » en bas de la liste insère une carte vierge (timezone détectée pré-remplie,
  `active` à `false` par défaut) dans l'état local, sans écriture tant qu'elle n'est
  pas sauvegardée.
- **Rationale**: cohérent avec le patron déjà utilisé sur cet écran (sauvegarde par
  section, pas un unique bouton global) ; chaque carte reste indépendante comme
  l'exige FR-002/FR-003 (modifier ou supprimer un rappel n'affecte pas les autres).
  Pas de nouveau composant partagé nécessaire : `ReminderCard` reste une sous-fonction
  locale à `settings-screen.tsx`, comme le reste de cet écran.
- **Alternatives considered**: un unique formulaire avec sélecteur de rappel actif
  (dropdown) et un seul jeu de champs réutilisé. Rejeté : cache les autres rappels
  pendant l'édition, rend impossible de comparer deux rappels d'un coup d'œil, et ne
  correspond à aucune acceptance scenario de la spec (US1 suppose que les deux
  rappels restent visibles simultanément).
