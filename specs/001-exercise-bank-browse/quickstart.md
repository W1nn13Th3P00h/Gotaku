# Quickstart — Banque d'exercices en lecture (Lot 1)

## Pré-requis

- Lot 0 terminé : `npm install`, base Supabase liée (`npx supabase link`), banque
  seedée (`npm run seed`).
- `.env.local` renseigné (voir `.env.example`).

## Lancer et valider manuellement

```bash
npm run dev
```

1. Ouvrir `/bank` : la liste des 330 exercices s'affiche.
2. Taper un nom partiel dans la recherche → la liste se restreint aux exercices
   correspondants (User Story 1, FR-002).
3. Sélectionner une zone, un type et un matériel → la liste ne montre que les exercices
   satisfaisant les trois critères combinés (FR-003).
4. Choisir une combinaison qui ne correspond à rien → un message explicite apparaît, pas
   une liste vide muette (FR-011).
5. Ouvrir un exercice de la liste → la fiche affiche nom, type, zones (zone primaire mise
   en évidence), matériel, durée cible, instructions, contre-indications, date de
   dernière exécution (ou son absence) — jamais position ni intensité (User Story 2,
   FR-005 à FR-007).
6. Ouvrir `/bank/coverage` → chaque zone du référentiel apparaît avec son nombre
   d'exercices, y compris une zone à 0, et les zones sous-alimentées sont mises en
   évidence (User Story 3, FR-008, FR-009).

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

Les tests de `lib/bank/queries.test.ts` couvrent : combinaison de filtres, absence de
résultat, zone sans exercice dans la couverture, seuil de mise en évidence, et l'absence
de `position`/`intensity` dans les objets retournés.

## Ce que ce lot ne couvre pas

Aucune écriture. Pour changer un exercice, éditer `data/exercises.json` puis relancer
`npm run seed` — jamais depuis `/bank`.
