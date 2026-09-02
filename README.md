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

## Étape à faire une fois dans le dashboard Supabase

Le lien magique doit pointer sur la route serveur, pas sur le flux implicite qui renvoie
le token dans le fragment d'URL, inexploitable côté serveur.

1. Authentication > URL Configuration : mettre `http://localhost:3000` en Site URL, et
   ajouter `http://localhost:3000/auth/confirm` puis l'équivalent Vercel en Redirect URLs.
2. Authentication > Emails > Magic Link : remplacer le corps par un lien vers

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
   ```

3. Authentication > Users : créer le compte à la main. L'application est
   mono-utilisateur, l'inscription est fermée (`shouldCreateUser: false`), un lien
   demandé pour une adresse inconnue n'envoie rien.

Sans l'étape 2, la route `/auth/confirm` reçoit un lien sans `token_hash` et renvoie
sur `/login`.

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
