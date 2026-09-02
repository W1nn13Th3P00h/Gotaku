# CLAUDE.md

## Ce qu'est ce projet

Application personnelle mono-utilisateur d'accompagnement aux séances de mobilité et
d'étirements. Elle repose sur une banque d'exercices richement taggée, un générateur qui
compose une séance respectant une durée cible, et un mode exécution guidée au timer.
Un rappel push quotidien pousse à faire la séance.

Un seul utilisateur réel. Aucune fonctionnalité sociale, aucun partage, aucun onboarding
multi-comptes. L'authentification existe uniquement pour protéger l'accès et rattacher les
données, pas pour gérer une population d'utilisateurs.

## Stack imposée

- Next.js (App Router), TypeScript strict, Tailwind
- Déploiement Vercel
- Supabase : Postgres, Auth (adresse et mot de passe), Edge Functions, Cron
- Web Push VAPID, service worker, PWA installable sur écran d'accueil iOS
- Zod pour la validation du JSON de la banque
- Vitest pour les tests unitaires

Pas d'ORM lourd. Le client Supabase généré en types TypeScript suffit.

## Documents de référence

- `docs/spec.md` : périmètre, écrans, parcours
- `docs/data-model.md` : référentiels, schéma SQL, format du JSON de banque
- `docs/generator.md` : algorithme de génération, à respecter à la lettre
- `docs/roadmap.md` : découpage en lots, ordre de construction

Lis `docs/generator.md` avant d'écrire une ligne du générateur. L'algorithme n'est pas
laissé à l'interprétation.

## Règles de travail non négociables

Le générateur est un module pur. Il vit dans `lib/generator/`, ne connaît ni React, ni
Supabase, ni `Date.now()`, ni `Math.random()`. Il reçoit en entrée un catalogue
d'exercices, un historique, des paramètres et une seed, et retourne une séance. Toute
source d'aléa ou de temps est injectée. C'est la condition pour le tester sérieusement,
et c'est le cœur de valeur de l'app.

Le générateur est testé avant d'être branché à l'interface. Cas obligatoires : budget
inférieur au coût du plus petit exercice, aucune zone servable avec le matériel donné,
huit zones demandées pour dix minutes, catalogue vide, exercice unique répété, seed
identique donnant deux fois le même résultat, seed différente donnant un résultat
différent.

La banque d'exercices n'est jamais saisie via un formulaire. Source de vérité :
`data/exercises.json`, versionné. `npm run seed` valide avec Zod puis pousse en base,
de façon idempotente sur le `slug`. Un exercice non conforme au schéma fait échouer le
seed entier, sans écriture partielle.

Trois axes seulement sont exposés dans l'interface : zones, type, matériel. `position`,
et `intensity` sont des champs internes, obligatoires à la saisie et consommés par le
générateur, mais jamais affichés, jamais filtrables et jamais paramétrables par
l'utilisateur.

Les référentiels de `docs/data-model.md` sont fermés. Ne jamais inventer une zone, un
type, une position ou un matériel qui n'y figure pas. Si un exercice ne rentre pas,
signaler le manque au lieu de forcer une valeur approchante.

Les durées sont toujours stockées en secondes, entières. Sur un exercice asymétrique, la
durée est celle d'un seul côté.

`session_items` conserve un snapshot de la durée retenue. Modifier un exercice dans la
banque ne doit jamais réécrire l'historique.

Français pour l'interface. Anglais pour le code, les identifiants et les codes de
référentiel.

## Pièges de plateforme déjà tranchés

Le push iOS ne fonctionne que si la PWA a été ajoutée à l'écran d'accueil, et la demande
de permission doit partir d'un tap explicite de l'utilisateur. Prévoir un écran
d'installation qui l'explique, et ne jamais appeler `Notification.requestPermission()`
au chargement.

Pas de `navigator.vibrate`, non supporté par Safari iOS. Les signaux du timer passent par
WebAudio, initialisé au démarrage de la séance pendant que le geste utilisateur est encore
valide.

L'ordonnancement du rappel passe par Supabase Cron, pas par Vercel Cron. Le plan Hobby de
Vercel plafonne à une exécution par jour, avec un déclenchement garanti à l'heure près
seulement, ce qui est incompatible avec un rappel à heure fixe.

Screen Wake Lock est utilisé pendant l'exécution d'une séance, et relâché à la sortie de
l'écran.

## Commandes

```
npm run dev          # développement local
npm run test         # tests unitaires, générateur en premier
npm run seed         # valide data/exercises.json et pousse en base
npm run typecheck
npx supabase db push # applique les migrations
```

## Supabase CLI : lien avec le projet hébergé

Pas de Docker sur la machine de dev : la stack locale (`supabase start`) n'est pas
utilisée. Les migrations partent directement sur le projet hébergé, et le schéma est
testé via PGlite.

Le projet hébergé est `rcuwzjqwupkzagwsywdv` (nommé « Gotaku » côté Supabase, alors que
`config.toml` porte `project_id = "Gokaku"` : c'est juste un identifiant local, sans
impact fonctionnel). Le lien créé par `supabase link` est stocké dans
`supabase/.temp/`, qui est gitignoré (`supabase/.gitignore`) et donc absent sur un clone
frais. Sur toute nouvelle machine ou après un clone, refaire :

```
npx supabase login                              # authentifie la CLI
npx supabase link --project-ref rcuwzjqwupkzagwsywdv
```
