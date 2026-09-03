# Journal de nuit — reprise automatique, lots 1 à 6

Document tenu à jour par un agent cloud programmé le 2026-09-02 au soir pour
continuer le roadmap pendant la nuit, sans supervision (le porteur du projet
n'est pas joignable). Objectif : que le matin, une seule lecture de ce fichier
suffise à savoir quoi relire, quoi valider, et ce qui reste à faire.

## Comment reprendre (instructions pour l'agent du prochain cycle)

1. Lire ce fichier en entier.
2. `git log --oneline -20` sur la branche courante pour voir ce qui a déjà été fait.
3. Relire `CLAUDE.md`, `docs/roadmap.md`, et le document du lot en cours
   (`docs/spec.md`, `docs/data-model.md`, `docs/generator.md` selon le lot).
4. Reprendre au premier lot non terminé de la section « État par lot » ci-dessous,
   dans l'ordre du roadmap. Ne pas sauter un lot non commencé pour un lot suivant.
5. Avant tout commit : `npm run typecheck`, `npm run lint`, `npm run test` doivent
   tous les trois passer. Un commit qui casse l'un des trois n'est pas acceptable,
   sauf à documenter précisément pourquoi ici (cas bloquant réel, pas une paresse).
6. Sur un point ambigu de spec ou d'algorithme : trancher soi-même, choisir
   l'option la plus raisonnable et la plus simple, et écrire le choix fait *et
   pourquoi* à la fois dans le message de commit et dans la section « Décisions
   prises » ci-dessous. Ne jamais bloquer une nuit entière sur une question sans
   réponse possible.
7. Committer par étapes petites et cohérentes (un commit qui laisse le dépôt dans
   un état qui build et teste), pousser sur cette branche. La PR existante se met
   à jour automatiquement, ne pas en ouvrir une nouvelle.
8. Mettre à jour ce fichier en fin de cycle : cocher ce qui a avancé, préciser ce
   qui reste, et ajouter toute question ou point bloquant à la section finale.
9. Le lot 5 (Web Push, VAPID, Edge Functions, Supabase Cron) demande des secrets
   (clés VAPID, service role Supabase) absents de ce bac à sable cloud. Écrire le
   code (migrations, Edge Function, service worker, écrans) est possible et
   attendu, mais ne jamais tenter de exécuter `npx supabase db push` contre le
   projet hébergé, ni déployer une Edge Function, ni générer de vraies clés VAPID.
   Documenter précisément, à la fin, la liste des actions manuelles qu'il restera
   à faire à la main (générer les clés, les poser en variables d'environnement,
   déployer, tester sur un vrai téléphone).
10. Si tout le périmètre atteignable cette nuit est fait et qu'il ne reste plus
    rien à avancer sans nouvelle information de l'utilisateur : ne pas committer
    de changement cosmétique juste pour committer. Écrire « rien à faire de plus
    cette nuit » dans ce fichier et s'arrêter là pour ce cycle.

## État par lot

- **Lot 0, socle** — fait avant cette nuit. Voir `docs/init-log.md`.
- **Lot 1, banque en lecture** — non commencé. Liste des exercices, recherche,
  filtres zone/type/matériel/position, fiche exercice, tableau de couverture par
  zone. Aucune écriture.
- **Lot 2, générateur** — module pur `lib/generator/` et ses 11 tests obligatoires
  faits avant cette nuit (voir `lib/generator/generate.test.ts`, décisions
  documentées dans `lib/generator/constants.ts` et `lib/generator/failures.ts`).
  Reste à faire : écran de génération, presets de zones, écran d'aperçu avec
  remplacement, retrait, réordonnancement et régénération.
- **Lot 3, exécution et historique** — non commencé. Lecteur plein écran, timer,
  phases de côté sur exercice asymétrique, signaux WebAudio (jamais
  `navigator.vibrate`, non supporté iOS), Screen Wake Lock pendant la séance
  relâché à la sortie, pause/passer/revenir, persistance des `session_items` et
  de leurs statuts, reprise d'une séance abandonnée le jour même, écran de fin,
  historique et synthèse 30 jours.
- **Lot 4, séance manuelle et modèles** — non commencé. Composition manuelle
  depuis la banque, ajustement des durées dans leur plage, sauvegarde comme
  modèle, démarrage d'un modèle.
- **Lot 5, PWA et rappel** — non commencé. Code seulement cette nuit (voir point
  9 ci-dessus) : manifest, service worker, écran d'installation, abonnement Web
  Push, table d'abonnements, Edge Function d'envoi, idempotence, purge des
  abonnements morts, écran de réglage du rappel.
- **Lot 6, confort** — non commencé. Presets supplémentaires, priorisation des
  zones délaissées en interface, affinage des messages d'échec, réglages de
  tolérance.

## Décisions prises sur des points ambigus

- 2026-09-02, générateur (avant la nuit) : pondération inverse du volume pour
  `preferNeglectedZones` avec un epsilon fixe (`ZONE_VOLUME_EPSILON_S = 60`) pour
  éviter la division par zéro sur une zone jamais travaillée. Validé par
  l'utilisateur.
- 2026-09-02, générateur (avant la nuit) : détection de `ZONES_UNSERVABLE` par
  heuristique gloutonne (tri des zones par coût du candidat le moins cher, cumul
  jusqu'à dépasser le budget), plutôt qu'une résolution exacte de couverture
  d'ensemble. Validé par l'utilisateur.

## À valider par toi demain matin

- (à compléter par chaque cycle de la nuit)
