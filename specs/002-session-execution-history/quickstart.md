# Quickstart — Exécution de séance et historique (Lot 3)

## Pré-requis

- Lot 0 terminé, banque seedée. Une séance existante en base pour tester (peu importe
  sa source — en attendant le Lot 2 UI ou le Lot 4, on peut en insérer une à la main via
  `supabase.from('sessions')`/`session_items` en SQL directement dans le projet
  hébergé, ou via un petit script ponctuel, avec un exercice asymétrique inclus pour
  couvrir ce cas).

## Lancer et valider manuellement

```bash
npm run dev
```

1. Ouvrir `/session/<id>` d'une séance à faire : le premier exercice s'affiche plein
   écran avec son décompte, ses instructions, ses zones, et un aperçu du suivant.
2. Laisser le décompte descendre jusqu'à 3 secondes : un signal sonore se déclenche.
3. Laisser l'exercice se terminer : l'exercice suivant démarre seul, avec un signal de
   changement (User Story 1, FR-002 à FR-003, FR-007).
4. Mettre en pause puis reprendre : le temps restant est inchangé pendant la pause.
5. Utiliser « passer » puis « revenir » : vérifier que l'exercice passé redémarre
   depuis son début (FR-005, FR-006).
6. Sur un exercice asymétrique : vérifier l'annonce explicite du changement de côté
   (FR-008).
7. Aller jusqu'au bout : l'écran de fin affiche durée réelle, réalisés/passés, zones
   travaillées ; en base, `sessions.status = 'completed'` (User Story 1, FR-011).
8. Rouvrir la fiche d'un exercice de cette séance (`/bank/[slug]`, Lot 1) : sa date de
   dernière exécution reflète cette séance (FR-012).
9. Démarrer une nouvelle séance, la quitter après un ou deux exercices (fermer l'onglet
   ou naviguer ailleurs) : revenir sur `/session/<id>` le même jour doit reprendre
   exactement où c'était resté (User Story 2, FR-010, FR-014, SC-002).
10. Ouvrir `/history` : la séance terminée à l'étape 7 apparaît en tête de liste, la
    synthèse 30 jours reflète ses zones (User Story 3, FR-015 à FR-017).

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

`lib/session-player/reducer.test.ts` couvre, sans timer ni DOM réels : décompte,
pause/reprise sans dérive, passer/revenir (y compris aux bornes de la séance et sur un
exercice asymétrique), et détection de fin de séance. `lib/sessions/queries.test.ts`
(PGlite) couvre la fonction SQL `session_history_summary` : fenêtre de 30 jours, zone à
zéro incluse.

## Ce que ce lot ne couvre pas

Ni la génération (Lot 2) ni la composition manuelle (Lot 4) d'une séance : ce lot
consomme une séance déjà créée par ailleurs.
