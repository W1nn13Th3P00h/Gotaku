<!--
Sync Impact Report
- Version change: (aucune) → 1.0.0
- Ratification initiale : synthèse des règles déjà en vigueur dans CLAUDE.md et
  docs/*.md (spec.md, data-model.md, generator.md, roadmap.md), sans changement
  de fond, pour les faire entrer dans le format constitution de Spec Kit.
- Principes ajoutés : I à V (module pur du générateur, banque comme source de
  vérité, référentiels fermés, intégrité de l'historique, périmètre
  mono-utilisateur)
- Sections ajoutées : Stack technique et contraintes de plateforme, Méthode de
  travail
- Sections supprimées : aucune
- Templates dépendants : CLAUDE.md reste le document opérationnel détaillé ;
  cette constitution en est le résumé faisant autorité. Aucun autre template
  Spec Kit (plan/spec/tasks) ne référence encore de placeholder de principe à
  mettre à jour.
- TODO différé : aucun
-->

# Gokaku Constitution

## Core Principles

### I. Le générateur est un module pur, testé avant d'être branché
Le générateur de séance vit exclusivement dans `lib/generator/`. Il ne connaît ni
React, ni Supabase, ni `Date.now()`, ni `Math.random()` : toute source de temps
ou d'aléa (seed) lui est injectée en paramètre. Il reçoit un catalogue
d'exercices, un historique, des paramètres et une seed, et retourne une séance,
sans effet de bord.

Il est testé avant d'être branché à l'interface, avec au minimum les cas
suivants : budget inférieur au coût du plus petit exercice, aucune zone
servable avec le matériel donné, huit zones demandées pour dix minutes,
catalogue vide, exercice unique répété, seed identique donnant deux fois le
même résultat, seed différente donnant un résultat différent.

**Rationale** : c'est le cœur de valeur de l'application. Un générateur non
déterministe ou couplé à l'infrastructure ne peut pas être testé sérieusement,
et une régression n'y serait détectée qu'en production.

### II. La banque d'exercices est une source de vérité versionnée, jamais un formulaire
Les exercices ne sont jamais saisis via une interface d'administration. La
source de vérité est `data/exercises.json`, versionné dans le dépôt. `npm run
seed` valide ce fichier avec Zod puis le pousse en base de façon idempotente
sur le `slug`. Un exercice non conforme au schéma fait échouer le seed entier,
sans écriture partielle.

**Rationale** : garantit un historique de la banque via git (diff, revue,
retour arrière) plutôt qu'un état de base opaque, et interdit toute donnée
partiellement invalide en production.

### III. Les référentiels sont fermés, l'interface n'expose que zones, type et matériel
Les référentiels de `docs/data-model.md` (zones, types, positions, matériels)
sont fermés : il est interdit d'inventer une valeur qui n'y figure pas. Si un
exercice ne rentre dans aucune valeur existante, le manque doit être signalé,
jamais comblé par une valeur approchante.

Seuls trois axes sont exposés et filtrables dans l'interface : zones, type,
matériel. `position` et `intensity` sont des champs internes, obligatoires à la
saisie et consommés par le générateur, mais jamais affichés, jamais filtrables
et jamais paramétrables par l'utilisateur.

**Rationale** : un référentiel qui dérive au fil des exercices ajoutés rend le
générateur et les filtres incohérents. Limiter l'interface à trois axes garde
l'application simple pour un usage personnel, sans complexité de configuration
inutile.

### IV. L'historique d'une séance est un instantané immuable
Les durées sont toujours stockées en secondes, entières. Sur un exercice
asymétrique, la durée stockée est celle d'un seul côté. `session_items`
conserve un instantané (snapshot) de la durée retenue au moment de la séance :
modifier un exercice dans la banque plus tard ne doit jamais réécrire
l'historique déjà enregistré.

**Rationale** : l'historique sert de base à la synthèse et à la priorisation
des zones délaissées ; il doit rester une trace fidèle de ce qui a réellement
été fait, indépendante de l'évolution ultérieure de la banque.

### V. Application mono-utilisateur, sans fonctionnalité sociale
Un seul utilisateur réel utilise l'application. Aucune fonctionnalité sociale,
aucun partage, aucun onboarding multi-comptes n'est à construire.
L'authentification (adresse et mot de passe, Supabase Auth) existe uniquement
pour protéger l'accès et rattacher les données, pas pour gérer une population
d'utilisateurs.

**Rationale** : évite d'introduire de la complexité (gestion de rôles,
permissions fines, invitations) qui ne sert aucun besoin réel du produit tel
que défini dans `docs/spec.md`.

## Stack technique et contraintes de plateforme

Stack imposée : Next.js (App Router), TypeScript strict, Tailwind, déploiement
Netlify, Supabase (Postgres, Auth, Edge Functions, Cron), Web Push VAPID,
service worker, PWA installable sur écran d'accueil iOS, Zod pour la
validation du JSON de banque, Vitest pour les tests unitaires. Pas d'ORM lourd
: le client Supabase généré en types TypeScript suffit.

Contraintes de plateforme déjà tranchées, à ne pas rouvrir sans raison
nouvelle :
- Le push iOS ne fonctionne que si la PWA a été ajoutée à l'écran d'accueil, et
  la demande de permission doit partir d'un tap explicite de l'utilisateur ;
  jamais d'appel à `Notification.requestPermission()` au chargement.
- Pas de `navigator.vibrate`, non supporté par Safari iOS. Les signaux du
  timer passent par WebAudio, initialisé au démarrage de la séance pendant que
  le geste utilisateur est encore valide.
- L'ordonnancement du rappel quotidien passe par Supabase Cron, pas par le
  cron de l'hébergeur, pour garder un déclenchement fiable à heure fixe
  indépendamment du plan d'hébergement en place.
- Screen Wake Lock est utilisé pendant l'exécution d'une séance, et relâché à
  la sortie de l'écran.

Français pour l'interface. Anglais pour le code, les identifiants et les codes
de référentiel.

## Méthode de travail

Avant toute implémentation, un plan de développement (étapes, fichiers
impactés, choix techniques) est présenté et validé explicitement avant
d'écrire du code.

`docs/spec.md` (périmètre, écrans, parcours), `docs/data-model.md`
(référentiels, schéma SQL, format de la banque), `docs/generator.md`
(algorithme du générateur) et `docs/roadmap.md` (découpage en lots) sont les
documents de référence. `docs/generator.md` est lu avant d'écrire une ligne du
générateur : l'algorithme n'est pas laissé à l'interprétation.

## Governance

Cette constitution prévaut sur toute autre pratique ou préférence individuelle
pour ce dépôt. `CLAUDE.md` reste le document opérationnel détaillé (commandes,
pièges déjà résolus, particularités du lien Supabase CLI) ; en cas d'écart
entre les deux, cette constitution fait foi sur les principes, `CLAUDE.md` sur
le détail d'exécution, et l'écart doit être corrigé dans les deux documents.

Toute modification de cette constitution est une décision explicite de
l'utilisateur, jamais une déduction d'un agent. Versionnage sémantique :
MAJOR pour une suppression ou redéfinition d'un principe existant, MINOR pour
l'ajout d'un principe ou d'une section, PATCH pour une clarification de
formulation sans changement de fond.

**Version**: 1.0.1 | **Ratified**: 2026-09-03 | **Last Amended**: 2026-09-04
