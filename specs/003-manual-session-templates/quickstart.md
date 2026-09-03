# Quickstart — Séance manuelle et modèles (Lot 4)

## Pré-requis

- Lots 0, 1 et 3 en place (banque seedée, écran `/bank`, écran `/session/[id]`).

## Lancer et valider manuellement

```bash
npm run dev
```

1. Depuis `/bank`, ajouter deux ou trois exercices à la composition (dont au moins un
   asymétrique) : ils apparaissent sur `/compose`.
2. Réordonner les exercices avec les boutons haut/bas.
3. Ajuster la durée d'un exercice : la durée totale affichée se met à jour
   immédiatement ; tenter une valeur hors plage, vérifier qu'elle est ramenée à la
   borne.
4. Ajouter deux fois le même exercice : les deux occurrences sont ajustables
   indépendamment (User Story 1, FR-007).
5. Retirer tous les exercices : « démarrer » et « sauvegarder » deviennent
   indisponibles (FR-009).
6. Recomposer, puis démarrer directement : `/session/[id]` prend le relais (Lot 3).
7. Recomposer une nouvelle séance, la sauvegarder sous un nom : elle apparaît dans
   `/compose/templates` avec son nombre d'exercices et sa durée totale (User Story 2).
8. Tenter de sauvegarder sans nom : refusé (FR-011).
9. Depuis `/compose/templates`, démarrer un modèle : une nouvelle séance se crée et
   l'exécution démarre (Lot 3) (User Story 3).
10. Modifier ensuite la composition d'origine : le modèle déjà sauvegardé et la séance
    déjà démarrée restent inchangés (SC-003).
11. Fermer l'onglet en cours de composition (avant démarrage/sauvegarde), rouvrir
    `/compose` : la composition est retrouvée intacte (SC-002).

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

`lib/sessions/composition.test.ts` couvre `computeTotalDurationS` (avec et sans
exercices `perSide`) et `clampDurationS` (valeur dans la plage, sous la borne basse,
au-dessus de la borne haute, valeur non entière).

## Ce que ce lot ne couvre pas

Ni la génération automatique (Lot 2) ni l'exécution elle-même (Lot 3, déjà faite) :
« démarrer », ici, ne fait que remettre la main au Lot 3 sur une séance déjà prête.
