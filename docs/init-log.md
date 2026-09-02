# Journal d'initialisation

Ce qui a été fait, dans l'ordre, et pourquoi. Document de travail, pas une
spécification : il explique les choix d'implémentation du lot 0 et les écarts assumés
par rapport à la lettre des specs. Il n'a pas à être maintenu au-delà du lot 0.

---

## 0. Vérification de l'état de départ

Avant de toucher à quoi que ce soit, j'ai relu l'arborescence et validé
`exercises.json` par script contre les référentiels de `docs/data-model.md`.

Résultat : 331 exercices, zéro violation de référentiel, zéro slug en doublon, aucune
clé inconnue. Les seules clés utilisées sont les treize obligatoires ;
`contraindications`, `notes` et `media_url` n'apparaissent nulle part. Conséquence
directe sur le schéma Zod : ces trois champs sont optionnels, pas requis.

Deux constats confirmés : `hanging` n'est utilisée par aucun exercice, et
« Mollet au mur » existe en double.

## 1. Le fichier de banque était à la racine

`exercises.json` était à la racine, `data/` était vide. Déplacé en
`data/exercises.json`, seul chemin que `CLAUDE.md` et les specs mentionnent.

## 2. Doublon « Mollet au mur » tranché

Les deux entrées n'étaient pas un simple doublon de nom : mêmes type, position,
symétrie, zones, zone primaire, intensité, durée cible et mêmes instructions au mot
près. Seules les bornes de durée différaient légèrement. C'était deux fois le même
exercice sous deux slugs.

`wall-assisted-calf-stretch` supprimé, `calf-stretch-on-wall` conservé. La banque
passe à **330 exercices**.

Pourquoi ça compte : le générateur travaille sur des slugs. Deux slugs pour un même
exercice, et rien n'empêche une séance de proposer deux fois le même mouvement, ni la
pondération de fraîcheur de croire qu'un exercice n'a jamais été fait alors que son
jumeau l'a été la veille.

## 3. Git avant le code

`git init`, `.gitignore` écrit **avant** le premier `git add` — avec `.env*` dedans dès
la première ligne, pour qu'aucune clé ne puisse être committée par accident — puis un
commit ne contenant que les specs et la banque.

C'est le point de retour arrière : si un lot part de travers, `git reset --hard` sur ce
commit rend un repo propre sans avoir à trier à la main.

## 4. Scaffold Next.js

