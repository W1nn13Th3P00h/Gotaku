# Quickstart — Confort du générateur (Lot 6)

## Pré-requis

- Lot 2 (générateur + écran de génération) en place.

## Lancer et valider manuellement

```bash
npm run dev
```

1. Depuis `/generateur`, choisir huit zones pour une durée de 10 minutes : l'échec
   `ZONES_UNSERVABLE` apparaît avec une action « continuer avec les zones couvrables »
   ; la relance produit une séance sur les zones restantes uniquement (User Story 1).
2. Choisir une durée de 5 minutes avec des zones dont le plus petit exercice dépasse ce
   budget : l'échec `BUDGET_TOO_SMALL` propose directement le prochain palier de
   durée ; la relance à ce palier réussit.
3. Sélectionner un matériel rare avec des zones qui n'ont aucun exercice compatible :
   l'échec `EMPTY_CATALOG` (cause matériel) propose de relancer sans matériel.
4. Provoquer un `EMPTY_CATALOG` par cause « zones » (zone sans aucun exercice) :
   aucune action à tap unique n'apparaît, seul le message explicatif.
5. Activer « prioriser les zones délaissées », générer deux fois la même sélection
   (avec et sans l'option) : la version avec l'option alloue plus de budget aux zones
   les moins récemment travaillées (User Story 2).
6. Vérifier la présence des presets « Cou et épaules », « Hanches et bassin », « Bras
   et avant-bras » à côté des cinq existants ; un tap sélectionne exactement les zones
   annoncées (User Story 3).
7. Régler la tolérance à une valeur différente de 15s, générer : l'écart final reste
   dans cette tolérance (User Story 4). Sans y toucher, le comportement reste identique
   à avant ce lot.

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

`lib/generator/failure-actions.test.ts` couvre `suggestRecovery` pour les quatre cas
du contrat. `lib/generator/generate.test.ts` gagne un test vérifiant qu'une
`toleranceS` personnalisée est respectée, sans toucher aux 11 tests obligatoires
existants (SC-003).

## Ce que ce lot ne couvre pas

Aucun nouvel écran, aucune nouvelle table. Uniquement l'écran de génération et le
module pur du générateur, déjà construits au Lot 2.
