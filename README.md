# Gokaku

Application personnelle mono-utilisateur d'accompagnement aux séances de mobilité et
d'étirements. Banque d'exercices taggée, générateur de séance sous contrainte de durée,
exécution guidée au timer, rappel push quotidien.

Périmètre, écrans et algorithme : voir `docs/`. `CLAUDE.md` porte les règles de travail.

## Mise en route

```bash
npm install
cp .env.example .env.local     # puis remplir les clés Supabase
npx supabase link --project-ref <ref-du-projet>
npx supabase db push           # applique les migrations
npm run seed                   # valide data/exercises.json et pousse en base
npm run dev
```

`.env.local` n'est pas versionné et ne doit jamais l'être.

## Authentification

Adresse et mot de passe. Un seul compte, créé à la main, une fois, dans le dashboard
Supabase : Authentication > Users > Add user, avec « Auto Confirm User » coché pour ne
pas avoir à valider un mail.

L'application n'appelle jamais `signUp`. Il n'existe donc aucun parcours d'inscription,
et rien à fermer côté Supabase. Mot de passe oublié : le réinitialiser depuis le
dashboard.

Pense à désactiver l'inscription publique dans Authentication > Sign In / Providers si
elle est active, par principe. Rien dans le code ne l'utilise, mais l'endpoint Supabase
reste ouvert sinon.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | développement local |
| `npm run test` | tests unitaires |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | valide `data/exercises.json` et pousse en base |
| `npm run seed:check` | valide seulement, n'écrit rien |
| `npm run db:types` | régénère `types/database.ts` depuis le projet lié |
| `npx supabase db push` | applique les migrations |

## Banque d'exercices

`data/exercises.json` est la source de vérité, versionnée. Aucune saisie par formulaire,
aucune édition depuis l'interface. Le `slug` est la clé d'idempotence du seed.

Un slug retiré du JSON n'est pas supprimé en base mais passé à `active = false` :
`session_items` référence les exercices, et l'historique ne se réécrit pas.

## Structure

```
app/                  routes Next.js (App Router)
lib/referentials.ts   référentiels fermés, miroir de docs/data-model.md
lib/bank/             schéma Zod de la banque et ses tests
lib/generator/        module pur du générateur (lot 2)
lib/supabase/         clients navigateur, serveur et proxy
proxy.ts              protection globale des routes
scripts/seed.ts       npm run seed
supabase/migrations/  schéma SQL
data/exercises.json   banque
docs/                 spécifications de référence
```
