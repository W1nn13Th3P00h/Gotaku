# Phase 0 — Research: PWA et rappel push (Lot 5)

Aucun `NEEDS CLARIFICATION` ne subsistait. Les décisions ci-dessous figent la
construction de ce que `docs/spec.md` (Réglages, Rappel push) et les pièges de
plateforme déjà actés dans `CLAUDE.md` cadrent déjà.

## Manifest et service worker : natifs, sans dépendance PWA tierce

- **Decision**: `app/manifest.ts` (API `MetadataRoute.Manifest` native de Next.js) pour
  le manifest ; `public/sw.js` écrit à la main, minimal (pas de mise en cache d'assets,
  hors périmètre v1 — `docs/spec.md` n'exige aucun fonctionnement hors-ligne).
- **Rationale**: Next.js fournit déjà la génération du manifest sans dépendance
  supplémentaire. Un service worker qui n'a besoin de gérer que `push` et
  `notificationclick` (pas de cache offline) est plus simple à écrire à la main qu'à
  faire produire par un plugin comme `next-pwa`, qui ajouterait une dépendance et une
  couche de configuration pour un besoin que le projet n'a pas.
- **Alternatives considered**: `next-pwa`/Workbox — apporte la mise en cache offline et
  la gestion de versions du service worker, aucune des deux n'étant demandée ; aurait
  ajouté une dépendance et une configuration de build pour des fonctionnalités non
  utilisées.

## Détection de l'installation : `display-mode`, pas `beforeinstallprompt`

- **Decision**: l'écran de réglages détecte le mode installé via
  `window.matchMedia('(display-mode: standalone)').matches` (et `navigator.standalone`
  en repli pour Safari iOS plus ancien), et affiche en conséquence soit l'écran
  d'installation, soit le bouton d'activation.
- **Rationale**: `beforeinstallprompt` n'existe pas sur Safari iOS, la cible principale
  du produit (`CLAUDE.md`) ; s'appuyer dessus laisserait l'écran d'installation ne
  jamais se déclencher correctement sur la plateforme visée. La détection par
  `display-mode` fonctionne identiquement sur toutes les plateformes qui supportent les
  PWA installables.
- **Alternatives considered**: proposer un bouton d'installation actif via
  `beforeinstallprompt` sur Android/Chrome et des instructions statiques ailleurs —
  ajoute une branche de comportement pour une plateforme secondaire, non justifiée par
  le périmètre (iOS est la cible).

## Permission et abonnement : uniquement sur tap, jamais au chargement

- **Decision**: aucun code d'enregistrement du service worker ne déclenche de demande
  de permission. Seul le clic sur le bouton « activer les notifications » appelle,
  dans le même gestionnaire d'événement, `Notification.requestPermission()` puis, si
  accordée, `registration.pushManager.subscribe(...)`.
- **Rationale**: contrainte déjà actée dans `CLAUDE.md`, condition documentée de
  fonctionnement sur iOS (une demande hors du contexte direct d'un geste utilisateur
  est silencieusement refusée ou ignorée par Safari).

## Sélection des rappels dus : module pur, sans alias `@/`

- **Decision**: `lib/reminders/due.ts` exporte `selectDueReminders(reminders, ctx)`,
  une fonction pure recevant en paramètres la liste des rappels actifs, l'horodatage de
  référence (`nowUtc: Date`), l'ensemble des identifiants de rappels déjà envoyés
  aujourd'hui, et l'ensemble des identifiants d'utilisateurs ayant déjà terminé une
  séance aujourd'hui — chacun de ces ensembles étant déjà calculé par l'appelant (SQL
  simple côté Edge Function) dans la timezone propre à chaque rappel. Le fichier
  n'importe rien via l'alias `@/`, uniquement des chemins relatifs ou aucun import,
  pour rester important tel quel depuis l'Edge Function Deno (voir Project Structure).
- **Rationale**: c'est la logique la plus délicate du lot (fenêtre de cinq minutes,
  jour de semaine et heure dans un fuseau arbitraire, calculés via
  `Intl.DateTimeFormat` — disponible aussi bien en Node/Vitest qu'en Deno, donc un choix
  sûr pour du code partagé entre les deux runtimes). La rendre pure et testée est la
  seule façon d'avoir confiance dans cette logique sans dépendre d'un envoi Web Push
  réel, qui ne peut être testé qu'à la main sur un vrai téléphone.