`create-next-app` refuse de s'installer dans un dossier contenant `data/` et
`CLAUDE.md`. Plutôt que de déplacer temporairement tes fichiers, j'ai scaffoldé dans un
bac à sable, inspecté ce que Next 16.3.4 produit, et importé seulement ce qui sert :
`eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, le favicon.

Volontairement laissé de côté :

- **`AGENTS.md` et son symlink `CLAUDE.md`.** Next 16 les génère par défaut. Le second
  aurait écrasé ton `CLAUDE.md`, qui est la pièce la plus importante du repo.
- **Les SVG de `public/`.** Branding Next, aucun usage.
- **La police Geist via `next/font/google`.** Une dépendance réseau au build pour une
  app mono-utilisateur ne se justifie pas. Pile système à la place, qui est de toute
  façon la plus lisible sur iOS.

`package.json` et `tsconfig.json` sont écrits à la main.

### Durcissement de TypeScript

`CLAUDE.md` demande « TypeScript strict ». `strict: true` seul ne couvre pas l'accès
indexé, j'ai donc ajouté :

- `noUncheckedIndexedAccess` — `arr[0]` est typé `T | undefined`. C'est verbeux, et
  c'est exactement ce qu'il faut pour un générateur qui passe sa vie à indexer des
  tableaux de candidats.
- `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames`.
- `target` passé de `ES2017` à `ES2022`.

## 5. Référentiels en TypeScript

`lib/referentials.ts` est le miroir de `docs/data-model.md` : 9 régions, 26 zones,
9 matériels, 4 types, 8 positions, 2 symétries, tous en `as const` avec types dérivés.

Trois consommateurs : le schéma Zod, les migrations SQL (recopiées à la main, une base
ne lit pas du TypeScript) et l'interface à venir. Un seul endroit à corriger si un
référentiel bouge, et le compilateur signale les usages devenus faux.

Les libellés français sont ici, les codes anglais aussi, conformément à la règle
« français pour l'interface, anglais pour les identifiants ».

## 6. Schéma Zod et tests

`lib/bank/schema.ts` implémente les huit règles de validation de `docs/data-model.md`,
plus les contraintes `CHECK` du SQL — intensité 1 à 3, durée cible entre 10 et 600 —
pour que la validation échoue dans le script avec un message lisible plutôt qu'en base
avec une erreur Postgres.

Deux ajouts non demandés explicitement, tous deux défensifs :

- **Objets stricts.** Une clé inconnue est refusée. Dans un fichier de 330 entrées
  saisies à la main, `duration_targets_s` au pluriel passerait sinon inaperçu et
  l'exercice partirait en base avec une durée par défaut silencieuse.
- **`formatBankIssues`** rend les erreurs Zod lisibles en terminal, une ligne par
  problème, avec le slug de l'exercice fautif et non son index. Sur 330 entrées,
  `[247].zones.1` seul est inexploitable.

`lib/bank/schema.test.ts` : 29 tests, un par règle, dans les deux sens.
`lib/bank/bank.test.ts` : la banque réelle passe le schéma, chaque zone du référentiel
est couverte, aucun nom n'est en doublon.

**32 tests, tous verts.** Ces tests-là gardent la banque, pas le générateur. Ceux du
générateur viennent au lot 2, et ce sont eux qui comptent.

## 7. Migrations SQL

Six fichiers dans `supabase/migrations/`, découpés par domaine pour que l'ordre
d'application soit lisible :

| Fichier | Contenu |
| --- | --- |
| `…120000_enums_and_referentials` | enums, `zones`, `equipment` et leur seed |
| `…120100_exercises` | banque et tables de rattachement |
| `…120200_sessions` | séances, items, modèles, vue de fraîcheur |
| `…120300_reminders_push` | rappel et abonnements push (posés, exploités au lot 5) |
| `…120400_rls` | RLS |
| `…120500_seed_exercises_fn` | fonction de seed transactionnelle |

Le schéma est celui de `docs/data-model.md`, sans écart sur les colonnes, les types ni
les contraintes. Quatre ajouts, tous justifiés :

- **Index.** Le document n'en spécifie aucun au-delà des clés. J'ai ajouté ceux que les
  requêtes des lots suivants imposent : `exercise_zones (zone_code)` pour le filtre par
  zone, `sessions (user_id, created_at desc)` pour l'historique inversé,
  `session_items (session_id, ord)` pour la lecture ordonnée d'une séance.
- **`security_invoker = true` sur `exercise_last_performed`.** Sans ça, une vue
  s'exécute avec les droits de son propriétaire et court-circuite la RLS des tables
  qu'elle lit. Un seul utilisateur réel aujourd'hui, mais c'est une fuite gratuite à
  laisser ouverte.
- **`(select auth.uid())` dans les policies** plutôt que `auth.uid()` nu. Le
  sous-select est évalué une fois par requête au lieu d'une fois par ligne.
- **Policies des tables enfants.** `session_items`, `template_items` et
  `reminder_sends` n'ont pas de `user_id`. Leur policy remonte au parent par un
  `exists`, ce qui est la seule traduction possible de « `user_id = auth.uid()` » pour
  ces tables.

Les référentiels et la banque sont en RLS avec une policy de lecture pour
`authenticated` et **aucune** policy d'écriture. La clé de service contourne la RLS,
donc le seed écrit et rien d'autre ne peut.

### Le point le moins évident : rendre le seed transactionnel

`docs/data-model.md` exige « transactionnel, sans écriture partielle ». Le client
Supabase parle à PostgREST en HTTP : chaque `insert` est sa propre transaction. Trois
appels successifs, et une coupure réseau au deuxième laisse la banque à moitié à jour.

Deux sorties possibles : ouvrir une connexion Postgres directe depuis le script, ce qui
impose de manipuler le mot de passe de la base, ou faire faire le travail à la base.
J'ai pris la seconde. `seed_exercises(payload jsonb)` reçoit le tableau entier en un
appel — un appel RPC est une transaction — et fait l'upsert, le remplacement des
rattachements et la désactivation des slugs disparus. Soit tout passe, soit rien.

**Un slug retiré du JSON n'est pas supprimé mais passé à `active = false`.** Le
document ne tranche pas ce cas. `session_items` référence `exercises(id)` : supprimer
casserait l'historique, ce que `CLAUDE.md` interdit explicitement.

Le parsing du JSON est isolé dans `_bank_parse`, appelé plusieurs fois par
`seed_exercises`. Une table temporaire aurait été plus directe, mais les tables
temporaires en plpgsql posent des problèmes de plans de requête mis en cache d'un appel
à l'autre. Les deux fonctions sont révoquées pour `anon` et `authenticated`.

## 8. Auth

`@supabase/ssr` avec trois clients distincts, parce qu'ils n'ont pas le même accès aux
cookies : navigateur, serveur, et proxy.

**Deux jeux de noms de clés acceptés.** Supabase a renommé ses clés : les projets
récents exposent `sb_publishable_…` et `sb_secret_…`, les anciens une clé anon et une
clé service role. `lib/supabase/env.ts` lit l'un ou l'autre. Ça évite de bloquer sur un
nom de variable selon l'âge du projet.

**`proxy.ts`, pas `middleware.ts`.** Next 16 a renommé la convention.
`middleware.ts` fonctionne encore mais émet un avertissement de dépréciation à chaque
build. Vérifié dans le code de Next installé plutôt que supposé.

Le proxy tourne sur toutes les routes hors fichiers statiques, y compris `/login` :
c'est lui qui rafraîchit le token, et l'exclure des pages publiques déconnecte au bout
d'une heure. Il utilise `getUser()` et non `getSession()`, seul le premier revalide le
token auprès de Supabase — `getSession()` fait confiance au cookie, qui est modifiable
côté client.

**Adresse et mot de passe, pas de lien magique.** Le lot 0 a d'abord été écrit avec un
lien magique, conformément à `CLAUDE.md`, puis basculé sur mot de passe classique.

Ce que ça a supprimé : la route `/auth/confirm`, qui existait pour transformer un
`token_hash` en session, et surtout l'étape manuelle de modification du template
d'email Supabase, la seule partie du lot 0 qui pouvait échouer silencieusement sans que
rien dans le code ne le signale. Le lien magique par défaut renvoie le token dans le
fragment d'URL, invisible du serveur, ce qui obligeait à réécrire le template à la main
pour que le flux serveur fonctionne. Un point de fragilité en moins.

`signInWithPassword` depuis le navigateur, le SDK écrit les cookies, le proxy les voit
à la requête suivante. Après succès, `router.replace` puis `router.refresh` : le second
est nécessaire, sans lui le cache du router client resert la version rendue sans
session.

L'application n'appelle jamais `signUp`. Il n'y a donc pas d'inscription à fermer côté
code. Le compte unique se crée à la main dans le dashboard.

`docs/spec.md` et `CLAUDE.md` mentionnent encore le lien magique. Les deux documents
décrivent l'authentification comme un moyen de protéger l'accès, pas comme une
fonctionnalité, et le choix du mécanisme ne change rien au reste. À corriger à
l'occasion.

## 9. Écran de socle

`app/page.tsx` n'est pas l'accueil de `docs/spec.md`. Il affiche l'adresse de la
session, le nombre d'exercices actifs et le nombre de zones, et rien d'autre. Sa seule
fonction est de prouver que l'auth tient et que la banque est en base. Il est remplacé
au lot 2.

## 10. Les migrations sont testées, pas relues

Ni Docker ni Postgres sur la machine, donc aucun moyen de savoir si les six migrations
s'appliquent avant de les pousser sur ton projet. Relire du SQL à l'œil et espérer
n'est pas une vérification.

J'ai installé **PGlite**, Postgres 17 compilé en WebAssembly, en dépendance de
développement. Il tourne dans Node, sans serveur ni conteneur, et donne une vraie base
jetable par test. `lib/db/test-db.ts` crée le minimum que Supabase fournit et que
PGlite n'a pas — schéma `auth`, `auth.users`, `auth.uid()`, rôles `anon`,
`authenticated`, `service_role` — puis applique les migrations dans l'ordre.

`lib/db/migrations.test.ts` : 21 tests. Les migrations s'appliquent, les référentiels
sont bien peuplés, chaque contrainte `CHECK` refuse ce qu'elle doit refuser, l'index de
zone primaire unique tient, la RLS est active sur **toutes** les tables publiques, la
banque n'a aucune policy d'écriture, et `seed_exercises` est inaccessible à
`authenticated`.

La fonction de seed est exercée avec les 330 exercices réels : insertion complète,
idempotence au second passage, remplacement et non cumul des rattachements,
désactivation d'un slug retiré puis réactivation à son retour, refus d'un payload vide
ou mal formé.

Le test qui compte le plus : un payload dont **le dernier** exercice viole une
contrainte. Rien n'est écrit, pas même les trois premiers, valides. C'est la
démonstration que l'exigence « pas d'écriture partielle » est tenue, et pas seulement
affirmée.

**Ça a servi immédiatement.** Le premier passage a échoué sur
`syntax error at or near "position"`. `position` est un mot-clé de fonction en SQL,
`POSITION(x IN y)`. Il passe comme nom de colonne dans un `CREATE TABLE`, ce qui
explique que la migration de la table `exercises` s'applique très bien, mais pas dans
une clause `RETURNS TABLE`, où il doit être cité. Sans PGlite, cette erreur se
découvrait sur ton projet, au premier `db push`.

## Ce qui est vérifié et ce qui ne l'est pas

Vérifié en local, tout vert : `npm run test` (53 tests), `npm run typecheck`,
`npm run lint`, `npm run build`. Le build confirme que Next détecte le proxy et
qu'aucune route ne tente de se prérendre alors qu'elle dépend de la session. Les
migrations et le seed sont vérifiés sur un vrai Postgres.

Reste à vérifier sur le projet Supabase réel, parce que rien ici ne peut le simuler :
application effective des migrations, exécution du seed contre la base distante, et
parcours de connexion de bout en bout avec un vrai email.
