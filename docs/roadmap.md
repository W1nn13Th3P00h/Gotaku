# Découpage en lots

Ordre imposé. Chaque lot est utilisable ou testable seul, et le générateur est construit et
validé avant toute interface qui le consomme.

## Lot 0, socle

Initialisation Next.js App Router, TypeScript strict, Tailwind, Vitest. Projet Supabase,
migrations des référentiels et des tables, génération des types TypeScript. Script de seed
avec schéma Zod. `data/exercises.json` contient la banque complète, 330 exercices déjà
conformes aux référentiels. Auth par adresse et mot de passe, protection globale des
routes.

Fin de lot : `npm run seed` remplit la base depuis le JSON, l'application se lance et
demande une authentification.

**Fait.** Choix d'implémentation et écarts assumés dans `docs/init-log.md`. Deux points
qui portent sur la suite : le seed passe par une fonction Postgres pour être réellement
transactionnel, et `noUncheckedIndexedAccess` est actif, donc un accès indexé est typé
`T | undefined`.

## Lot 1, banque en lecture

Liste des exercices avec recherche et filtres par zone, type, matériel, position. Fiche
exercice. Tableau de couverture par zone. Aucune écriture.

Fin de lot : la banque est consultable et le tableau de couverture montre les zones à
alimenter en priorité.

## Lot 2, générateur

Module pur `lib/generator/` conforme à `docs/generator.md`, avec la totalité des tests
listés en fin de ce document. Puis écran de génération, presets de zones, et écran d'aperçu
avec remplacement, retrait, réordonnancement et régénération.

Fin de lot : une séance cohérente sort en trois taps, et les tests du générateur passent.

## Lot 3, exécution et historique

Lecteur de séance plein écran, timer, phases de côté sur les exercices asymétriques,
signaux WebAudio, Screen Wake Lock, pause, passer, revenir. Persistance de la séance et de
ses items, statuts, reprise d'une séance abandonnée le jour même. Écran de fin. Historique
et synthèse 30 jours.

Fin de lot : une séance se fait de bout en bout et alimente la pondération de fraîcheur du
générateur.

## Lot 4, séance manuelle et modèles

Composition manuelle depuis la banque, ajustement des durées dans leur plage, sauvegarde
comme modèle, démarrage d'un modèle.

## Lot 5, PWA et rappel

Manifest, service worker, écran d'installation expliquant l'ajout à l'écran d'accueil.
Abonnement Web Push, clés VAPID, table d'abonnements. Écran de réglage du rappel. Edge
Function d'envoi, job Supabase Cron toutes les cinq minutes, table d'idempotence, purge des
abonnements morts. Notification cliquable ouvrant l'écran générateur.

Fin de lot : le rappel arrive sur le téléphone à l'heure prévue, une seule fois, et pas les
jours où une séance a déjà été faite.

## Lot 6, confort

Presets de sélection supplémentaires, option de priorisation des zones délaissées dans
l'interface, affinage des messages d'échec du générateur, réglages de la tolérance.

## État de la banque

La banque est déjà constituée : 330 exercices dans `data/exercises.json`, validés contre
les référentiels, sans slug ni nom en doublon. Le chantier de remplissage initialement
prévu en parallèle du code n'a plus lieu d'être.

Zones les plus faiblement pourvues, à connaître pour ne pas s'étonner d'une génération
maigre quand elles sont demandées seules : `shins` 4 exercices, `neck` 5, `triceps` 5,
`it_bands` 5, `feet` 6, `biceps` 8. C'est acceptable tant que le générateur ne promet pas
une couverture qu'il ne peut pas tenir, ce que garantit le motif d'échec
`ZONES_UNSERVABLE`.

Aucun exercice n'utilise la position `hanging`. La valeur reste dans l'enum, sans effet.

Le doublon « Mollet au mur » est tranché. Les deux entrées décrivaient le même exercice,
mêmes zones, type, position, symétrie, intensité, durée cible et mêmes instructions au mot
près ; seules les bornes de durée différaient. `wall-assisted-calf-stretch` a été
supprimé, `calf-stretch-on-wall` conservé. La banque est passée de 331 à 330.

La validation de la banque n'est plus un contrôle ponctuel : `lib/bank/bank.test.ts`
rejoue le schéma sur le fichier réel à chaque `npm run test`, et vérifie qu'aucune zone du
référentiel n'est orpheline et qu'aucun nom n'est en doublon.