- **Alternatives considered**: laisser Postgres calculer directement la correspondance
  heure/jour/fuseau en SQL (fonctions de date Postgres) — repousserait la logique dans
  une fonction SQL difficile à couvrir de cas de test aussi facilement qu'une fonction
  TypeScript pure, pour un gain de performance sans objet (au plus un rappel réel).

## Fenêtre de correspondance : cinq minutes, bornée à gauche

- **Decision**: un rappel est dû si les minutes écoulées depuis minuit (heure locale de
  sa timezone) au moment `nowUtc` tombent dans `[cibleMinutes, cibleMinutes + 5)`, le
  jour de semaine local correspondant à l'un de ceux du rappel.
- **Rationale**: le job tourne toutes les cinq minutes ; une fenêtre de cette largeur,
  bornée à gauche, garantit qu'un rappel dû est détecté par exactement un cycle dans le
  cas nominal (cycles réguliers), sans dépendre de l'instant exact d'exécution du cron
  à l'intérieur de sa fenêtre de cinq minutes.
- **Alternatives considered**: correspondance exacte à la minute — trop fragile si le
  cron a quelques secondes de retard ou si son déclenchement réel dérive légèrement de
  la minute pile.

## Idempotence : réclamer avant d'envoyer, pas après

- **Decision**: pour chaque rappel dû, l'Edge Function exécute d'abord
  `insert into reminder_sends (reminder_id, sent_on) values (...) on conflict do
  nothing returning *` ; l'envoi Web Push n'a lieu que si une ligne a effectivement été
  insérée. Si la contrainte d'unicité rejette l'insertion (déjà envoyé), aucun envoi
  n'a lieu pour ce cycle.
- **Rationale**: garantit qu'en cas de chevauchement entre deux exécutions du cron
  (l'une encore en cours quand la suivante démarre), un seul des deux cycles gagne la
  course et envoie réellement — l'autre voit son insertion rejetée et s'arrête là. Sans
  cette réclamation préalable, deux cycles concurrents pourraient tous deux constater
  « pas encore envoyé » avant que l'un des deux n'écrive la trace, et envoyer chacun un
  Web Push.
- **Alternatives considered**: vérifier l'absence d'un envoi puis écrire la trace après
  un envoi réussi — vulnérable exactement à la course décrite ci-dessus entre deux
  exécutions concurrentes du cron.

## Échecs d'abonnement : classification pure, écriture séparée

- **Decision**: `lib/reminders/failures.ts` exporte une fonction pure
  `nextSubscriptionState(currentFailureCount, httpStatus): { action: 'delete' |
  'increment' | 'reset' }` : `404`/`410` → `delete` ; tout autre échec avec
  `currentFailureCount + 1 >= 5` → `delete` ; tout autre échec sinon → `increment` ;
  succès → `reset`. L'Edge Function se contente d'appliquer l'action retournée
  (suppression, incrément, ou remise à zéro + `last_success_at`).
- **Rationale**: sépare une décision testable sans réseau (la classification) de son
  application (l'écriture, qui dépend de Supabase). Couvre exactement FR-012 à FR-014.

## Ouverture de l'écran générateur au clic

- **Decision**: le service worker inclut `self.addEventListener('notificationclick',
  (event) => { event.notification.close(); event.waitUntil(clients.openWindow('/generateur')) })`.
- **Rationale**: FR-015 est explicite (écran générateur, pas l'accueil) ; `/generateur`
  est la route déjà utilisée par l'écran de génération du Lot 2.
