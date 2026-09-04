# Contrat interne : écran de réglages (`app/settings/`)

Remplace, pour la partie rappel, le contrat de `specs/004-pwa-push-reminder/
contracts/settings-screen.md` § « Écran de réglages ». La partie activation des
notifications (installation PWA, `Notification.requestPermission()`,
`subscribeToPush()`) est inchangée et hors périmètre de cette feature.

## Server Component (`page.tsx`)

Charge `getReminders(supabase)` (pluriel) au lieu de `getReminder`, transmet le
tableau tel quel au client. `dynamic = 'force-dynamic'` inchangé (dépend de
l'utilisateur connecté).

## Client (`settings-screen.tsx`)

- Affiche une carte par rappel existant (clé = `id`), plus les cartes en cours
  d'ajout non encore sauvegardées (clé locale, ex. compteur incrémental — jamais
  envoyée à la base).
- Chaque carte porte son propre état local (`timeLocal`, `weekdays`, `timezone`,
  `active`) initialisé depuis le rappel reçu, ou depuis des valeurs par défaut pour
  une carte nouvellement ajoutée (`timeLocal: '07:00'`, `weekdays: []`, `timezone`:
  la timezone détectée, `active: false`).
- Chaque carte a son propre bouton Sauvegarder : appelle `createReminder` si la carte
  n'a pas encore d'`id`, `updateReminder(id, …)` sinon. Son propre message d'erreur
  (`NO_WEEKDAY`) et de succès, indépendants des autres cartes — même patron déjà en
  place pour la section Matériel de cet écran.
- Chaque carte déjà sauvegardée (a un `id`) a un bouton Supprimer qui appelle
  `deleteReminder(id)` puis retire la carte de la liste locale. Une carte pas encore
  sauvegardée se retire simplement de l'état local, sans appel réseau.
- Un bouton « Ajouter un rappel » en bas de la liste insère une nouvelle carte vide
  dans l'état local (timezone détectée pré-remplie).
- N'appelle jamais `Notification.requestPermission()` ni `subscribeToPush()` en
  dehors du gestionnaire de clic du bouton dédié à l'activation des notifications
  (inchangé, FR-003 du Lot 5).

## Hors contrat

- Aucune limite de nombre de cartes n'est imposée par cet écran au-delà de ce qui est
  raisonnablement affichable (voir spec § Edge Cases).
- Aucune fonction de cet écran n'envoie de Web Push.
