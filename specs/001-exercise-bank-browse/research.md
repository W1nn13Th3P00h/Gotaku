# Phase 0 — Research: Banque d'exercices en lecture (Lot 1)

Aucun `NEEDS CLARIFICATION` ne subsistait dans le Technical Context du plan : le
Lot 0 (schéma, seed, auth) est terminé et documenté (`docs/init-log.md`), et
`docs/spec.md` / `docs/data-model.md` cadrent déjà précisément cet écran. Les points
ci-dessous sont donc des décisions d'implémentation à figer avant la conception détaillée
(Phase 1), pas des inconnues à lever.

## Récupération et filtrage des données

- **Decision**: un Server Component par écran, qui interroge Postgres directement via le
  client Supabase serveur (`lib/supabase/server.ts`), en passant la recherche texte et
  les filtres actifs (portés par les `searchParams` de l'URL) à une fonction dédiée de
  `lib/bank/queries.ts`. Le filtrage et la recherche s'exécutent en base, pas en
  ré-appliquant un filtre JS après un chargement complet.
- **Rationale**: 330 lignes est un volume trivial pour Postgres ; faire porter les
  filtres par l'URL (au lieu d'un state client) garde l'écran simple, partageable par
  lien, et cohérent avec le choix déjà fait pour `app/page.tsx` (Server Component pur,
  sans state client). Évite d'introduire une dépendance de gestion d'état.
- **Alternatives considered**: charger les 330 exercices une fois puis filtrer côté
  client — fonctionnerait vu le volume, mais duplique la logique de filtrage si elle doit
  être réutilisée ailleurs (par ex. Lot 4, composition manuelle) et complexifie le partage
  de lien avec filtres actifs. Pagination serveur — inutile à cette échelle, ajouterait de
  la complexité sans bénéfice utilisateur.

## Recherche texte

- **Decision**: recherche par `ilike '%terme%'` insensible à la casse sur `name`,
  exécutée en base dans la même requête que les filtres.
- **Rationale**: couvre le besoin exprimé (FR-002, SC-001) sans dépendance
  supplémentaire ; reste un seul point de vérité de la logique de recherche.
- **Alternatives considered**: recherche floue/tolérante aux fautes de frappe (extension
  `pg_trgm`) — hors scope, aucune exigence de tolérance aux fautes dans la spec ; a été
  écarté pour ne pas ajouter une extension Postgres non justifiée par un besoin exprimé.

## Emplacement du code

- **Decision**: les nouvelles fonctions de lecture vivent dans `lib/bank/queries.ts`, aux
  côtés du `schema.ts` déjà existant (Lot 0).
- **Rationale**: mirroir de la convention déjà suivie par `lib/generator/` — logique de
  données séparée des composants React, unité testable indépendamment par Vitest.

## Tableau de couverture par zone

- **Decision**: une fonction SQL dédiée `zone_coverage()`, ajoutée par une nouvelle
  migration, qui fait le `left join` de `zones` vers `exercise_zones` (group by
  `zones.code`, count) pour que toute zone du référentiel apparaisse avec un compte
  (y compris zéro). `getZoneCoverage()` l'appelle via `supabase.rpc('zone_coverage')`,
  sur le modèle déjà suivi par `seed_exercises`.
- **Rationale**: garantit FR-008/SC-005 (une zone sans exercice doit apparaître avec un
  compte de zéro) sans dépendre d'une itération manuelle sur le référentiel côté
  application. Surtout, une fonction SQL peut être testée directement contre PGlite,
  exactement comme `seed_exercises` l'est dans `lib/db/migrations.test.ts` — c'est la
  seule façon, dans ce projet (pas de Docker, pas de PostgREST local), de vérifier
  réellement le comportement du `left join` plutôt que de le supposer.
- **Alternatives considered**: syntaxe d'agrégation embarquée de PostgREST
  (`.from('zones').select('code, exercise_zones(count)')`) — fonctionnerait probablement
  en production, mais ne peut pas être testée avec PGlite (qui n'expose pas de couche
  PostgREST), donc cette garantie resterait non vérifiée par les tests ; écartée pour ce
  point précis où l'erreur (zone omise) est facile à introduire et coûteuse à rater.
  Charger tous les exercices et leurs zones puis compter en JS — fonctionnerait, mais
  oblige à itérer sur `ZONES` (référentiel TypeScript) pour ne pas oublier les zones à
  zéro, dupliquant en JS une logique que Postgres fait nativement, sans gain de
  testabilité par rapport à la fonction SQL.

## Stratégie de test des fonctions de lecture

- **Decision**: seule la fonction SQL `zone_coverage()` est testée contre une vraie base
  (PGlite), comme les autres invariants de schéma. Les fonctions `listExercises` et
  `getExerciseBySlug` restent des requêtes déclaratives `supabase-js` (`ilike`, `eq`,
  sélection explicite de colonnes) non retestées à ce niveau ; en revanche, leurs
  fonctions de mise en forme (mapper les lignes brutes vers `ExerciseSummary` /
  `ExerciseDetail`) sont extraites en fonctions pures et testées par Vitest sans base de
  données, y compris avec un test garantissant que `position` et `intensity` sont bien
  absents du résultat même si la ligne brute en entrée les contient.
- **Rationale**: aligne l'effort de test sur le risque réel. Le `left join` de
  couverture est le seul endroit où un bug (`inner join` au lieu de `left join`) est
  silencieux et viole directement une exigence testable (FR-008). Le filtrage
  déclaratif de `listExercises` est un usage standard de `supabase-js` déjà pratiqué
  ailleurs dans le projet (`app/page.tsx`) et vérifiable manuellement via
  `quickstart.md` ; sur-tester une requête aussi directe irait à l'encontre de la
  consigne du projet de ne pas ajouter de test ou d'abstraction sans besoin réel. La
  protection contre la fuite de `position`/`intensity` (Constitution Principe III), en
  revanche, mérite un test explicite parce que c'est une régression facile à introduire
  silencieusement (par ex. en changeant une sélection de colonnes pour un `select('*')`).

## Seuil de mise en évidence "zone sous-alimentée"

- **Decision**: seuil fixe documenté en constante (`ZONE_LOW_COVERAGE_THRESHOLD = 10`
  exercices), défini à côté des fonctions de couverture dans `lib/bank/queries.ts`.
- **Rationale**: aligné sur les chiffres déjà connus de `docs/roadmap.md` (`shins` 4,
  `neck` 5, `triceps` 5, `it_bands` 5, `feet` 6, `biceps` 8 — toutes sous 10 — contre des
  zones bien mieux pourvues au-delà). Un seuil relatif (quartile, écart-type) serait plus
  robuste à long terme mais non justifié pour un tableau de pilotage personnel ; le Lot 6
  (« réglages de tolérance ») est l'endroit prévu par le roadmap pour le rendre
  configurable si besoin.
- **Alternatives considered**: seuil relatif (percentile le plus bas) — écarté comme
  sur-ingénierie pour ce lot, la spec ne demande qu'une mise en évidence visuelle, pas un
  algorithme de priorisation (celui-ci existe déjà côté générateur via
  `preferNeglectedZones`, Lot 2).

## Date de dernière exécution

- **Decision**: lue depuis la vue `exercise_last_performed`, déjà créée au Lot 0
  (`supabase/migrations/20260902120200_sessions.sql`), via un `left join` depuis la
  requête de fiche exercice.
- **Rationale**: aucune nouvelle table nécessaire ; la vue applique déjà la bonne
  définition (dernière séance `completed`, item `done`) et respecte `security_invoker`
  pour la RLS.
